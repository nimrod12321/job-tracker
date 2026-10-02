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
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run Admin analytics tests against DATABASE_URL.',
    )
  }
  if (regularDatabaseUrl && testDatabaseUrl === regularDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run Admin analytics tests against the normal app database.',
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

type FunnelReport = {
  cohort: { basis: string; count: number }
  funnel: Array<{
    key: string
    count: number
    conversionFromPrevious: number | null
  }>
  currentStageCounts: Record<string, number>
  byAttribution: Array<{
    source: string
    medium: string
    campaign: string | null
    stages: Record<string, number>
  }>
  signupFlows: {
    selfServe: number
    claim: number
    pendingPhone: number
    unknown: number
  }
  candidateSources: { external: number; jobBoard: number }
}

type StageDetailsReport = {
  stage: string
  filters: {
    source: string | null
    medium: string | null
    campaign: string | null
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  rows: Array<{
    acquisitionId: string
    ownerName: string | null
    phoneNumber: string | null
    phoneVerified: boolean
    source: string
    medium: string
    campaign: string | null
    flow: string
    restaurant: { id: string; restaurantName: string } | null
    currentStage: string
    currentStageReachedAt: string | null
    firstTouchedAt: string
    signupStartedAt: string
  }>
}

async function readJson<T>(response: Response) {
  const value = await response.text()
  return {
    status: response.status,
    body: value ? (JSON.parse(value) as T) : ({} as T),
  }
}

test(
  'Admin acquisition funnel reports unique durable progression securely',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run Admin acquisition reporting tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'admin-acquisition-funnel-test-secret'

    const runId = randomUUID()
    const adminEmail = `stage-5-admin-${runId}@example.test`
    process.env.ADMIN_EMAILS = adminEmail

    const [{ app }, { prisma }, { signAuthToken }] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js'),
      import('../lib/jwt.js'),
    ])

    const server = createServer(app)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${address.port}/api`
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const campaign = `restaurant_beta_${runId}`
    const laterCampaign = `later_touch_${runId}`
    const kitOnlyCampaign = `kit_only_${runId}`
    const workerCampaign = `worker_${runId}`
    const referralSource = `ref-${runId}.example.com`
    const unverifiedSignupPhone = '+972599999999'
    const createdUserIds: string[] = []
    const createdAcquisitionIds: string[] = []
    const createdJobIds: string[] = []
    const createdOtpIds: string[] = []

    function analyticsEvent(
      eventName: string,
      properties: Record<string, string | number | boolean> = {},
      occurredAt = now,
    ) {
      return {
        clientEventId: randomUUID(),
        eventName,
        occurredAt,
        route: '/owner/jobs',
        properties,
        expiresAt,
      }
    }

    async function getReport(
      token: string,
      filters: Record<string, string> = {},
    ) {
      const query = new URLSearchParams(filters)
      const suffix = query.size ? `?${query.toString()}` : ''
      return readJson<FunnelReport>(
        await fetch(
          `${baseUrl}/admin/analytics/acquisition-funnel${suffix}`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      )
    }

    async function getStageDetails(
      token: string,
      stageKey: string,
      filters: Record<string, string> = {},
    ) {
      const query = new URLSearchParams(filters)
      const suffix = query.size ? `?${query.toString()}` : ''
      return readJson<StageDetailsReport>(
        await fetch(
          `${baseUrl}/admin/analytics/acquisition-funnel/stage/${stageKey}${suffix}`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      )
    }

    function stage(report: FunnelReport, key: string) {
      return report.funnel.find((item) => item.key === key)
    }

    try {
      const admin = await prisma.user.create({
        data: { email: adminEmail, fullName: 'Stage 5 Admin' },
      })
      createdUserIds.push(admin.id)
      const nonAdmin = await prisma.user.create({
        data: {
          email: `stage-5-user-${runId}@example.test`,
          fullName: 'Not Admin',
        },
      })
      createdUserIds.push(nonAdmin.id)

      const selfServeOwner = await prisma.user.create({
        data: {
          phoneNumber: `+97250${runId.replaceAll('-', '').slice(0, 7)}`,
          phoneVerifiedAt: now,
          fullName: 'Instagram Owner',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(selfServeOwner.id)
      const selfServeRestaurant =
        await prisma.restaurantOwnerProfile.create({
          data: {
            userId: selfServeOwner.id,
            restaurantName: `Instagram Restaurant ${runId}`,
            slug: `instagram-${runId}`,
            // Current state is deliberately off. The historical role event
            // below must keep Hiring Ready reached in the funnel.
            qrEnabledRoles: [],
            members: {
              create: {
                userId: selfServeOwner.id,
                phoneNumber: selfServeOwner.phoneNumber!,
                role: 'owner',
                status: 'active',
              },
            },
          },
        })

      const worker = await prisma.user.create({
        data: {
          phoneNumber: `+97254${runId.replaceAll('-', '').slice(0, 7)}`,
          phoneVerifiedAt: now,
          fullName: 'Stage 5 Worker',
          track: 'restaurant',
          restaurantWorkerProfile: {
            create: {
              fullName: 'Stage 5 Worker',
              phoneNumber: `+97254${runId.replaceAll('-', '').slice(0, 7)}`,
              wantedRoles: ['waiter'],
            },
          },
        },
      })
      createdUserIds.push(worker.id)
      const workerAcquisition = await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: randomUUID(),
          userId: worker.id,
          firstSource: 'instagram',
          firstMedium: 'social',
          firstCampaign: workerCampaign,
          firstReferrer: 'instagram.com',
          direct: false,
          firstLandingPath: '/register',
          firstTouchedAt: now,
          expiresAt,
          events: {
            create: [
              analyticsEvent('owner_signup_started', { flow: 'selfServe' }),
              analyticsEvent('owner_otp_verified', {
                flow: 'selfServe',
                purpose: 'register',
                newAccount: true,
              }),
            ],
          },
        },
      })
      createdAcquisitionIds.push(workerAcquisition.id)

      const selfServeEvents = [
        analyticsEvent('owner_signup_started', { flow: 'selfServe' }),
        analyticsEvent('owner_signup_started', { flow: 'selfServe' }),
        analyticsEvent('owner_otp_verified', {
          flow: 'selfServe',
          purpose: 'register',
          newAccount: true,
        }),
        analyticsEvent('hiring_roles_updated', { roleCount: 1 }),
        analyticsEvent('recruitment_kit_opened'),
        analyticsEvent('recruitment_kit_opened'),
        analyticsEvent('hiring_link_copied', { method: 'button' }),
        ...Array.from({ length: 10 }, () =>
          analyticsEvent('candidate_card_opened', {
            candidateSource: 'external',
          }),
        ),
        analyticsEvent('candidate_contact_initiated', {
          candidateSource: 'external',
          channel: 'phone',
        }),
        analyticsEvent('candidate_contact_initiated', {
          candidateSource: 'external',
          channel: 'whatsapp',
        }),
      ]
      const selfServeAcquisition = await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: randomUUID(),
          userId: selfServeOwner.id,
          firstSource: 'instagram',
          firstMedium: 'social',
          firstCampaign: campaign,
          firstReferrer: 'instagram.com',
          direct: false,
          firstLandingPath: '/register',
          firstTouchedAt: now,
          expiresAt,
          events: { create: selfServeEvents },
        },
      })
      createdAcquisitionIds.push(selfServeAcquisition.id)

      const laterAcquisition = await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: randomUUID(),
          userId: selfServeOwner.id,
          firstSource: 'later-source',
          firstMedium: 'later-medium',
          firstCampaign: laterCampaign,
          firstReferrer: 'later.example.com',
          direct: false,
          firstLandingPath: '/register',
          firstTouchedAt: new Date(now.getTime() + 60 * 60 * 1000),
          expiresAt,
          events: {
            create: analyticsEvent(
              'owner_signup_started',
              { flow: 'selfServe' },
              new Date(now.getTime() + 60 * 60 * 1000),
            ),
          },
        },
      })
      createdAcquisitionIds.push(laterAcquisition.id)

      await prisma.restaurantCandidateLead.create({
        data: {
          ownerProfileId: selfServeRestaurant.id,
          fullName: 'External Candidate',
          phoneNumber: '+972501234567',
          wantedRoles: ['waiter'],
          source: 'qr',
        },
      })
      const job = await prisma.restaurantJob.create({
        data: {
          ownerProfileId: selfServeRestaurant.id,
          restaurantName: selfServeRestaurant.restaurantName,
          role: 'waiter',
          location: 'Tel Aviv',
          kind: 'posted',
        },
      })
      createdJobIds.push(job.id)
      await prisma.restaurantApplication.create({
        data: { userId: worker.id, restaurantJobId: job.id },
      })

      const claimOwner = await prisma.user.create({
        data: {
          phoneNumber: `+97252${runId.replaceAll('-', '').slice(0, 7)}`,
          phoneVerifiedAt: now,
          fullName: '',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(claimOwner.id)
      const preparedRestaurantUser = await prisma.user.create({
        data: {
          email: `prepared-${runId}@example.test`,
          fullName: 'Prepared Restaurant Account',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(preparedRestaurantUser.id)
      await prisma.restaurantOwnerProfile.create({
        data: {
          userId: preparedRestaurantUser.id,
          restaurantName: `Claim Restaurant ${runId}`,
          slug: `claim-${runId}`,
          qrEnabledRoles: [],
          claim: {
            create: {
              tokenHash: `stage-5-claim-${runId}`,
              claimedAt: now,
            },
          },
          members: {
            create: {
              userId: claimOwner.id,
              phoneNumber: claimOwner.phoneNumber!,
              role: 'owner',
              status: 'active',
            },
          },
        },
      })
      const claimAcquisition = await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: randomUUID(),
          userId: claimOwner.id,
          firstSource: 'direct',
          firstMedium: 'none',
          firstCampaign: null,
          firstReferrer: null,
          direct: true,
          firstLandingPath: '/claim/example',
          firstTouchedAt: now,
          expiresAt,
          events: {
            create: [
              analyticsEvent('owner_signup_started', { flow: 'claim' }),
              analyticsEvent('owner_otp_verified', {
                flow: 'claim',
                purpose: 'register',
                newAccount: true,
              }),
            ],
          },
        },
      })
      createdAcquisitionIds.push(claimAcquisition.id)

      const pendingAcquisition = await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: randomUUID(),
          firstSource: referralSource,
          firstMedium: 'referral',
          firstCampaign: campaign,
          firstReferrer: referralSource,
          direct: false,
          firstLandingPath: '/register',
          firstTouchedAt: now,
          expiresAt,
          events: {
            create: analyticsEvent('owner_signup_started', {
              flow: 'pendingPhone',
            }),
          },
        },
      })
      createdAcquisitionIds.push(pendingAcquisition.id)
      const unverifiedOtp = await prisma.otpVerification.create({
        data: {
          phoneNumber: unverifiedSignupPhone,
          codeHash: 'unverified-phone-must-not-be-reported',
          purpose: 'register',
          expiresAt,
        },
      })
      createdOtpIds.push(unverifiedOtp.id)

      const kitOnlyAcquisition = await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: randomUUID(),
          firstSource: 'newsletter',
          firstMedium: 'email',
          firstCampaign: kitOnlyCampaign,
          firstReferrer: 'example.com',
          direct: false,
          firstLandingPath: '/register',
          firstTouchedAt: now,
          expiresAt,
          events: {
            create: [
              analyticsEvent('owner_signup_started', { flow: 'selfServe' }),
              analyticsEvent('recruitment_kit_opened'),
            ],
          },
        },
      })
      createdAcquisitionIds.push(kitOnlyAcquisition.id)

      const adminToken = signAuthToken(admin.id)
      const nonAdminToken = signAuthToken(nonAdmin.id)

      const instagram = await getReport(adminToken, {
        source: 'instagram',
        medium: 'social',
        campaign,
      })
      assert.equal(instagram.status, 200)
      assert.equal(instagram.body.cohort.basis, 'owner_signup_started')
      assert.equal(instagram.body.cohort.count, 1)
      for (const key of [
        'ownerSignupStarted',
        'otpVerified',
        'restaurantEstablished',
        'hiringReady',
        'recruitmentKitOpened',
        'recruitmentAssetUsed',
        'candidateReceived',
        'candidateCardOpened',
        'contactInitiated',
      ]) {
        assert.equal(stage(instagram.body, key)?.count, 1)
      }
      assert.equal(stage(instagram.body, 'ownerSignupStarted')?.conversionFromPrevious, null)
      assert.equal(stage(instagram.body, 'otpVerified')?.conversionFromPrevious, 100)
      assert.equal(instagram.body.signupFlows.selfServe, 1)
      assert.deepEqual(instagram.body.candidateSources, {
        external: 1,
        jobBoard: 1,
      })
      assert.equal(instagram.body.currentStageCounts.contactInitiated, 1)
      assert.equal(
        Object.values(instagram.body.currentStageCounts).reduce(
          (total, count) => total + count,
          0,
        ),
        1,
      )
      assert.deepEqual(instagram.body.byAttribution, [
        {
          source: 'instagram',
          medium: 'social',
          campaign,
          stages: Object.fromEntries(
            instagram.body.funnel.map((item) => [item.key, 1]),
          ),
        },
      ])

      const laterTouch = await getReport(adminToken, {
        campaign: laterCampaign,
      })
      assert.equal(
        laterTouch.body.cohort.count,
        0,
        'a later acquisition linked to the same owner is not a second cohort',
      )

      const kitOnly = await getReport(adminToken, {
        campaign: kitOnlyCampaign,
      })
      assert.equal(stage(kitOnly.body, 'recruitmentKitOpened')?.count, 1)
      assert.equal(stage(kitOnly.body, 'recruitmentAssetUsed')?.count, 0)
      assert.equal(kitOnly.body.currentStageCounts.recruitmentKitOpened, 1)

      const kitDetails = await getStageDetails(
        adminToken,
        'recruitmentKitOpened',
        { campaign: kitOnlyCampaign },
      )
      assert.equal(kitDetails.status, 200)
      assert.equal(kitDetails.body.pagination.total, 1)
      assert.equal(kitDetails.body.rows[0]?.campaign, kitOnlyCampaign)
      assert.equal(
        kitDetails.body.rows[0]?.currentStage,
        'recruitmentKitOpened',
      )

      const referral = await getReport(adminToken, { source: referralSource })
      assert.equal(referral.body.signupFlows.pendingPhone, 1)
      assert.deepEqual(
        referral.body.byAttribution.map((group) => ({
          source: group.source,
          medium: group.medium,
        })),
        [{ source: referralSource, medium: 'referral' }],
      )
      assert.equal(referral.body.currentStageCounts.ownerSignupStarted, 1)

      const signupOnlyDetails = await getStageDetails(
        adminToken,
        'ownerSignupStarted',
        { source: referralSource, medium: 'referral', campaign },
      )
      assert.equal(signupOnlyDetails.status, 200)
      assert.equal(signupOnlyDetails.body.pagination.total, 1)
      assert.equal(signupOnlyDetails.body.rows[0]?.ownerName, null)
      assert.equal(signupOnlyDetails.body.rows[0]?.phoneNumber, null)
      assert.equal(signupOnlyDetails.body.rows[0]?.phoneVerified, false)
      assert.equal(signupOnlyDetails.body.rows[0]?.restaurant, null)
      assert.equal(signupOnlyDetails.body.rows[0]?.flow, 'pendingPhone')
      assert.equal(
        JSON.stringify(signupOnlyDetails.body).includes(unverifiedSignupPhone),
        false,
      )

      const direct = await getReport(adminToken, {
        source: 'direct',
        medium: 'none',
      })
      assert.equal(direct.status, 200)
      assert.ok(direct.body.signupFlows.claim >= 1)
      assert.ok(
        direct.body.byAttribution.some(
          (group) =>
            group.source === 'direct' &&
            group.medium === 'none' &&
            group.campaign === null,
        ),
      )
      assert.equal(direct.body.currentStageCounts.restaurantEstablished, 1)

      const directDetails = await getStageDetails(
        adminToken,
        'restaurantEstablished',
        { source: 'direct', medium: 'none' },
      )
      assert.equal(directDetails.status, 200)
      assert.equal(directDetails.body.pagination.total, 1)
      assert.equal(directDetails.body.rows[0]?.ownerName, null)
      assert.equal(
        directDetails.body.rows[0]?.phoneNumber,
        claimOwner.phoneNumber,
      )
      assert.equal(directDetails.body.rows[0]?.phoneVerified, true)
      assert.equal(
        directDetails.body.rows[0]?.restaurant?.restaurantName,
        `Claim Restaurant ${runId}`,
      )
      assert.ok(directDetails.body.rows[0]?.currentStageReachedAt)

      const instagramDetails = await getStageDetails(
        adminToken,
        'contactInitiated',
        { source: 'instagram', medium: 'social', campaign },
      )
      assert.equal(instagramDetails.status, 200)
      assert.equal(
        instagramDetails.body.pagination.total,
        instagram.body.currentStageCounts.contactInitiated,
      )
      assert.equal(instagramDetails.body.rows.length, 1)
      assert.equal(instagramDetails.body.rows[0]?.ownerName, 'Instagram Owner')
      assert.equal(instagramDetails.body.rows[0]?.source, 'instagram')
      assert.equal(instagramDetails.body.rows[0]?.medium, 'social')
      assert.equal(instagramDetails.body.rows[0]?.campaign, campaign)
      assert.equal(instagramDetails.body.rows[0]?.flow, 'selfServe')
      assert.ok(instagramDetails.body.rows[0]?.currentStageReachedAt)
      const serializedDetails = JSON.stringify(instagramDetails.body)
      assert.equal(serializedDetails.includes('External Candidate'), false)
      assert.equal(serializedDetails.includes('+972501234567'), false)

      const workerReport = await getReport(adminToken, {
        campaign: workerCampaign,
      })
      assert.equal(workerReport.status, 200)
      assert.equal(workerReport.body.cohort.count, 0)
      const workerDetails = await getStageDetails(
        adminToken,
        'otpVerified',
        { campaign: workerCampaign },
      )
      assert.equal(workerDetails.status, 200)
      assert.equal(workerDetails.body.pagination.total, 0)

      const empty = await getReport(adminToken, {
        campaign: `missing-${runId}`,
      })
      assert.equal(empty.status, 200)
      assert.equal(empty.body.cohort.count, 0)
      assert.ok(empty.body.funnel.every((item) => item.count === 0))
      assert.ok(
        empty.body.funnel.every(
          (item) => item.conversionFromPrevious === null,
        ),
      )
      assert.ok(
        Object.values(empty.body.currentStageCounts).every(
          (count) => count === 0,
        ),
      )

      assert.equal((await getReport(nonAdminToken)).status, 403)
      assert.equal((await getReport('')).status, 401)
      assert.equal(
        (
          await getStageDetails(nonAdminToken, 'otpVerified', {
            campaign,
          })
        ).status,
        403,
      )
      assert.equal(
        (await getStageDetails('', 'otpVerified', { campaign })).status,
        401,
      )
      assert.equal(
        (await getStageDetails(adminToken, 'notAStage')).status,
        400,
      )

      const persistedFirstTouch =
        await prisma.analyticsAcquisition.findUniqueOrThrow({
          where: { id: selfServeAcquisition.id },
        })
      assert.equal(persistedFirstTouch.firstSource, 'instagram')
      assert.equal(persistedFirstTouch.firstMedium, 'social')
      assert.equal(persistedFirstTouch.firstCampaign, campaign)
    } finally {
      if (createdOtpIds.length > 0) {
        await prisma.otpVerification.deleteMany({
          where: { id: { in: createdOtpIds } },
        })
      }
      if (createdJobIds.length > 0) {
        await prisma.restaurantJob.deleteMany({
          where: { id: { in: createdJobIds } },
        })
      }
      if (createdAcquisitionIds.length > 0) {
        await prisma.analyticsAcquisition.deleteMany({
          where: { id: { in: createdAcquisitionIds } },
        })
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
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
