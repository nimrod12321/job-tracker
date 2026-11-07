import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import 'dotenv/config'
import type { Express } from 'express'

const shouldRunSecurityTests = process.env.RUN_SECURITY_TESTS === 'true'

function normalizeDatabaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/$/, '')
}

function assertSafeTestDatabaseUrl() {
  if (!shouldRunSecurityTests) return

  const testDatabaseUrl = normalizeDatabaseUrl(
    process.env.TEST_DATABASE_URL,
  )
  const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL)

  if (!testDatabaseUrl) {
    throw new Error(
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run multi-restaurant tests against DATABASE_URL.',
    )
  }

  if (databaseUrl && databaseUrl === testDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run multi-restaurant tests against the normal app database.',
    )
  }

  if (!testDatabaseUrl.toLowerCase().includes('test')) {
    throw new Error(
      'Multi-restaurant tests require a dedicated database with test in its URL.',
    )
  }
}

assertSafeTestDatabaseUrl()

async function readJson<T>(response: Response) {
  const text = await response.text()

  return {
    status: response.status,
    body: text ? (JSON.parse(text) as T) : ({} as T),
  }
}

test(
  'multi-restaurant discovery and explicit access resolution are restaurant-scoped',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run multi-restaurant access tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'multi-restaurant-access-test-secret'

    const [
      { app },
      { prisma },
      { signAuthToken },
      {
        getAccessibleRestaurantsForUser,
        resolveRestaurantAccessForUser,
      },
    ] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js'),
      import('../lib/jwt.js'),
      import('../services/restaurantAccess.service.js'),
    ])
    const server = createServer(app)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${address.port}/api`
    const runId = randomUUID()
    const createdUserIds: string[] = []
    const createdRestaurantIds: string[] = []

    async function createUser(
      label: string,
      track: 'restaurant' | 'restaurantOwner' = 'restaurantOwner',
    ) {
      const user = await prisma.user.create({
        data: {
          fullName: `${label} ${runId}`,
          track,
        },
      })
      createdUserIds.push(user.id)
      return user
    }

    async function createRestaurant(label: string, directUserId?: string) {
      const profileUser = directUserId
        ? { id: directUserId }
        : await createUser(`${label} Profile`)
      const restaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: profileUser.id,
          restaurantName: `${label} ${runId}`,
          city: 'Tel Aviv',
          street: 'Dizengoff',
          slug: `${label.toLowerCase().replace(/\s+/g, '-')}-${runId}`,
        },
      })
      createdRestaurantIds.push(restaurant.id)
      return restaurant
    }

    async function addMember(
      restaurantId: string,
      userId: string,
      role: 'owner' | 'hiringManager',
      status: 'active' | 'pending' | 'removed' = 'active',
    ) {
      return prisma.restaurantMember.create({
        data: {
          restaurantId,
          userId,
          phoneNumber: `test-${runId}-${restaurantId}-${userId}`,
          role,
          status,
        },
      })
    }

    async function discover(userId: string) {
      return readJson<{
        restaurants: Array<{
          restaurantId: string
          restaurantName: string
          slug: string | null
          membershipRole: 'owner' | 'hiringManager'
        }>
      }>(
        await fetch(`${baseUrl}/owner/restaurants`, {
          headers: {
            Authorization: `Bearer ${signAuthToken(userId)}`,
          },
        }),
      )
    }

    try {
      const singleOwner = await createUser('Single Owner')
      const singleRestaurant = await createRestaurant('Single Restaurant')
      await addMember(singleRestaurant.id, singleOwner.id, 'owner')

      const singleResolution = await resolveRestaurantAccessForUser(
        singleOwner.id,
      )
      assert.equal(singleResolution.status, 'resolved')
      if (singleResolution.status === 'resolved') {
        assert.equal(
          singleResolution.access.restaurant.id,
          singleRestaurant.id,
        )
        assert.equal(singleResolution.access.role, 'owner')
      }
      const singleDiscovery = await discover(singleOwner.id)
      assert.equal(singleDiscovery.status, 200)
      assert.deepEqual(singleDiscovery.body.restaurants, [
        {
          restaurantId: singleRestaurant.id,
          restaurantName: singleRestaurant.restaurantName,
          slug: singleRestaurant.slug,
          membershipRole: 'owner',
        },
      ])

      const sharedRestaurants = await Promise.all([
        createRestaurant('Shared One'),
        createRestaurant('Shared Two'),
        createRestaurant('Shared Three'),
      ])
      const threeRestaurantOwner = await createUser('Three Owner')
      const threeRestaurantManager = await createUser(
        'Three Manager',
        'restaurant',
      )
      for (const restaurant of sharedRestaurants) {
        await addMember(restaurant.id, threeRestaurantOwner.id, 'owner')
        await addMember(
          restaurant.id,
          threeRestaurantManager.id,
          'hiringManager',
        )
      }

      const ownerDiscovery = await discover(threeRestaurantOwner.id)
      assert.equal(ownerDiscovery.status, 200)
      assert.equal(ownerDiscovery.body.restaurants.length, 3)
      assert.deepEqual(
        new Set(
          ownerDiscovery.body.restaurants.map(
            (restaurant) => restaurant.restaurantId,
          ),
        ),
        new Set(sharedRestaurants.map((restaurant) => restaurant.id)),
      )
      assert.ok(
        ownerDiscovery.body.restaurants.every(
          (restaurant) => restaurant.membershipRole === 'owner',
        ),
      )

      const managerDiscovery = await discover(threeRestaurantManager.id)
      assert.equal(managerDiscovery.status, 200)
      assert.equal(managerDiscovery.body.restaurants.length, 3)
      assert.deepEqual(
        new Set(
          managerDiscovery.body.restaurants.map(
            (restaurant) => restaurant.restaurantId,
          ),
        ),
        new Set(sharedRestaurants.map((restaurant) => restaurant.id)),
      )
      assert.ok(
        managerDiscovery.body.restaurants.every(
          (restaurant) =>
            restaurant.membershipRole === 'hiringManager',
        ),
      )

      const missingOwnerSelection =
        await resolveRestaurantAccessForUser(threeRestaurantOwner.id)
      assert.equal(missingOwnerSelection.status, 'selectionRequired')
      const missingManagerSelection =
        await resolveRestaurantAccessForUser(threeRestaurantManager.id)
      assert.equal(missingManagerSelection.status, 'selectionRequired')

      const mixedUser = await createUser('Mixed Roles')
      await addMember(sharedRestaurants[0].id, mixedUser.id, 'owner')
      await addMember(
        sharedRestaurants[1].id,
        mixedUser.id,
        'hiringManager',
      )
      const mixedOwnerAccess = await resolveRestaurantAccessForUser(
        mixedUser.id,
        sharedRestaurants[0].id,
      )
      const mixedManagerAccess = await resolveRestaurantAccessForUser(
        mixedUser.id,
        sharedRestaurants[1].id,
      )
      assert.equal(mixedOwnerAccess.status, 'resolved')
      assert.equal(mixedManagerAccess.status, 'resolved')
      if (mixedOwnerAccess.status === 'resolved') {
        assert.equal(mixedOwnerAccess.access.role, 'owner')
      }
      if (mixedManagerAccess.status === 'resolved') {
        assert.equal(mixedManagerAccess.access.role, 'hiringManager')
      }

      const unauthorizedRestaurant = await createRestaurant('Unauthorized')
      const unauthorizedResolution = await resolveRestaurantAccessForUser(
        mixedUser.id,
        unauthorizedRestaurant.id,
      )
      assert.equal(unauthorizedResolution.status, 'accessDenied')

      const revokedUser = await createUser('Revoked User')
      const revocableRestaurant = await createRestaurant('Revocable')
      const revokedMembership = await addMember(
        revocableRestaurant.id,
        revokedUser.id,
        'hiringManager',
      )
      assert.equal(
        (
          await resolveRestaurantAccessForUser(
            revokedUser.id,
            revocableRestaurant.id,
          )
        ).status,
        'resolved',
      )
      await prisma.restaurantMember.update({
        where: { id: revokedMembership.id },
        data: { status: 'removed' },
      })
      const pendingRestaurant = await createRestaurant('Pending')
      await addMember(
        pendingRestaurant.id,
        revokedUser.id,
        'hiringManager',
        'pending',
      )
      assert.equal(
        (
          await resolveRestaurantAccessForUser(
            revokedUser.id,
            revocableRestaurant.id,
          )
        ).status,
        'accessDenied',
      )
      assert.equal(
        (
          await resolveRestaurantAccessForUser(
            revokedUser.id,
            pendingRestaurant.id,
          )
        ).status,
        'accessDenied',
      )
      assert.deepEqual(
        await getAccessibleRestaurantsForUser(revokedUser.id),
        [],
      )

      const legacyOwner = await createUser('Legacy Owner')
      const legacyRestaurant = await createRestaurant(
        'Legacy Restaurant',
        legacyOwner.id,
      )
      const legacyAccesses = await getAccessibleRestaurantsForUser(
        legacyOwner.id,
      )
      assert.equal(legacyAccesses.length, 1)
      assert.equal(legacyAccesses[0]!.restaurant.id, legacyRestaurant.id)
      assert.equal(legacyAccesses[0]!.role, 'owner')
      assert.equal(legacyAccesses[0]!.isLegacyOwner, true)
      const legacyDiscovery = await discover(legacyOwner.id)
      assert.equal(legacyDiscovery.status, 200)
      assert.equal(legacyDiscovery.body.restaurants.length, 1)
      assert.equal(
        legacyDiscovery.body.restaurants[0]!.restaurantId,
        legacyRestaurant.id,
      )

      const revokedLegacyOwner = await createUser('Revoked Legacy Owner')
      const revokedLegacyRestaurant = await createRestaurant(
        'Revoked Legacy Restaurant',
        revokedLegacyOwner.id,
      )
      await addMember(
        revokedLegacyRestaurant.id,
        revokedLegacyOwner.id,
        'owner',
        'removed',
      )
      assert.equal(
        (
          await resolveRestaurantAccessForUser(
            revokedLegacyOwner.id,
            revokedLegacyRestaurant.id,
          )
        ).status,
        'accessDenied',
      )
      assert.deepEqual(
        await getAccessibleRestaurantsForUser(revokedLegacyOwner.id),
        [],
      )

      const unrelatedUser = await createUser('Unrelated User')
      const unrelatedDiscovery = await discover(unrelatedUser.id)
      assert.equal(unrelatedDiscovery.status, 200)
      assert.deepEqual(unrelatedDiscovery.body.restaurants, [])
    } finally {
      if (createdRestaurantIds.length > 0) {
        await prisma.restaurantOwnerProfile.deleteMany({
          where: { id: { in: createdRestaurantIds } },
        })
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        })
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  },
)
