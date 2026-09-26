import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import 'dotenv/config'
import type { Express } from 'express'

const shouldRunSecurityTests = process.env.RUN_SECURITY_TESTS === 'true'

function normalizeDatabaseUrl(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, '')
}

function assertSafeTestDatabaseUrl() {
  if (!shouldRunSecurityTests) return

  const testDatabaseUrl = normalizeDatabaseUrl(process.env.TEST_DATABASE_URL)
  const regularDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL)

  if (!testDatabaseUrl) {
    throw new Error(
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run owner acquisition tests against DATABASE_URL.',
    )
  }
  if (regularDatabaseUrl && testDatabaseUrl === regularDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run owner acquisition tests against the normal app database.',
    )
  }

  const parsedUrl = new URL(testDatabaseUrl)
  const normalizedUrl = testDatabaseUrl.toLowerCase()
  const clearlyTestDatabase =
    normalizedUrl.includes('test') || normalizedUrl.includes('testing')
  if (
    !clearlyTestDatabase &&
    (normalizedUrl.includes('peepss') ||
      normalizedUrl.includes('production') ||
      normalizedUrl.includes('prod') ||
      parsedUrl.hostname.toLowerCase().includes('neon.tech'))
  ) {
    throw new Error(
      'TEST_DATABASE_URL looks production-like. Use a dedicated database with test in the name.',
    )
  }
}

assertSafeTestDatabaseUrl()

type ApiResponse<T> = {
  status: number
  body: T
}

type AuthResponse = {
  token: string
  user: {
    id: string
    phoneNumber: string | null
  }
  ownerAcquisitionFlow: 'selfServe' | 'claim' | 'pendingPhone' | null
}

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  const value = await response.text()
  return {
    status: response.status,
    body: value ? (JSON.parse(value) as T) : ({} as T),
  }
}

