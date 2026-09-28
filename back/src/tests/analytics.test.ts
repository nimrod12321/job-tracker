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
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run analytics tests against DATABASE_URL.',
    )
  }
  if (regularDatabaseUrl && testDatabaseUrl === regularDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run analytics tests against the normal app database.',
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
  const text = await response.text()
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as T) : ({} as T),
  }
}

test(
  'acquisition analytics APIs are immutable, idempotent, strict, and retained safely',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run analytics integration tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'analytics-test-secret'

    const [{ app }, { prisma }, { cleanupExpiredAnalytics }] =
      await Promise.all([
        import('../server.js') as Promise<{ app: Express }>,
        import('../lib/prisma.js'),
        import('../services/analytics.service.js'),
      ])

    const server = createServer(app)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${address.port}/api`
    const runId = randomUUID()
    const acquisitionId = randomUUID()
    const clientEventId = randomUUID()
    const expiredAcquisitionId = randomUUID()
    const activeAcquisitionId = randomUUID()
    const metaAcquisitionId = randomUUID()
    const googleAcquisitionId = randomUUID()
    const prefix = `analytics-${runId}`
    const unrelatedPhone = `+97259${Date.now().toString().slice(-7)}`

    async function post<T>(path: string, body: unknown) {
      return readJson<T>(
        await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      )
    }

    const firstTouchedAt = new Date().toISOString()
    const acquisitionPayload = {
      anonymousAcquisitionId: acquisitionId,
      firstTouch: {
        source: 'Instagram Ads',
        medium: 'paid social',
        campaign: 'test/one',
        referrer: 'instagram.com',
        direct: false,
        landingPath: '/auth',
        firstTouchedAt,
      },
    }

    try {
      const created = await post<{ created: boolean }>(
        '/analytics/acquisition',
        acquisitionPayload,
      )
      assert.equal(created.status, 201)
      assert.equal(created.body.created, true)

      const duplicate = await post<{ created: boolean }>(
        '/analytics/acquisition',
        {
          ...acquisitionPayload,
          firstTouch: {
            ...acquisitionPayload.firstTouch,
            source: 'facebook',
            medium: 'referral',
            campaign: 'must-not-overwrite',
          },
        },
      )
      assert.equal(duplicate.status, 200)
      assert.equal(duplicate.body.created, false)

      const persistedAcquisition =
        await prisma.analyticsAcquisition.findUniqueOrThrow({
          where: { anonymousAcquisitionId: acquisitionId },
        })
      assert.equal(persistedAcquisition.firstSource, 'Instagram Ads')
      assert.equal(persistedAcquisition.firstMedium, 'paid social')
      assert.equal(persistedAcquisition.firstCampaign, 'test/one')

      const acceptedHumanReadableValues = [
        {
          anonymousAcquisitionId: metaAcquisitionId,
          firstTouch: {
            ...acquisitionPayload.firstTouch,
            source: 'meta_paid',
            medium: 'social',
            campaign: '2026/q4-owner-acquisition',
          },
        },
        {
          anonymousAcquisitionId: googleAcquisitionId,
          firstTouch: {
            ...acquisitionPayload.firstTouch,
            source: 'Google Ads',
            medium: 'cpc',
            campaign: 'Tel Aviv Launch',
          },
        },
      ]

      for (const payload of acceptedHumanReadableValues) {
        const response = await post<{ created: boolean }>(
          '/analytics/acquisition',
          payload,
        )
        assert.equal(response.status, 201)
        assert.equal(response.body.created, true)
      }

      const persistedHumanReadableValues =
        await prisma.analyticsAcquisition.findMany({
          where: {
            anonymousAcquisitionId: {
              in: [metaAcquisitionId, googleAcquisitionId],
            },
          },
          orderBy: {
            firstSource: 'asc',
          },
        })
      assert.deepEqual(
        persistedHumanReadableValues.map((acquisition) => ({
          source: acquisition.firstSource,
          medium: acquisition.firstMedium,
          campaign: acquisition.firstCampaign,
        })),
        [
          {
            source: 'Google Ads',
            medium: 'cpc',
            campaign: 'Tel Aviv Launch',
          },
          {
            source: 'meta_paid',
            medium: 'social',
            campaign: '2026/q4-owner-acquisition',
          },
        ],
      )

      const rejectedAcquisitions = [
        {
          ...acquisitionPayload,
          anonymousAcquisitionId: randomUUID(),
          firstTouch: {
            ...acquisitionPayload.firstTouch,
            source: 'Instagram\nAds',
          },
        },
        {
          ...acquisitionPayload,
          anonymousAcquisitionId: randomUUID(),
          firstTouch: {
            ...acquisitionPayload.firstTouch,
            source: 'Instagram\u0000Ads',
          },
        },
        {
          ...acquisitionPayload,
          anonymousAcquisitionId: randomUUID(),
          firstTouch: {
            ...acquisitionPayload.firstTouch,
            medium: 'm'.repeat(101),
          },
        },
        {
          ...acquisitionPayload,
          anonymousAcquisitionId: randomUUID(),
          firstTouch: {
            ...acquisitionPayload.firstTouch,
            campaign: 'c'.repeat(161),
          },
        },
        {
          ...acquisitionPayload,
          anonymousAcquisitionId: randomUUID(),
          firstTouch: {
            ...acquisitionPayload.firstTouch,
            referrer: 'https://instagram.com/path?foo=bar',
          },
        },
        {
          ...acquisitionPayload,
          anonymousAcquisitionId: randomUUID(),
          firstTouch: {
            ...acquisitionPayload.firstTouch,
            landingPath: '/auth?utm_source=instagram',
          },
        },
      ]

      for (const payload of rejectedAcquisitions) {
        const response = await post('/analytics/acquisition', payload)
        assert.equal(response.status, 400)
      }

      const malformed = await post('/analytics/acquisition', {
        ...acquisitionPayload,
        firstTouch: {
          ...acquisitionPayload.firstTouch,
          landingPath: '/auth?phone=private',
        },
      })
      assert.equal(malformed.status, 400)

      const occurredAt = new Date().toISOString()
      const eventPayload = {
        anonymousAcquisitionId: acquisitionId,
        clientEventId,
        eventName: 'owner_signup_started',
        occurredAt,
        route: '/owner/jobs',
        properties: { flow: 'claim' },
      }
      const eventCreated = await post<{ created: boolean }>(
        '/analytics/events',
        eventPayload,
      )
      assert.equal(eventCreated.status, 201)
      assert.equal(eventCreated.body.created, true)

      const eventDuplicate = await post<{ created: boolean }>(
        '/analytics/events',
        eventPayload,
      )
      assert.equal(eventDuplicate.status, 200)
      assert.equal(eventDuplicate.body.created, false)
      assert.equal(
        await prisma.analyticsEvent.count({ where: { clientEventId } }),
        1,
      )

      const conflictingRetry = await post('/analytics/events', {
        ...eventPayload,
        properties: { flow: 'selfServe' },
      })
      assert.equal(conflictingRetry.status, 409)

      const unknownEvent = await post('/analytics/events', {
        ...eventPayload,
        clientEventId: randomUUID(),
        eventName: 'made_up_event',
      })
      assert.equal(unknownEvent.status, 400)

      const invalidClientEventId = await post('/analytics/events', {
        ...eventPayload,
        clientEventId: 'not-a-uuid',
      })
      assert.equal(invalidClientEventId.status, 400)

      const nestedProperties = await post('/analytics/events', {
        ...eventPayload,
        clientEventId: randomUUID(),
        properties: { method: { private: 'value' } },
      })
      assert.equal(nestedProperties.status, 400)

      const unknownProperty = await post('/analytics/events', {
        ...eventPayload,
        clientEventId: randomUUID(),
        properties: { phoneNumber: '+972501234567' },
      })
      assert.equal(unknownProperty.status, 400)

      const missingAcquisition = await post('/analytics/events', {
        ...eventPayload,
        anonymousAcquisitionId: randomUUID(),
        clientEventId: randomUUID(),
      })
      assert.equal(missingAcquisition.status, 404)

      const oversized = await post('/analytics/events', {
        ...eventPayload,
        clientEventId: randomUUID(),
        ignored: 'x'.repeat(9_000),
      })
      assert.equal(oversized.status, 413)

      const past = new Date(Date.now() - 60_000)
      const future = new Date(Date.now() + 60_000)

      const [expiredAcquisition, activeAcquisition] = await Promise.all([
        prisma.analyticsAcquisition.create({
          data: {
            anonymousAcquisitionId: expiredAcquisitionId,
            firstSource: 'direct',
            firstMedium: 'none',
            direct: true,
            firstLandingPath: '/',
            firstTouchedAt: new Date(),
            expiresAt: past,
          },
        }),
        prisma.analyticsAcquisition.create({
          data: {
            anonymousAcquisitionId: activeAcquisitionId,
            firstSource: 'direct',
            firstMedium: 'none',
            direct: true,
            firstLandingPath: '/',
            firstTouchedAt: new Date(),
            expiresAt: future,
          },
        }),
      ])
      await Promise.all([
        prisma.analyticsEvent.create({
          data: {
            acquisitionId: expiredAcquisition.id,
            clientEventId: randomUUID(),
            eventName: 'recruitment_kit_opened',
            occurredAt: new Date(),
            properties: {},
            expiresAt: past,
          },
        }),
        prisma.analyticsEvent.create({
          data: {
            acquisitionId: activeAcquisition.id,
            clientEventId: randomUUID(),
            eventName: 'recruitment_kit_opened',
            occurredAt: new Date(),
            properties: {},
            expiresAt: future,
          },
        }),
        prisma.otpVerification.create({
          data: {
            phoneNumber: unrelatedPhone,
            codeHash: 'not-a-real-code',
            purpose: 'login',
            expiresAt: future,
          },
        }),
      ])

      const cleanup = await cleanupExpiredAnalytics(new Date())
      assert.ok(cleanup.deletedEvents >= 1)
      assert.ok(cleanup.deletedAcquisitions >= 1)
      assert.equal(
        await prisma.analyticsAcquisition.count({
          where: { anonymousAcquisitionId: expiredAcquisitionId },
        }),
        0,
      )
      assert.equal(
        await prisma.analyticsAcquisition.count({
          where: { anonymousAcquisitionId: activeAcquisitionId },
        }),
        1,
      )
      assert.equal(
        await prisma.otpVerification.count({
          where: { phoneNumber: unrelatedPhone },
        }),
        1,
      )
    } finally {
      await prisma.analyticsAcquisition.deleteMany({
        where: {
          OR: [
            {
              anonymousAcquisitionId: {
                in: [
                  acquisitionId,
                  expiredAcquisitionId,
                  activeAcquisitionId,
                  metaAcquisitionId,
                  googleAcquisitionId,
                ],
              },
            },
            { firstCampaign: prefix },
          ],
        },
      })
      await prisma.otpVerification.deleteMany({
        where: { phoneNumber: unrelatedPhone },
      })
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
