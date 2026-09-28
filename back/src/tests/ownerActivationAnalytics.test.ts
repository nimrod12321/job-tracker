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
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run owner activation analytics tests against DATABASE_URL.',
    )
  }
  if (regularDatabaseUrl && testDatabaseUrl === regularDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run owner activation analytics tests against the normal app database.',
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
  'owner hiring activation analytics are authenticated, durable, and derived safely',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run owner activation analytics tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'owner-activation-analytics-test-secret'

    const [
      { app },
      { prisma },
      { signAuthToken },
      {
        hasRecruitmentAssetBeenUsed,
        isRestaurantHiringReady,
      },
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
    const acquisitionId = randomUUID()
    const otherAcquisitionId = randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const createdUserIds: string[] = []

    async function post<T>(
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

    async function patch<T>(
      path: string,
      body: unknown,
      token: string,
    ) {
      return readJson<T>(
        await fetch(`${baseUrl}${path}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
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
      assert.fail('Timed out waiting for owner activity analytics write')
    }

    function ownerEvent(
      eventName:
        | 'recruitment_kit_opened'
        | 'hiring_link_copied'
        | 'poster_download_started'
        | 'qr_download_started'
        | 'instagram_assist_opened',
      properties: Record<string, string | number | boolean | null> = {},
      clientEventId = randomUUID(),
    ) {
      return {
        clientEventId,
        eventName,
        occurredAt: new Date().toISOString(),
        route: '/owner/jobs',
        properties,
      }
    }

    try {
      const owner = await prisma.user.create({
        data: {
          phoneNumber: `+97250${Date.now().toString().slice(-7)}`,
          phoneVerifiedAt: now,
          fullName: 'Stage 3 Owner',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(owner.id)
      const restaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: owner.id,
          restaurantName: `Stage 3 ${runId}`,
          slug: `stage-3-${runId}`,
          city: 'Tel Aviv',
          street: 'Dizengoff',
          qrEnabledRoles: ['waiter'],
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
          anonymousAcquisitionId: acquisitionId,
          userId: owner.id,
          firstSource: 'Instagram',
          firstMedium: 'paid social',
          firstCampaign: 'stage_3_test',
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
                properties: { flow: 'selfServe' },
                expiresAt,
              },
            ],
          },
        },
      })

      const otherOwner = await prisma.user.create({
        data: {
          phoneNumber: `+97252${Date.now().toString().slice(-7)}`,
          phoneVerifiedAt: now,
          fullName: 'Other Owner',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(otherOwner.id)
      const otherRestaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: otherOwner.id,
          restaurantName: `Other Stage 3 ${runId}`,
          slug: `other-stage-3-${runId}`,
          city: 'Tel Aviv',
          street: 'Allenby',
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
      await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: otherAcquisitionId,
          userId: otherOwner.id,
          firstSource: 'direct',
          firstMedium: 'none',
          direct: true,
          firstLandingPath: '/',
          firstTouchedAt: now,
          expiresAt,
        },
      })

      const worker = await prisma.user.create({
        data: {
          phoneNumber: `+97254${Date.now().toString().slice(-7)}`,
          phoneVerifiedAt: now,
          fullName: 'Stage 3 Worker',
          track: 'restaurant',
        },
      })
      createdUserIds.push(worker.id)

      const ownerToken = signAuthToken(owner.id)
      const workerToken = signAuthToken(worker.id)

      assert.equal(await isRestaurantHiringReady(restaurant.id), true)
      assert.equal(
        await hasRecruitmentAssetBeenUsed(acquisitionId),
        false,
      )

      const stage2CountsBefore = await prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        where: {
          acquisitionId: acquisition.id,
          eventName: {
            in: ['owner_signup_started', 'owner_otp_verified'],
          },
        },
        _count: true,
      })

      const kitEvent = ownerEvent('recruitment_kit_opened')
      const kitOpened = await post<{ created: boolean }>(
        '/analytics/owner-events',
        kitEvent,
        ownerToken,
      )
      assert.equal(kitOpened.status, 201)
      assert.equal(kitOpened.body.created, true)
      assert.equal(
        await hasRecruitmentAssetBeenUsed(acquisitionId),
        false,
        'opening the kit alone must not count as asset use',
      )

      const kitRetry = await post<{ created: boolean }>(
        '/analytics/owner-events',
        kitEvent,
        ownerToken,
      )
      assert.equal(kitRetry.status, 200)
      assert.equal(kitRetry.body.created, false)

      const copyEvent = ownerEvent('hiring_link_copied', {
        method: 'button',
      })
      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            copyEvent,
            ownerToken,
          )
        ).status,
        201,
      )
      assert.equal(
        await hasRecruitmentAssetBeenUsed(acquisitionId),
        true,
      )

      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            ownerEvent('poster_download_started', { format: 'png' }),
            ownerToken,
          )
        ).status,
        201,
      )
      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            ownerEvent('qr_download_started', { format: 'png' }),
            ownerToken,
          )
        ).status,
        201,
      )

      const copiesBeforeInstagram = await prisma.analyticsEvent.count({
        where: {
          acquisitionId: acquisition.id,
          eventName: 'hiring_link_copied',
        },
      })
      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            ownerEvent('instagram_assist_opened', {
              context: 'story_assist',
            }),
            ownerToken,
          )
        ).status,
        201,
      )
      assert.equal(
        await prisma.analyticsEvent.count({
          where: {
            acquisitionId: acquisition.id,
            eventName: 'hiring_link_copied',
          },
        }),
        copiesBeforeInstagram,
      )

      const rolesDisabled = await patch<{ qrEnabledRoles: string[] }>(
        '/owner/qr-roles',
        { qrEnabledRoles: [] },
        ownerToken,
      )
      assert.equal(rolesDisabled.status, 200)
      assert.deepEqual(rolesDisabled.body.qrEnabledRoles, [])
      await waitFor(async () => {
        return (
          (await prisma.analyticsEvent.count({
            where: {
              acquisitionId: acquisition.id,
              eventName: 'hiring_roles_updated',
            },
          })) === 1
        )
      })
      assert.equal(await isRestaurantHiringReady(restaurant.id), false)

      const roleEventsBeforeFailure = await prisma.analyticsEvent.count({
        where: {
          acquisitionId: acquisition.id,
          eventName: 'hiring_roles_updated',
        },
      })
      const failedRoleUpdate = await patch(
        '/owner/qr-roles',
        { qrEnabledRoles: ['not-a-real-role'] },
        ownerToken,
      )
      assert.equal(failedRoleUpdate.status, 400)
      await new Promise((resolve) => setTimeout(resolve, 100))
      assert.equal(
        await prisma.analyticsEvent.count({
          where: {
            acquisitionId: acquisition.id,
            eventName: 'hiring_roles_updated',
          },
        }),
        roleEventsBeforeFailure,
      )

      const rolesEnabled = await patch<{ qrEnabledRoles: string[] }>(
        '/owner/qr-roles',
        { qrEnabledRoles: ['waiter'] },
        ownerToken,
      )
      assert.equal(rolesEnabled.status, 200)
      await waitFor(async () => {
        return (
          (await prisma.analyticsEvent.count({
            where: {
              acquisitionId: acquisition.id,
              eventName: 'hiring_roles_updated',
            },
          })) === 2
        )
      })
      assert.equal(await isRestaurantHiringReady(restaurant.id), true)

      const roleEventProperties = await prisma.analyticsEvent.findMany({
        where: {
          acquisitionId: acquisition.id,
          eventName: 'hiring_roles_updated',
        },
        orderBy: { occurredAt: 'asc' },
        select: { properties: true },
      })
      assert.deepEqual(
        roleEventProperties.map((event) => event.properties),
        [{ roleCount: 0 }, { roleCount: 1 }],
      )

      assert.equal(
        (
          await post('/analytics/owner-events', kitEvent)
        ).status,
        401,
      )
      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            ownerEvent('recruitment_kit_opened'),
            workerToken,
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await post(
            '/analytics/owner-events',
            {
              ...ownerEvent('recruitment_kit_opened'),
              restaurantId: otherRestaurant.id,
            },
            ownerToken,
          )
        ).status,
        400,
      )
      assert.equal(
        await prisma.analyticsEvent.count({
          where: {
            acquisition: {
              anonymousAcquisitionId: otherAcquisitionId,
            },
          },
        }),
        0,
      )

      const publicOwnerEvent = await post('/analytics/events', {
        anonymousAcquisitionId: acquisitionId,
        ...ownerEvent('hiring_link_copied', { method: 'button' }),
      })
      assert.equal(publicOwnerEvent.status, 403)

      const persistedAcquisition =
        await prisma.analyticsAcquisition.findUniqueOrThrow({
          where: { anonymousAcquisitionId: acquisitionId },
        })
      assert.equal(persistedAcquisition.firstSource, 'Instagram')
      assert.equal(persistedAcquisition.firstMedium, 'paid social')
      assert.equal(persistedAcquisition.firstCampaign, 'stage_3_test')

      const stage2CountsAfter = await prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        where: {
          acquisitionId: acquisition.id,
          eventName: {
            in: ['owner_signup_started', 'owner_otp_verified'],
          },
        },
        _count: true,
      })
      assert.deepEqual(stage2CountsAfter, stage2CountsBefore)
    } finally {
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
