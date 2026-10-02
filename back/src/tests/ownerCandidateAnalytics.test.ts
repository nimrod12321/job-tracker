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
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run candidate analytics tests against DATABASE_URL.',
    )
  }
  if (regularDatabaseUrl && testDatabaseUrl === regularDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run candidate analytics tests against the normal app database.',
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

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  const value = await response.text()
  return {
    status: response.status,
    body: value ? (JSON.parse(value) as T) : ({} as T),
  }
}

test(
  'candidate value analytics derive durable receipt/source and validate owner actions',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run candidate analytics tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'owner-candidate-analytics-test-secret'

    const [
      { app },
      { prisma },
      { signAuthToken },
      { hasCandidateReceived, resolveCandidateSourceForRestaurant },
    ] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js'),
      import('../lib/jwt.js'),
      import('../services/analytics.service.js'),
    ])

    const server = createServer(app)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${address.port}/api`
    const runId = randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const createdUserIds: string[] = []
    const createdAcquisitionIds: string[] = []
    const createdJobIds: string[] = []

    async function post<T>(path: string, body: unknown, token?: string) {
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

    function candidateEvent(
      eventName: 'candidate_card_opened' | 'candidate_contact_initiated',
      candidateReference: {
        kind: 'externalLead' | 'jobApplication'
        id: string
      },
      properties: Record<string, string> = {},
      clientEventId = randomUUID(),
    ) {
      return {
        clientEventId,
        eventName,
        occurredAt: new Date().toISOString(),
        route: '/owner/applications',
        candidateReference,
        properties,
      }
    }

    try {
      const owner = await prisma.user.create({
        data: {
          phoneNumber: `+97250${runId.replaceAll('-', '').slice(0, 7)}`,
          phoneVerifiedAt: now,
          fullName: 'Stage 4 Owner',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(owner.id)
      const restaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: owner.id,
          restaurantName: `Stage 4 ${runId}`,
          slug: `stage-4-${runId}`,
          city: 'Tel Aviv',
          street: 'Dizengoff',
          members: {
            create: {
              userId: owner.id,
              phoneNumber: owner.phoneNumber!,
              role: 'owner',
              status: 'active',
            },
          },
        },
      })
      const acquisition = await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: randomUUID(),
          userId: owner.id,
          firstSource: 'Instagram',
          firstMedium: 'paid social',
          firstCampaign: 'stage_4_test',
          firstReferrer: 'instagram.com',
          direct: false,
          firstLandingPath: '/register',
          firstTouchedAt: now,
          expiresAt,
          events: {
            create: {
              clientEventId: randomUUID(),
              eventName: 'owner_otp_verified',
              occurredAt: now,
              route: '/register',
              properties: {
                flow: 'selfServe',
                purpose: 'register',
                newAccount: true,
              },
              expiresAt,
            },
          },
        },
      })
      createdAcquisitionIds.push(acquisition.id)

      const otherOwner = await prisma.user.create({
        data: {
          phoneNumber: `+97252${runId.replaceAll('-', '').slice(0, 7)}`,
          phoneVerifiedAt: now,
          fullName: 'Other Stage 4 Owner',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(otherOwner.id)
      const otherRestaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: otherOwner.id,
          restaurantName: `Other Stage 4 ${runId}`,
          slug: `other-stage-4-${runId}`,
          members: {
            create: {
              userId: otherOwner.id,
              phoneNumber: otherOwner.phoneNumber!,
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
          fullName: 'Stage 4 Worker',
          track: 'restaurant',
          restaurantWorkerProfile: {
            create: {
              fullName: 'Stage 4 Worker',
              phoneNumber: `+97254${runId.replaceAll('-', '').slice(0, 7)}`,
              wantedRoles: ['waiter'],
            },
          },
        },
      })
      createdUserIds.push(worker.id)

      assert.equal(await hasCandidateReceived(restaurant.id), false)

      const externalCandidate = await prisma.restaurantCandidateLead.create({
        data: {
          ownerProfileId: restaurant.id,
          fullName: 'External Candidate',
          phoneNumber: '+972501111111',
          wantedRoles: ['waiter'],
          source: 'qr',
        },
      })
      assert.equal(await hasCandidateReceived(restaurant.id), true)
      assert.equal(
        await resolveCandidateSourceForRestaurant(restaurant.id, {
          kind: 'externalLead',
          id: externalCandidate.id,
        }),
        'external',
      )

      await prisma.restaurantCandidateLead.delete({
        where: { id: externalCandidate.id },
      })
      assert.equal(await hasCandidateReceived(restaurant.id), false)

      const job = await prisma.restaurantJob.create({
        data: {
          ownerProfileId: restaurant.id,
          restaurantName: restaurant.restaurantName,
          role: 'waiter',
          location: 'Tel Aviv',
          kind: 'posted',
          isActive: true,
        },
      })
      createdJobIds.push(job.id)
      const jobApplication = await prisma.restaurantApplication.create({
        data: {
          userId: worker.id,
          restaurantJobId: job.id,
        },
      })
      assert.equal(await hasCandidateReceived(restaurant.id), true)
      assert.equal(
        await resolveCandidateSourceForRestaurant(restaurant.id, {
          kind: 'jobApplication',
          id: jobApplication.id,
        }),
        'jobBoard',
      )

      const restoredExternalCandidate =
        await prisma.restaurantCandidateLead.create({
          data: {
            ownerProfileId: restaurant.id,
            fullName: 'External Candidate',
            phoneNumber: '+972501111111',
            wantedRoles: ['waiter'],
            source: 'qr',
          },
        })
      const otherCandidate = await prisma.restaurantCandidateLead.create({
        data: {
          ownerProfileId: otherRestaurant.id,
          fullName: 'Other Candidate',
          phoneNumber: '+972502222222',
          wantedRoles: ['host'],
          source: 'qr',
        },
      })

      const ownerToken = signAuthToken(owner.id)
      const workerToken = signAuthToken(worker.id)

      const openEvent = candidateEvent('candidate_card_opened', {
        kind: 'externalLead',
        id: restoredExternalCandidate.id,
      })
      const opened = await post<{ created: boolean }>(
        '/analytics/owner-events',
        openEvent,
        ownerToken,
      )
      assert.equal(opened.status, 201)
      assert.equal(opened.body.created, true)

      const repeatedOpen = await post<{ created: boolean }>(
        '/analytics/owner-events',
        openEvent,
        ownerToken,
      )
      assert.equal(repeatedOpen.status, 200)
      assert.equal(repeatedOpen.body.created, false)

      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            candidateEvent(
              'candidate_contact_initiated',
              { kind: 'jobApplication', id: jobApplication.id },
              { channel: 'phone' },
            ),
            ownerToken,
          )
        ).status,
        201,
      )
      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            candidateEvent(
              'candidate_contact_initiated',
              { kind: 'externalLead', id: restoredExternalCandidate.id },
              { channel: 'whatsapp' },
            ),
            ownerToken,
          )
        ).status,
        201,
      )

      const events = await prisma.analyticsEvent.findMany({
        where: {
          acquisitionId: acquisition.id,
          eventName: {
            in: ['candidate_card_opened', 'candidate_contact_initiated'],
          },
        },
        select: { eventName: true, properties: true },
      })
      assert.equal(events.length, 3)
      assert.deepEqual(
        events.find((event) => event.eventName === 'candidate_card_opened')
          ?.properties,
        { candidateSource: 'external' },
      )
      assert.deepEqual(
        events.find(
          (event) =>
            event.eventName === 'candidate_contact_initiated' &&
            (event.properties as Record<string, unknown>).channel === 'phone',
        )?.properties,
        { channel: 'phone', candidateSource: 'jobBoard' },
      )
      assert.deepEqual(
        events.find(
          (event) =>
            event.eventName === 'candidate_contact_initiated' &&
            (event.properties as Record<string, unknown>).channel ===
              'whatsapp',
        )?.properties,
        { channel: 'whatsapp', candidateSource: 'external' },
      )
      assert.equal(JSON.stringify(events).includes('phoneNumber'), false)
      assert.equal(JSON.stringify(events).includes('fullName'), false)

      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            candidateEvent(
              'candidate_card_opened',
              { kind: 'externalLead', id: otherCandidate.id },
            ),
            ownerToken,
          )
        ).status,
        404,
      )
      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            candidateEvent(
              'candidate_card_opened',
              { kind: 'externalLead', id: restoredExternalCandidate.id },
              { candidateSource: 'jobBoard' },
            ),
            ownerToken,
          )
        ).status,
        400,
      )
      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            candidateEvent(
              'candidate_contact_initiated',
              { kind: 'externalLead', id: restoredExternalCandidate.id },
              { channel: 'phone', candidateName: 'Do not store me' },
            ),
            ownerToken,
          )
        ).status,
        400,
      )
      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            candidateEvent('candidate_card_opened', {
              kind: 'externalLead',
              id: restoredExternalCandidate.id,
            }),
            workerToken,
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            candidateEvent('candidate_card_opened', {
              kind: 'externalLead',
              id: restoredExternalCandidate.id,
            }),
          )
        ).status,
        401,
      )
      assert.equal(
        (
          await post('/analytics/events', {
            anonymousAcquisitionId: acquisition.anonymousAcquisitionId,
            clientEventId: randomUUID(),
            eventName: 'candidate_card_opened',
            occurredAt: new Date().toISOString(),
            route: '/owner/applications',
            properties: {},
          })
        ).status,
        403,
      )

      const leadAfterAnalytics =
        await prisma.restaurantCandidateLead.findUniqueOrThrow({
          where: { id: restoredExternalCandidate.id },
        })
      assert.equal(
        leadAfterAnalytics.ownerViewedAt,
        null,
        'candidate analytics must not change ownerViewedAt semantics',
      )

      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            {
              clientEventId: randomUUID(),
              eventName: 'recruitment_kit_opened',
              occurredAt: new Date().toISOString(),
              route: '/owner/jobs',
              properties: {},
            },
            ownerToken,
          )
        ).status,
        201,
      )

      const persistedAcquisition =
        await prisma.analyticsAcquisition.findUniqueOrThrow({
          where: { id: acquisition.id },
        })
      assert.equal(persistedAcquisition.firstSource, 'Instagram')
      assert.equal(persistedAcquisition.firstCampaign, 'stage_4_test')
    } finally {
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
