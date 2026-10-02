import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
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
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run analytics hardening tests against DATABASE_URL.',
    )
  }
  if (regularDatabaseUrl && testDatabaseUrl === regularDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run analytics hardening tests against the normal app database.',
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

async function readJson<T>(response: Response) {
  const value = await response.text()
  return {
    status: response.status,
    body: value ? (JSON.parse(value) as T) : ({} as T),
  }
}

test(
  'Hiring Ready and Candidate Received remain historical milestones',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run analytics hardening tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'analytics-hardening-test-secret'

    const [
      { app },
      { prisma },
      { signAuthToken },
      {
        recordCandidateReceived,
        recordCandidateReceivedBestEffort,
      },
      { getAdminAcquisitionFunnelReport },
    ] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js'),
      import('../lib/jwt.js'),
      import('../services/analytics.service.js'),
      import('../services/adminAnalytics.service.js'),
    ])

    const server = createServer(app)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${address.port}/api`
    const runId = randomUUID()
    const compactRunId = runId.replaceAll('-', '')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const campaign = `milestone_${runId}`
    const createdUserIds: string[] = []
    const createdRestaurantIds: string[] = []
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

    try {
      const owner = await prisma.user.create({
        data: {
          phoneNumber: `+97250${compactRunId.slice(0, 7)}`,
          phoneVerifiedAt: now,
          fullName: 'Milestone Owner',
          track: 'restaurantOwner',
        },
      })
      const hiringManager = await prisma.user.create({
        data: {
          phoneNumber: `+97252${compactRunId.slice(0, 7)}`,
          phoneVerifiedAt: now,
          fullName: 'Earlier Hiring Manager',
          track: 'restaurantOwner',
        },
      })
      const worker = await prisma.user.create({
        data: {
          phoneNumber: `+97254${compactRunId.slice(0, 7)}`,
          phoneVerifiedAt: now,
          fullName: 'Milestone Worker',
          track: 'restaurant',
        },
      })
      createdUserIds.push(owner.id, hiringManager.id, worker.id)

      const restaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: owner.id,
          restaurantName: `Milestone Restaurant ${runId}`,
          slug: `milestone-${runId}`,
          qrEnabledRoles: ['waiter'],
        },
      })
      createdRestaurantIds.push(restaurant.id)

      // The manager is deliberately inserted first. Restaurant analytics must
      // still prefer the active owner, matching product access/reporting rules.
      await prisma.restaurantMember.create({
        data: {
          restaurantId: restaurant.id,
          userId: hiringManager.id,
          phoneNumber: hiringManager.phoneNumber!,
          role: 'hiringManager',
          status: 'active',
        },
      })
      await prisma.restaurantMember.create({
        data: {
          restaurantId: restaurant.id,
          userId: owner.id,
          phoneNumber: owner.phoneNumber!,
          role: 'owner',
          status: 'active',
        },
      })

      const ownerAcquisition = await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: randomUUID(),
          userId: owner.id,
          firstSource: 'instagram',
          firstMedium: 'social',
          firstCampaign: campaign,
          firstReferrer: 'instagram.com',
          direct: false,
          firstLandingPath: '/register',
          firstTouchedAt: now,
          expiresAt,
          events: {
            create: [
              {
                clientEventId: randomUUID(),
                eventName: 'owner_signup_started',
                occurredAt: now,
                route: '/register',
                properties: { flow: 'selfServe' },
                expiresAt,
              },
              {
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
              {
                clientEventId: randomUUID(),
                eventName: 'hiring_roles_updated',
                occurredAt: now,
                route: '/owner/jobs',
                properties: { roleCount: 1 },
                expiresAt,
              },
            ],
          },
        },
      })
      createdAcquisitionIds.push(ownerAcquisition.id)

      const managerAcquisition = await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: randomUUID(),
          userId: hiringManager.id,
          firstSource: 'direct',
          firstMedium: 'none',
          firstCampaign: null,
          firstReferrer: null,
          direct: true,
          firstLandingPath: '/register',
          firstTouchedAt: new Date(now.getTime() - 60_000),
          expiresAt,
        },
      })
      createdAcquisitionIds.push(managerAcquisition.id)

      const workerToken = signAuthToken(worker.id)
      const leadResponse = await post<{ ok: boolean }>(
        `/public/restaurants/${restaurant.slug}/verified-leads`,
        {
          wantedRoles: ['waiter'],
          experienceText: 'One year',
          availability: 'Evenings',
          age: 24,
        },
        workerToken,
      )
      assert.equal(leadResponse.status, 201)

      const lead = await prisma.restaurantCandidateLead.findFirstOrThrow({
        where: {
          ownerProfileId: restaurant.id,
          phoneNumber: worker.phoneNumber!,
        },
      })

      const duplicateLeadResponse = await post<{ ok: boolean }>(
        `/public/restaurants/${restaurant.slug}/verified-leads`,
        {
          wantedRoles: ['waiter'],
          experienceText: 'Retry',
          availability: 'Evenings',
          age: 24,
        },
        workerToken,
      )
      assert.equal(duplicateLeadResponse.status, 200)

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

      const applicationResponse = await post<{
        application: { id: string }
      }>(
        '/restaurant/applications',
        { restaurantJobId: job.id },
        workerToken,
      )
      assert.equal(applicationResponse.status, 201)

      const duplicateApplicationResponse = await post(
        '/restaurant/applications',
        { restaurantJobId: job.id },
        workerToken,
      )
      assert.equal(duplicateApplicationResponse.status, 201)

      const application =
        await prisma.restaurantApplication.findUniqueOrThrow({
          where: {
            userId_restaurantJobId: {
              userId: worker.id,
              restaurantJobId: job.id,
            },
          },
        })

      const receiptEvents = await prisma.analyticsEvent.findMany({
        where: {
          acquisitionId: ownerAcquisition.id,
          eventName: 'candidate_received',
        },
        orderBy: { occurredAt: 'asc' },
        select: { properties: true },
      })
      assert.equal(receiptEvents.length, 2)
      assert.deepEqual(
        new Set(
          receiptEvents.map(
            (event) =>
              (event.properties as { candidateSource: string })
                .candidateSource,
          ),
        ),
        new Set(['external', 'jobBoard']),
      )
      assert.ok(
        receiptEvents.every(
          (event) => Object.keys(event.properties as object).length === 1,
        ),
      )
      assert.equal(
        await prisma.analyticsEvent.count({
          where: {
            acquisitionId: managerAcquisition.id,
            eventName: 'candidate_received',
          },
        }),
        0,
        'an earlier hiring-manager membership must not receive owner milestones',
      )

      const repeatedRecord = await recordCandidateReceived({
        restaurantId: restaurant.id,
        candidateSource: 'external',
        candidateRecordId: lead.id,
        occurredAt: lead.createdAt,
      })
      assert.equal(repeatedRecord.status, 'duplicate')
      assert.equal(
        await prisma.analyticsEvent.count({
          where: {
            acquisitionId: ownerAcquisition.id,
            eventName: 'candidate_received',
          },
        }),
        2,
      )

      const reportWithCurrentRecords =
        await getAdminAcquisitionFunnelReport({ campaign })
      assert.deepEqual(reportWithCurrentRecords.candidateSources, {
        external: 1,
        jobBoard: 1,
      })

      await prisma.restaurantCandidateLead.delete({ where: { id: lead.id } })
      await prisma.restaurantApplication.delete({
        where: { id: application.id },
      })
      await prisma.restaurantOwnerProfile.update({
        where: { id: restaurant.id },
        data: { qrEnabledRoles: [] },
      })

      const report = await getAdminAcquisitionFunnelReport({ campaign })
      const stage = (key: string) =>
        report.funnel.find((item) => item.key === key)
      assert.equal(stage('hiringReady')?.count, 1)
      assert.equal(stage('candidateReceived')?.count, 1)
      assert.deepEqual(report.candidateSources, {
        external: 1,
        jobBoard: 1,
      })

      const clientAttempt = await post('/analytics/events', {
        anonymousAcquisitionId: ownerAcquisition.anonymousAcquisitionId,
        clientEventId: randomUUID(),
        eventName: 'candidate_received',
        occurredAt: new Date().toISOString(),
        properties: { candidateSource: 'external' },
      })
      assert.equal(clientAttempt.status, 400)

      let failureWasLogged = false
      const failedAnalytics = await recordCandidateReceivedBestEffort(
        {
          restaurantId: restaurant.id,
          candidateSource: 'external',
          candidateRecordId: randomUUID(),
          occurredAt: new Date(),
        },
        {
          record: async () => {
            throw new Error('simulated analytics failure')
          },
          logError: () => {
            failureWasLogged = true
          },
        },
      )
      assert.equal(failedAnalytics.status, 'failed')
      assert.equal(failureWasLogged, true)

      const untrackedOwner = await prisma.user.create({
        data: {
          phoneNumber: `+97258${compactRunId.slice(0, 7)}`,
          phoneVerifiedAt: now,
          fullName: 'Untracked Owner',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(untrackedOwner.id)
      const untrackedRestaurant =
        await prisma.restaurantOwnerProfile.create({
          data: {
            userId: untrackedOwner.id,
            restaurantName: `Untracked Restaurant ${runId}`,
            slug: `untracked-${runId}`,
            qrEnabledRoles: ['waiter'],
            members: {
              create: {
                userId: untrackedOwner.id,
                phoneNumber: untrackedOwner.phoneNumber!,
                role: 'owner',
                status: 'active',
              },
            },
          },
        })
      createdRestaurantIds.push(untrackedRestaurant.id)

      const noAcquisitionResponse = await post<{ ok: boolean }>(
        `/public/restaurants/${untrackedRestaurant.slug}/verified-leads`,
        {
          wantedRoles: ['waiter'],
          experienceText: '',
          availability: '',
          age: 24,
        },
        workerToken,
      )
      assert.equal(
        noAcquisitionResponse.status,
        201,
        'missing analytics attribution must not block candidate creation',
      )
    } finally {
      if (createdJobIds.length > 0) {
        await prisma.restaurantJob.deleteMany({
          where: { id: { in: createdJobIds } },
        })
      }
      if (createdRestaurantIds.length > 0) {
        await prisma.restaurantOwnerProfile.deleteMany({
          where: { id: { in: createdRestaurantIds } },
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
