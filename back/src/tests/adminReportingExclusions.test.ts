import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import test from 'node:test'
import 'dotenv/config'
import type { AddressInfo } from 'node:net'
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
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run Admin reporting tests against DATABASE_URL.',
    )
  }
  if (regularDatabaseUrl && testDatabaseUrl === regularDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run Admin reporting tests against the normal app database.',
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

type RestaurantSummary = {
  id: string
  qrLeadsCount: number
  applicationsCount: number
  totalCandidatesCount: number
  ownerUnviewedQrCandidates: number
  qrCandidateStatusCounts: Record<string, number>
  funnelMetrics: {
    qrScans: number
    uniqueQrVisitors: number
    startedForms: number
    completedForms: number
    ownerViewedCompletedForms: number
    newCandidates: number
  }
}

type AdminCandidate = {
  id: string
  source: 'qr' | 'jobBoard'
  phoneNumber: string
}

type RestaurantDetail = {
  restaurant: RestaurantSummary
  qrLeads: Array<{ id: string; phoneNumber: string }>
  applications: Array<{ id: string; worker: { id: string } }>
  jobs: Array<{ id: string; applicationsCount: number }>
}

type AcquisitionFunnelReport = {
  funnel: Array<{ key: string; count: number }>
  candidateSources: { external: number; jobBoard: number }
}

async function readJson<T>(response: Response) {
  const body = await response.text()
  return {
    status: response.status,
    body: body ? (JSON.parse(body) as T) : ({} as T),
  }
}

test(
  'Admin reporting excludes configured identities without changing owner data',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run Admin reporting exclusion tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'admin-reporting-exclusions-test-secret'

    const runId = randomUUID()
    const digits = runId.replace(/\D/g, '').padEnd(7, '0').slice(0, 7)
    const excludedPhone = `+97258${digits}`
    const normalPhone = `+97254${digits}`
    const ownerPhone = `+97252${digits}`
    const adminEmail = `reporting-admin-${runId}@example.test`
    process.env.ADMIN_EMAILS = adminEmail
    process.env.ANALYTICS_EXCLUDED_PHONES = `058-${digits}`

    const [
      { app },
      { prisma },
      { signAuthToken },
      { recordCandidateReceived },
    ] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js'),
      import('../lib/jwt.js'),
      import('../services/analytics.service.js'),
    ])

    let server: Server | null = null
    const createdUserIds: string[] = []
    const createdAcquisitionIds: string[] = []

    try {
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          fullName: 'Reporting Admin',
        },
      })
      createdUserIds.push(admin.id)

      const owner = await prisma.user.create({
        data: {
          phoneNumber: ownerPhone,
          phoneVerifiedAt: new Date(),
          fullName: 'Restaurant Owner',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(owner.id)

      const normalWorker = await prisma.user.create({
        data: {
          phoneNumber: normalPhone,
          phoneVerifiedAt: new Date(),
          fullName: 'Real Worker',
          track: 'restaurant',
          restaurantWorkerProfile: {
            create: {
              fullName: 'Real Worker',
              phoneNumber: normalPhone,
              wantedRoles: ['waiter'],
              experienceText: '1 year',
              availability: 'Morning',
              age: 23,
            },
          },
        },
      })
      createdUserIds.push(normalWorker.id)

      const excludedWorker = await prisma.user.create({
        data: {
          phoneNumber: excludedPhone,
          phoneVerifiedAt: new Date(),
          fullName: 'Internal Test Worker',
          track: 'restaurant',
          restaurantWorkerProfile: {
            create: {
              fullName: 'Internal Test Worker',
              phoneNumber: excludedPhone,
              wantedRoles: ['waiter'],
              experienceText: '2 years',
              availability: 'Flexible',
              age: 25,
            },
          },
        },
      })
      createdUserIds.push(excludedWorker.id)

      const restaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: owner.id,
          restaurantName: `Reporting Restaurant ${runId}`,
          slug: `reporting-${runId}`,
          qrEnabledRoles: ['waiter'],
          members: {
            create: {
              userId: owner.id,
              phoneNumber: ownerPhone,
              role: 'owner',
              status: 'active',
            },
          },
        },
      })
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
      const [normalApplication, excludedApplication] = await Promise.all([
        prisma.restaurantApplication.create({
          data: {
            userId: normalWorker.id,
            restaurantJobId: job.id,
          },
        }),
        prisma.restaurantApplication.create({
          data: {
            userId: excludedWorker.id,
            restaurantJobId: job.id,
          },
        }),
      ])
      const [normalLead, excludedLead] = await Promise.all([
        prisma.restaurantCandidateLead.create({
          data: {
            ownerProfileId: restaurant.id,
            fullName: 'Real QR Candidate',
            phoneNumber: normalPhone,
            wantedRoles: ['waiter'],
            source: 'qr',
          },
        }),
        prisma.restaurantCandidateLead.create({
          data: {
            ownerProfileId: restaurant.id,
            fullName: 'Internal QR Candidate',
            phoneNumber: excludedPhone,
            wantedRoles: ['waiter'],
            source: 'qr',
          },
        }),
      ])
      await prisma.restaurantQrEvent.createMany({
        data: [
          {
            ownerProfileId: restaurant.id,
            type: 'qrPageView',
            sessionId: `normal-${digits}`,
          },
          {
            ownerProfileId: restaurant.id,
            type: 'qrPageView',
            sessionId: `excluded-${digits}`,
          },
          {
            ownerProfileId: restaurant.id,
            type: 'qrFormStarted',
            sessionId: `normal-${digits}`,
          },
          {
            ownerProfileId: restaurant.id,
            type: 'qrFormStarted',
            sessionId: `excluded-${digits}`,
          },
        ],
      })

      const funnelOwner = await prisma.user.create({
        data: {
          phoneNumber: `+97250${digits}`,
          phoneVerifiedAt: new Date(),
          fullName: 'Funnel Restaurant Owner',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(funnelOwner.id)
      const funnelRestaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: funnelOwner.id,
          restaurantName: `Excluded-only Funnel Restaurant ${runId}`,
          slug: `excluded-funnel-${runId}`,
          members: {
            create: {
              userId: funnelOwner.id,
              phoneNumber: funnelOwner.phoneNumber!,
              role: 'owner',
              status: 'active',
            },
          },
        },
      })
      const funnelCampaign = `excluded-candidate-${runId}`
      const funnelAcquisition = await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: randomUUID(),
          userId: funnelOwner.id,
          firstSource: 'internal-test',
          firstMedium: 'test',
          firstCampaign: funnelCampaign,
          direct: false,
          firstLandingPath: '/register',
          firstTouchedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          events: {
            create: [
              {
                clientEventId: randomUUID(),
                eventName: 'owner_signup_started',
                occurredAt: new Date(),
                route: '/register',
                properties: { flow: 'selfServe' },
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
              {
                clientEventId: randomUUID(),
                eventName: 'owner_otp_verified',
                occurredAt: new Date(),
                route: '/register',
                properties: {
                  flow: 'selfServe',
                  purpose: 'register',
                  newAccount: true,
                },
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
            ],
          },
        },
      })
      createdAcquisitionIds.push(funnelAcquisition.id)
      const funnelExcludedLead =
        await prisma.restaurantCandidateLead.create({
          data: {
            ownerProfileId: funnelRestaurant.id,
            fullName: 'Excluded Funnel Candidate',
            phoneNumber: excludedPhone,
            wantedRoles: ['waiter'],
            source: 'qr',
          },
        })
      await recordCandidateReceived({
        restaurantId: funnelRestaurant.id,
        candidateSource: 'external',
        candidateRecordId: funnelExcludedLead.id,
        occurredAt: funnelExcludedLead.createdAt,
      })
      await prisma.analyticsEvent.createMany({
        data: [
          {
            acquisitionId: funnelAcquisition.id,
            clientEventId: randomUUID(),
            eventName: 'candidate_card_opened',
            occurredAt: new Date(),
            route: '/owner/applications',
            properties: {
              candidateSource: 'external',
              candidateRecordId: funnelExcludedLead.id,
            },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          {
            acquisitionId: funnelAcquisition.id,
            clientEventId: randomUUID(),
            eventName: 'candidate_contact_initiated',
            occurredAt: new Date(),
            route: '/owner/applications',
            properties: {
              channel: 'phone',
              candidateSource: 'external',
              candidateRecordId: funnelExcludedLead.id,
            },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        ],
      })

      server = createServer(app)
      await new Promise<void>((resolve) => {
        server!.listen(0, '127.0.0.1', () => resolve())
      })
      const address = server.address() as AddressInfo
      const baseUrl = `http://127.0.0.1:${address.port}/api`
      const adminHeaders = {
        Authorization: `Bearer ${signAuthToken(admin.id)}`,
      }
      const ownerHeaders = {
        Authorization: `Bearer ${signAuthToken(owner.id)}`,
      }

      const adminCandidates = await readJson<AdminCandidate[]>(
        await fetch(`${baseUrl}/admin/candidates`, {
          headers: adminHeaders,
        }),
      )
      assert.equal(adminCandidates.status, 200)
      assert.ok(
        adminCandidates.body.some(({ id }) => id === normalLead.id),
      )
      assert.ok(
        adminCandidates.body.some(({ id }) => id === normalApplication.id),
      )
      assert.ok(
        !adminCandidates.body.some(({ id }) => id === excludedLead.id),
      )
      assert.ok(
        !adminCandidates.body.some(
          ({ id }) => id === excludedApplication.id,
        ),
      )

      const restaurants = await readJson<RestaurantSummary[]>(
        await fetch(`${baseUrl}/admin/restaurants`, {
          headers: adminHeaders,
        }),
      )
      assert.equal(restaurants.status, 200)
      const summary = restaurants.body.find(({ id }) => id === restaurant.id)
      assert.equal(summary?.qrLeadsCount, 1)
      assert.equal(summary?.applicationsCount, 1)
      assert.equal(summary?.totalCandidatesCount, 2)
      assert.equal(summary?.ownerUnviewedQrCandidates, 1)
      assert.equal(summary?.qrCandidateStatusCounts.new, 1)
      assert.equal(summary?.funnelMetrics.completedForms, 1)
      assert.equal(summary?.funnelMetrics.newCandidates, 2)
      assert.equal(
        summary?.funnelMetrics.qrScans,
        2,
        'anonymous QR scans remain counted because no phone/user relation exists',
      )
      assert.equal(summary?.funnelMetrics.uniqueQrVisitors, 2)
      assert.equal(summary?.funnelMetrics.startedForms, 2)

      const detail = await readJson<RestaurantDetail>(
        await fetch(`${baseUrl}/admin/restaurants/${restaurant.id}`, {
          headers: adminHeaders,
        }),
      )
      assert.equal(detail.status, 200)
      assert.deepEqual(
        detail.body.qrLeads.map(({ id }) => id),
        [normalLead.id],
      )
      assert.deepEqual(
        detail.body.applications.map(({ id }) => id),
        [normalApplication.id],
      )
      assert.equal(detail.body.jobs[0]?.applicationsCount, 1)
      assert.equal(detail.body.restaurant.totalCandidatesCount, 2)

      const funnelReport = await readJson<AcquisitionFunnelReport>(
        await fetch(
          `${baseUrl}/admin/analytics/acquisition-funnel?campaign=${encodeURIComponent(funnelCampaign)}`,
          { headers: adminHeaders },
        ),
      )
      assert.equal(funnelReport.status, 200)
      assert.equal(
        funnelReport.body.funnel.find(
          ({ key }) => key === 'candidateReceived',
        )?.count,
        0,
        'an identifiable excluded candidate must not advance the acquisition funnel',
      )
      assert.equal(
        funnelReport.body.funnel.find(
          ({ key }) => key === 'candidateCardOpened',
        )?.count,
        0,
      )
      assert.equal(
        funnelReport.body.funnel.find(
          ({ key }) => key === 'contactInitiated',
        )?.count,
        0,
      )
      assert.deepEqual(funnelReport.body.candidateSources, {
        external: 0,
        jobBoard: 0,
      })

      const legacyAdminLeads = await readJson<Array<{ id: string }>>(
        await fetch(`${baseUrl}/admin/restaurant-leads`, {
          headers: adminHeaders,
        }),
      )
      assert.equal(legacyAdminLeads.status, 200)
      assert.ok(legacyAdminLeads.body.some(({ id }) => id === normalLead.id))
      assert.ok(
        !legacyAdminLeads.body.some(({ id }) => id === excludedLead.id),
      )

      const ownerLeads = await readJson<Array<{ id: string }>>(
        await fetch(`${baseUrl}/owner/leads`, {
          headers: ownerHeaders,
        }),
      )
      assert.equal(ownerLeads.status, 200)
      assert.ok(ownerLeads.body.some(({ id }) => id === normalLead.id))
      assert.ok(ownerLeads.body.some(({ id }) => id === excludedLead.id))

      const ownerApplications = await readJson<Array<{ id: string }>>(
        await fetch(`${baseUrl}/owner/applications`, {
          headers: ownerHeaders,
        }),
      )
      assert.equal(ownerApplications.status, 200)
      assert.ok(
        ownerApplications.body.some(({ id }) => id === normalApplication.id),
      )
      assert.ok(
        ownerApplications.body.some(
          ({ id }) => id === excludedApplication.id,
        ),
      )

      assert.equal(
        await prisma.restaurantCandidateLead.count({
          where: { id: { in: [normalLead.id, excludedLead.id] } },
        }),
        2,
        'Admin filtering must not delete candidate records',
      )
      assert.equal(
        await prisma.restaurantApplication.count({
          where: {
            id: { in: [normalApplication.id, excludedApplication.id] },
          },
        }),
        2,
        'Admin filtering must not delete application records',
      )
    } finally {
      await prisma.analyticsAcquisition.deleteMany({
        where: { id: { in: createdAcquisitionIds } },
      })
      await prisma.user.deleteMany({
        where: {
          id: {
            in: createdUserIds,
          },
        },
      })

      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => (error ? reject(error) : resolve()))
        })
      }
    }
  },
)