test(
  'owner acquisition funnel preserves attribution, flow boundaries, and durable establishment state',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run owner acquisition integration tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'owner-acquisition-test-secret'
    process.env.OTP_CODE_LENGTH = '4'
    process.env.OTP_EXPIRES_MINUTES = '5'
    process.env.OTP_MAX_ATTEMPTS = '5'

    const [
      { app },
      { prisma },
      { getCapturedOtpCodeForTest },
      {
        isRestaurantEstablishedForAcquisition,
        linkOwnerAcquisitionToUser,
        recordOwnerOtpVerifiedBestEffort,
      },
    ] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js'),
      import('../services/otpProvider.js'),
      import('../services/analytics.service.js'),
    ])

    const server = createServer(app)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${address.port}/api`
    const runId = randomUUID()
    const phoneSuffix = Date.now().toString().slice(-7)
    const phones = {
      selfServe: `+97250${phoneSuffix}`,
      worker: `+97252${phoneSuffix}`,
      pending: `+97254${phoneSuffix}`,
      claim: `+97255${phoneSuffix}`,
      candidate: `+97258${phoneSuffix}`,
      analyticsFailure: `+97259${phoneSuffix}`,
    }
    const acquisitionIds = {
      selfServe: randomUUID(),
      worker: randomUUID(),
      pending: randomUUID(),
      claim: randomUUID(),
      candidate: randomUUID(),
      analyticsFailure: randomUUID(),
    }
    const createdUserIds: string[] = []

    async function request<T>(
      path: string,
      body: unknown,
      token?: string,
    ) {
      return readJson<T>(
        await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        }),
      )
    }

    async function waitFor(
      predicate: () => Promise<boolean>,
      timeoutMs = 2_000,
    ) {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        if (await predicate()) return
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      assert.fail('Timed out waiting for asynchronous analytics write')
    }

    function acquisitionPayload(
      anonymousAcquisitionId: string,
      source = 'Instagram',
    ) {
      return {
        anonymousAcquisitionId,
        firstTouch: {
          source,
          medium: 'paid social',
          campaign: 'owner_stage2_test',
          referrer: 'instagram.com',
          direct: false,
          landingPath: '/register',
          firstTouchedAt: new Date().toISOString(),
        },
      }
    }

    function ownerStartAnalytics(
      anonymousAcquisitionId: string,
      flowHint?: 'selfServe',
    ) {
      return {
        acquisition: acquisitionPayload(anonymousAcquisitionId),
        clientEventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        route: '/register',
        ...(flowHint ? { flowHint } : {}),
      }
    }

    async function requestOtp(input: {
      phoneNumber: string
      purpose?: 'login' | 'register' | 'qrApply'
      analytics?: ReturnType<typeof ownerStartAnalytics>
    }) {
      return request<{ ok: boolean }>('/auth/request-code', {
        phoneNumber: input.phoneNumber,
        purpose: input.purpose ?? 'register',
        ...(input.analytics ? { analytics: input.analytics } : {}),
      })
    }

    async function verifyOtp(input: {
      phoneNumber: string
      code: string
      track?: 'restaurant' | 'restaurantOwner'
      ownerFlowHint?: 'selfServe' | 'claim'
      ownerOtpAnalytics?: {
        anonymousAcquisitionId: string
        clientEventId: string
        occurredAt: string
        route: string | null
      }
    }) {
      return request<AuthResponse>('/auth/verify-code', {
        phoneNumber: input.phoneNumber,
        code: input.code,
        purpose: 'register',
        fullName: `Stage 2 ${runId}`,
        track: input.track ?? 'restaurantOwner',
        ...(input.ownerFlowHint
          ? { ownerFlowHint: input.ownerFlowHint }
          : {}),
        ...(input.ownerOtpAnalytics
          ? { ownerOtpAnalytics: input.ownerOtpAnalytics }
          : {}),
      })
    }

    async function assertStartedFlow(
      anonymousAcquisitionId: string,
      flow: 'selfServe' | 'claim' | 'pendingPhone',
    ) {
      const acquisition =
        await prisma.analyticsAcquisition.findUniqueOrThrow({
          where: { anonymousAcquisitionId },
          include: {
            events: {
              where: { eventName: 'owner_signup_started' },
            },
          },
        })
      assert.equal(acquisition.events.length, 1)
      assert.deepEqual(acquisition.events[0]?.properties, { flow })
    }

    function verifiedLinkPayload(
      anonymousAcquisitionId: string,
      flow: 'selfServe' | 'claim' | 'pendingPhone',
    ) {
      return {
        anonymousAcquisitionId,
        clientEventId: randomUUID(),
        flow,
        occurredAt: new Date().toISOString(),
        route: '/register',
      }
    }

    function otpAttemptFromLinkPayload(
      payload: ReturnType<typeof verifiedLinkPayload>,
    ) {
      return {
        anonymousAcquisitionId: payload.anonymousAcquisitionId,
        clientEventId: payload.clientEventId,
        occurredAt: payload.occurredAt,
        route: payload.route,
      }
    }

    async function assertServerRecordedVerifiedEvent(
      payload: ReturnType<typeof verifiedLinkPayload>,
      userId: string,
    ) {
      await waitFor(async () => {
        return (
          (await prisma.analyticsEvent.count({
            where: { clientEventId: payload.clientEventId },
          })) === 1
        )
      })

      const acquisition =
        await prisma.analyticsAcquisition.findUniqueOrThrow({
          where: {
            anonymousAcquisitionId: payload.anonymousAcquisitionId,
          },
          include: {
            events: {
              where: { clientEventId: payload.clientEventId },
            },
          },
        })
      assert.equal(acquisition.userId, userId)
      assert.equal(acquisition.events.length, 1)
      assert.equal(
        acquisition.events[0]?.eventName,
        'owner_otp_verified',
      )
      assert.deepEqual(acquisition.events[0]?.properties, {
        flow: payload.flow,
      })
    }

    try {
      // selfServe starts only after the explicit owner code request.
      const selfServeStart = ownerStartAnalytics(
        acquisitionIds.selfServe,
        'selfServe',
      )
      const selfServeRequest = await requestOtp({
        phoneNumber: phones.selfServe,
        analytics: selfServeStart,
      })
      assert.equal(selfServeRequest.status, 200)
      const selfServeRequestRetry = await requestOtp({
        phoneNumber: phones.selfServe,
        analytics: selfServeStart,
      })
      assert.equal(selfServeRequestRetry.status, 200)
      await waitFor(async () => {
        return (
          (await prisma.analyticsEvent.count({
            where: {
              eventName: 'owner_signup_started',
              acquisition: {
                anonymousAcquisitionId: acquisitionIds.selfServe,
              },
            },
          })) === 1
        )
      })
      await assertStartedFlow(acquisitionIds.selfServe, 'selfServe')

      const selfServeCode = getCapturedOtpCodeForTest(
        phones.selfServe,
        'register',
      )
      assert.ok(selfServeCode)
      const selfServeLinkPayload = verifiedLinkPayload(
        acquisitionIds.selfServe,
        'selfServe',
      )
      const selfServeOtpAttempt = otpAttemptFromLinkPayload(
        selfServeLinkPayload,
      )
      const wrongCode = selfServeCode === '0000' ? '0001' : '0000'
      const failedVerification = await verifyOtp({
        phoneNumber: phones.selfServe,
        code: wrongCode,
        ownerFlowHint: 'selfServe',
        ownerOtpAnalytics: selfServeOtpAttempt,
      })
      assert.equal(failedVerification.status, 400)
      assert.equal(
        await prisma.analyticsEvent.count({
          where: {
            eventName: 'owner_otp_verified',
            acquisition: {
              anonymousAcquisitionId: acquisitionIds.selfServe,
            },
          },
        }),
        0,
      )

      const selfServeAuth = await verifyOtp({
        phoneNumber: phones.selfServe,
        code: selfServeCode,
        ownerFlowHint: 'selfServe',
        ownerOtpAnalytics: selfServeOtpAttempt,
      })
      assert.equal(selfServeAuth.status, 200)
      assert.equal(selfServeAuth.body.ownerAcquisitionFlow, 'selfServe')
      createdUserIds.push(selfServeAuth.body.user.id)
      await assertServerRecordedVerifiedEvent(
        selfServeLinkPayload,
        selfServeAuth.body.user.id,
      )

      // The browser fallback reuses the exact same event identity and repairs
      // a missed server write without duplicating a successful server write.
      const selfServeLink = await request<{ created: boolean }>(
        '/analytics/link',
        selfServeLinkPayload,
        selfServeAuth.body.token,
      )
      assert.equal(selfServeLink.status, 200)
      assert.equal(selfServeLink.body.created, false)

      const selfServeLinkRetry = await request<{ created: boolean }>(
        '/analytics/link',
        selfServeLinkPayload,
        selfServeAuth.body.token,
      )
      assert.equal(selfServeLinkRetry.status, 200)
      assert.equal(selfServeLinkRetry.body.created, false)
      assert.equal(
        await prisma.analyticsEvent.count({
          where: { clientEventId: selfServeLinkPayload.clientEventId },
        }),
        1,
      )

      // A worker-only registration carries local context for pending-phone
      // detection, but does not persist it or emit owner events.
      const workerStart = ownerStartAnalytics(acquisitionIds.worker)
      const workerRequest = await requestOtp({
        phoneNumber: phones.worker,
        analytics: workerStart,
      })
      assert.equal(workerRequest.status, 200)
      await new Promise((resolve) => setTimeout(resolve, 100))
      assert.equal(
        await prisma.analyticsAcquisition.count({
          where: {
            anonymousAcquisitionId: acquisitionIds.worker,
          },
        }),
        0,
      )

      const workerCode = getCapturedOtpCodeForTest(
        phones.worker,
        'register',
      )
      assert.ok(workerCode)
      const workerLinkPayload = verifiedLinkPayload(
        acquisitionIds.worker,
        'selfServe',
      )
      const workerAuth = await verifyOtp({
        phoneNumber: phones.worker,
        code: workerCode,
        track: 'restaurant',
        ownerFlowHint: 'selfServe',
        ownerOtpAnalytics: otpAttemptFromLinkPayload(workerLinkPayload),
      })
      assert.equal(workerAuth.status, 200)
      assert.equal(workerAuth.body.ownerAcquisitionFlow, null)
      createdUserIds.push(workerAuth.body.user.id)
      assert.equal(
        await prisma.analyticsEvent.count({
          where: {
            eventName: 'owner_otp_verified',
            acquisition: {
              anonymousAcquisitionId: acquisitionIds.worker,
            },
          },
        }),
        0,
      )

      // pendingPhone is determined from the actual pending owner membership,
      // not from the user's selected auth track.
      const pendingProfileUser = await prisma.user.create({
        data: {
          email: `pending-profile-${runId}@example.test`,
          fullName: 'Pending Profile Holder',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(pendingProfileUser.id)
      const pendingProfile = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: pendingProfileUser.id,
          restaurantName: `Pending ${runId}`,
          slug: `pending-${runId}`,
        },
      })
      await prisma.restaurantMember.create({
        data: {
          restaurantId: pendingProfile.id,
          phoneNumber: phones.pending,
          role: 'owner',
          status: 'pending',
        },
      })

      const pendingRequest = await requestOtp({
        phoneNumber: phones.pending,
        analytics: ownerStartAnalytics(acquisitionIds.pending),
      })
      assert.equal(pendingRequest.status, 200)
      await waitFor(async () => {
        return (
          (await prisma.analyticsEvent.count({
            where: {
              eventName: 'owner_signup_started',
              acquisition: {
                anonymousAcquisitionId: acquisitionIds.pending,
              },
            },
          })) === 1
        )
      })
      await assertStartedFlow(acquisitionIds.pending, 'pendingPhone')

      const pendingCode = getCapturedOtpCodeForTest(
        phones.pending,
        'register',
      )
      assert.ok(pendingCode)
      const pendingLinkPayload = verifiedLinkPayload(
        acquisitionIds.pending,
        'pendingPhone',
      )
      const pendingAuth = await verifyOtp({
        phoneNumber: phones.pending,
        code: pendingCode,
        track: 'restaurant',
        ownerOtpAnalytics: otpAttemptFromLinkPayload(pendingLinkPayload),
      })
      assert.equal(pendingAuth.status, 200)
      assert.equal(pendingAuth.body.ownerAcquisitionFlow, 'pendingPhone')
      createdUserIds.push(pendingAuth.body.user.id)
      await assertServerRecordedVerifiedEvent(
        pendingLinkPayload,
        pendingAuth.body.user.id,
      )
      assert.equal(
        (
          await request(
            '/analytics/link',
            pendingLinkPayload,
            pendingAuth.body.token,
          )
        ).status,
        200,
      )
      const activatedPendingMembership =
        await prisma.restaurantMember.findFirstOrThrow({
          where: {
            restaurantId: pendingProfile.id,
            userId: pendingAuth.body.user.id,
          },
        })
      assert.equal(activatedPendingMembership.status, 'active')

      // Claim start uses the existing public acquisition/event endpoints.
      const claimAcquisition = acquisitionPayload(acquisitionIds.claim)
      assert.equal(
        (await request('/analytics/acquisition', claimAcquisition)).status,
        201,
      )
      assert.equal(
        (
          await request('/analytics/events', {
            anonymousAcquisitionId: acquisitionIds.claim,
            clientEventId: randomUUID(),
            eventName: 'owner_signup_started',
            occurredAt: new Date().toISOString(),
            route: '/claim/test-restaurant',
            properties: { flow: 'claim' },
          })
        ).status,
        201,
      )
      await assertStartedFlow(acquisitionIds.claim, 'claim')

      assert.equal(
        (await requestOtp({ phoneNumber: phones.claim })).status,
        200,
      )
      const claimCode = getCapturedOtpCodeForTest(
        phones.claim,
        'register',
      )
      assert.ok(claimCode)
      const claimLinkPayload = verifiedLinkPayload(
        acquisitionIds.claim,
        'claim',
      )
      const claimAuth = await verifyOtp({
        phoneNumber: phones.claim,
        code: claimCode,
        ownerFlowHint: 'claim',
        ownerOtpAnalytics: otpAttemptFromLinkPayload(claimLinkPayload),
      })
      assert.equal(claimAuth.status, 200)
      assert.equal(claimAuth.body.ownerAcquisitionFlow, 'claim')
      createdUserIds.push(claimAuth.body.user.id)
      await assertServerRecordedVerifiedEvent(
        claimLinkPayload,
        claimAuth.body.user.id,
      )
      assert.equal(
        (
          await request(
            '/analytics/link',
            claimLinkPayload,
            claimAuth.body.token,
          )
        ).status,
        200,
      )

      // Candidate QR verification remains outside the owner funnel even if a
      // client sends owner-shaped analytics metadata and a claim hint.
      const candidateRequest = await requestOtp({
        phoneNumber: phones.candidate,
        purpose: 'qrApply',
        analytics: ownerStartAnalytics(acquisitionIds.candidate),
      })
      assert.equal(candidateRequest.status, 200)
      const candidateCode = getCapturedOtpCodeForTest(
        phones.candidate,
        'qrApply',
      )
      assert.ok(candidateCode)
      const candidateLinkPayload = verifiedLinkPayload(
        acquisitionIds.candidate,
        'claim',
      )
      const candidateAuth = await request<AuthResponse>(
        '/auth/verify-code',
        {
          phoneNumber: phones.candidate,
          code: candidateCode,
          purpose: 'qrApply',
          fullName: `Candidate ${runId}`,
          track: 'restaurantOwner',
          ownerFlowHint: 'claim',
          ownerOtpAnalytics: otpAttemptFromLinkPayload(
            candidateLinkPayload,
          ),
        },
      )
      assert.equal(candidateAuth.status, 200)
      assert.equal(candidateAuth.body.ownerAcquisitionFlow, null)
      createdUserIds.push(candidateAuth.body.user.id)
      await new Promise((resolve) => setTimeout(resolve, 100))
      assert.equal(
        await prisma.analyticsAcquisition.count({
          where: {
            anonymousAcquisitionId: acquisitionIds.candidate,
          },
        }),
        0,
      )
      assert.equal(
        await prisma.analyticsEvent.count({
          where: { clientEventId: candidateLinkPayload.clientEventId },
        }),
        0,
      )

      // Missing acquisition storage is a real analytics failure, but it must
      // not change a successful owner OTP response.
      assert.equal(
        (await requestOtp({ phoneNumber: phones.analyticsFailure })).status,
        200,
      )
      const analyticsFailureCode = getCapturedOtpCodeForTest(
        phones.analyticsFailure,
        'register',
      )
      assert.ok(analyticsFailureCode)
      const analyticsFailurePayload = verifiedLinkPayload(
        acquisitionIds.analyticsFailure,
        'selfServe',
      )
      const analyticsFailureAuth = await verifyOtp({
        phoneNumber: phones.analyticsFailure,
        code: analyticsFailureCode,
        ownerFlowHint: 'selfServe',
        ownerOtpAnalytics: otpAttemptFromLinkPayload(
          analyticsFailurePayload,
        ),
      })
      assert.equal(analyticsFailureAuth.status, 200)
      assert.ok(analyticsFailureAuth.body.token)
      createdUserIds.push(analyticsFailureAuth.body.user.id)

      let analyticsFailureLogged = false
      const bestEffortResult = await recordOwnerOtpVerifiedBestEffort(
        {
          userId: analyticsFailureAuth.body.user.id,
          flow: 'selfServe',
          ...otpAttemptFromLinkPayload(analyticsFailurePayload),
        },
        {
          record: async () => {
            throw new Error('simulated analytics database failure')
          },
          logError: () => {
            analyticsFailureLogged = true
            throw new Error('simulated logger failure')
          },
        },
      )
      assert.equal(bestEffortResult.status, 'failed')
      assert.equal(analyticsFailureLogged, true)

      // The authenticated endpoint chooses the JWT user and rejects both an
      // arbitrary userId field and a relink to a different authenticated user.
      assert.equal(
        (
          await request(
            '/analytics/link',
            {
              ...selfServeLinkPayload,
              clientEventId: randomUUID(),
              userId: workerAuth.body.user.id,
            },
            selfServeAuth.body.token,
          )
        ).status,
        400,
      )
      const conflictingRelink = await linkOwnerAcquisitionToUser(
        workerAuth.body.user.id,
        {
          ...selfServeLinkPayload,
          clientEventId: randomUUID(),
        },
      )
      assert.equal(
        conflictingRelink.status,
        'acquisition_user_conflict',
      )
      assert.equal(
        (
          await request(
            '/analytics/link',
            {
              ...selfServeLinkPayload,
              clientEventId: randomUUID(),
            },
            workerAuth.body.token,
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await request('/analytics/link', {
            ...selfServeLinkPayload,
            clientEventId: randomUUID(),
          })
        ).status,
        401,
      )

      const linkedSelfServeAcquisition =
        await prisma.analyticsAcquisition.findUniqueOrThrow({
          where: {
            anonymousAcquisitionId: acquisitionIds.selfServe,
          },
        })
      assert.equal(
        linkedSelfServeAcquisition.userId,
        selfServeAuth.body.user.id,
      )
      assert.equal(linkedSelfServeAcquisition.firstSource, 'Instagram')
      assert.equal(linkedSelfServeAcquisition.firstMedium, 'paid social')
      assert.equal(
        linkedSelfServeAcquisition.firstCampaign,
        'owner_stage2_test',
      )

      // A later direct registration is acknowledged but cannot overwrite the
      // original Instagram first touch.
      assert.equal(
        (
          await request('/analytics/acquisition', {
            anonymousAcquisitionId: acquisitionIds.selfServe,
            firstTouch: {
              source: 'direct',
              medium: 'none',
              campaign: null,
              referrer: null,
              direct: true,
              landingPath: '/',
              firstTouchedAt: new Date().toISOString(),
            },
          })
        ).status,
        200,
      )
      const immutableFirstTouch =
        await prisma.analyticsAcquisition.findUniqueOrThrow({
          where: {
            anonymousAcquisitionId: acquisitionIds.selfServe,
          },
        })
      assert.equal(immutableFirstTouch.firstSource, 'Instagram')
      assert.equal(immutableFirstTouch.firstMedium, 'paid social')

      const flowEvents = await prisma.analyticsEvent.findMany({
        where: {
          eventName: {
            in: ['owner_signup_started', 'owner_otp_verified'],
          },
          acquisition: {
            anonymousAcquisitionId: {
              in: [
                acquisitionIds.selfServe,
                acquisitionIds.pending,
                acquisitionIds.claim,
              ],
            },
          },
        },
        select: { properties: true },
      })
      assert.deepEqual(
        new Set(
          flowEvents.map(
            (event) =>
              (event.properties as { flow: string }).flow,
          ),
        ),
        new Set(['selfServe', 'pendingPhone', 'claim']),
      )

      // Restaurant established is derived from durable ownership state. No
      // restaurant_established analytics event is created.
      assert.equal(
        await isRestaurantEstablishedForAcquisition(
          acquisitionIds.selfServe,
          'selfServe',
        ),
        false,
      )
      const selfServeProfile =
        await prisma.restaurantOwnerProfile.create({
          data: {
            userId: selfServeAuth.body.user.id,
            restaurantName: `Self Serve ${runId}`,
            slug: `self-serve-${runId}`,
          },
        })
      await prisma.restaurantMember.create({
        data: {
          restaurantId: selfServeProfile.id,
          userId: selfServeAuth.body.user.id,
          phoneNumber: phones.selfServe,
          role: 'owner',
          status: 'active',
        },
      })
      assert.equal(
        await isRestaurantEstablishedForAcquisition(
          acquisitionIds.selfServe,
          'selfServe',
        ),
        true,
      )

      assert.equal(
        await isRestaurantEstablishedForAcquisition(
          acquisitionIds.pending,
          'pendingPhone',
        ),
        true,
      )

      assert.equal(
        await isRestaurantEstablishedForAcquisition(
          acquisitionIds.claim,
          'claim',
        ),
        false,
      )
      const claimProfileUser = await prisma.user.create({
        data: {
          email: `claim-profile-${runId}@example.test`,
          fullName: 'Claim Profile Holder',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(claimProfileUser.id)
      const claimProfile = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: claimProfileUser.id,
          restaurantName: `Claim ${runId}`,
          slug: `claim-${runId}`,
          claim: {
            create: {
              tokenHash: `hash-${runId}`,
              claimedAt: new Date(),
            },
          },
          members: {
            create: {
              userId: claimAuth.body.user.id,
              phoneNumber: phones.claim,
              role: 'owner',
              status: 'active',
            },
          },
        },
      })
      assert.ok(claimProfile.id)
      assert.equal(
        await isRestaurantEstablishedForAcquisition(
          acquisitionIds.claim,
          'claim',
        ),
        true,
      )

      assert.equal(
        await prisma.analyticsEvent.count({
          where: { eventName: 'restaurant_established' },
        }),
        0,
      )
    } finally {
      await prisma.analyticsAcquisition.deleteMany({
        where: {
          anonymousAcquisitionId: {
            in: Object.values(acquisitionIds),
          },
        },
      })
      await prisma.otpVerification.deleteMany({
        where: {
          phoneNumber: {
            in: Object.values(phones),
          },
        },
      })
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: {
            id: {
              in: createdUserIds,
            },
          },
        })
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
      await prisma.$disconnect()
    }
  },
)
