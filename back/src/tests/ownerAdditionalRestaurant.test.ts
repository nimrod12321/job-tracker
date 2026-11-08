import assert from 'node:assert/strict'
import { randomInt, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
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
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run additional-restaurant tests against DATABASE_URL.',
    )
  }

  if (databaseUrl && databaseUrl === testDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run additional-restaurant tests against the normal app database.',
    )
  }

  if (!testDatabaseUrl.toLowerCase().includes('test')) {
    throw new Error(
      'Additional-restaurant tests require a dedicated database with test in its URL.',
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
  'owners can create additional independent restaurants without weakening restaurant-scoped access',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run additional-restaurant tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'additional-restaurant-test-secret'

    const [
      { app },
      { prisma },
      { signAuthToken },
      {
        clearGooglePlaceDetailsForTest,
        setGooglePlaceDetailsForTest,
      },
    ] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js'),
      import('../lib/jwt.js'),
      import('../services/googlePlaces.service.js'),
    ])
    const server = createServer(app)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${address.port}/api`
    const runId = randomUUID()
    const createdUserIds = new Set<string>()
    const createdRestaurantIds = new Set<string>()

    function createPhone() {
      return `+9725${randomInt(0, 100_000_000)
        .toString()
        .padStart(8, '0')}`
    }

    async function createUser(
      label: string,
      track: 'restaurant' | 'restaurantOwner' = 'restaurantOwner',
    ) {
      const user = await prisma.user.create({
        data: {
          fullName: `${label} ${runId}`,
          phoneNumber: createPhone(),
          phoneVerifiedAt: new Date(),
          track,
        },
      })
      createdUserIds.add(user.id)
      return user
    }

    async function createRestaurant(label: string) {
      const placeholderUser = await prisma.user.create({
        data: {
          fullName: `${label} Placeholder ${runId}`,
          track: 'restaurantOwner',
        },
      })
      createdUserIds.add(placeholderUser.id)
      const restaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: placeholderUser.id,
          restaurantName: `${label} ${runId}`,
          contactPerson: `${label} Contact`,
          phoneNumber: '+972501111111',
          whatsappNumber: '+972501111111',
          city: 'Tel Aviv–Yafo',
          street: 'Dizengoff Street 100',
          description: `${label} description`,
          slug: `${label.toLowerCase().replace(/\s+/g, '-')}-${runId}`,
        },
      })
      createdRestaurantIds.add(restaurant.id)
      return restaurant
    }

    async function addMember(
      restaurantId: string,
      user: { id: string; phoneNumber: string | null },
      role: 'owner' | 'hiringManager',
    ) {
      return prisma.restaurantMember.create({
        data: {
          restaurantId,
          userId: user.id,
          phoneNumber: user.phoneNumber!,
          displayName: `Member ${runId}`,
          role,
          status: 'active',
        },
      })
    }

    function registerPlace(placeId: string, streetNumber: string) {
      setGooglePlaceDetailsForTest(placeId, {
        id: placeId,
        formattedAddress: `Dizengoff Street ${streetNumber}, Tel Aviv-Yafo, Israel`,
        location: {
          latitude: 32.08 + Number(streetNumber) / 100_000,
          longitude: 34.77 + Number(streetNumber) / 100_000,
        },
        addressComponents: [
          { longText: 'Dizengoff Street', types: ['route'] },
          { longText: streetNumber, types: ['street_number'] },
          { longText: 'Tel Aviv-Yafo', types: ['locality'] },
          {
            longText: 'Israel',
            shortText: 'IL',
            types: ['country'],
          },
        ],
        types: ['street_address'],
      })
    }

    function authHeaders(
      userId: string,
      restaurantId?: string,
    ): Record<string, string> {
      return {
        Authorization: `Bearer ${signAuthToken(userId)}`,
        'Content-Type': 'application/json',
        ...(restaurantId
          ? { 'X-Restaurant-Id': restaurantId }
          : {}),
      }
    }

    async function request<T>(
      path: string,
      options: {
        userId?: string
        restaurantId?: string
        method?: string
        body?: unknown
      } = {},
    ) {
      return readJson<T>(
        await fetch(`${baseUrl}${path}`, {
          method: options.method ?? 'GET',
          headers: options.userId
            ? authHeaders(options.userId, options.restaurantId)
            : { 'Content-Type': 'application/json' },
          ...(options.body === undefined
            ? {}
            : { body: JSON.stringify(options.body) }),
        }),
      )
    }

    function additionalRestaurantInput(
      name: string,
      placeId: string,
    ) {
      return {
        restaurantName: name,
        contactPerson: `New Cafe Contact ${runId}`,
        phoneNumber: '0501234567',
        whatsappNumber: '0501234567',
        city: 'Tel Aviv–Yafo',
        street: 'Selected address',
        locationPlaceId: placeId,
        description: `A complete restaurant profile for testing ${runId}.`,
      }
    }

    try {
      const originalRestaurant = await createRestaurant('Original Cafe')
      const owner = await createUser('Existing Owner')
      const manager = await createUser(
        'Existing Manager',
        'restaurant',
      )
      await addMember(originalRestaurant.id, owner, 'owner')
      await addMember(
        originalRestaurant.id,
        manager,
        'hiringManager',
      )
      await prisma.restaurantOwnerProfile.update({
        where: { id: originalRestaurant.id },
        data: { qrEnabledRoles: ['socialManager'] },
      })
      const originalSnapshot = await prisma.restaurantOwnerProfile.findUniqueOrThrow({
        where: { id: originalRestaurant.id },
      })

      registerPlace(`second-${runId}`, '101')
      const secondResponse = await request<{
        id: string
        restaurantName: string
        slug: string
        qrEnabledRoles: string[]
      }>('/owner/restaurants', {
        userId: owner.id,
        restaurantId: originalRestaurant.id,
        method: 'POST',
        body: additionalRestaurantInput(
          'Second Cafe',
          `second-${runId}`,
        ),
      })
      assert.equal(secondResponse.status, 201)
      assert.equal(secondResponse.body.restaurantName, 'Second Cafe')
      createdRestaurantIds.add(secondResponse.body.id)

      const secondProfile =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: { id: secondResponse.body.id },
          include: {
            claim: true,
            jobs: true,
            members: true,
          },
        })
      createdUserIds.add(secondProfile.userId)
      assert.notEqual(secondProfile.userId, owner.id)
      assert.ok(secondProfile.claim?.claimedAt)
      assert.equal(secondProfile.jobs.length, 8)
      assert.ok(secondProfile.jobs.every((job) => !job.isActive))
      assert.notDeepEqual(secondProfile.qrEnabledRoles, ['socialManager'])
      assert.deepEqual(
        secondProfile.members.map((member) => ({
          userId: member.userId,
          role: member.role,
          status: member.status,
        })),
        [{ userId: owner.id, role: 'owner', status: 'active' }],
      )

      registerPlace(`third-${runId}`, '102')
      const thirdResponse = await request<{ id: string; slug: string }>(
        '/owner/restaurants',
        {
          userId: owner.id,
          restaurantId: secondProfile.id,
          method: 'POST',
          body: additionalRestaurantInput(
            'Third Cafe',
            `third-${runId}`,
          ),
        },
      )
      assert.equal(thirdResponse.status, 201)
      createdRestaurantIds.add(thirdResponse.body.id)
      const thirdProfile =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: { id: thirdResponse.body.id },
        })
      createdUserIds.add(thirdProfile.userId)

      const discovery = await request<{
        restaurants: Array<{
          restaurantId: string
          membershipRole: string
        }>
      }>('/owner/restaurants', { userId: owner.id })
      assert.equal(discovery.status, 200)
      assert.deepEqual(
        new Set(
          discovery.body.restaurants.map(
            (restaurant) => restaurant.restaurantId,
          ),
        ),
        new Set([
          originalRestaurant.id,
          secondProfile.id,
          thirdProfile.id,
        ]),
      )
      assert.ok(
        discovery.body.restaurants.every(
          (restaurant) => restaurant.membershipRole === 'owner',
        ),
      )

      const unchangedOriginal =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: { id: originalRestaurant.id },
        })
      assert.equal(
        unchangedOriginal.updatedAt.getTime(),
        originalSnapshot.updatedAt.getTime(),
      )
      assert.equal(
        unchangedOriginal.restaurantName,
        originalSnapshot.restaurantName,
      )
      assert.equal(
        await prisma.restaurantMember.count({
          where: {
            restaurantId: secondProfile.id,
            role: 'hiringManager',
          },
        }),
        0,
      )

      const secondQrUpdate = await request<{ qrEnabledRoles: string[] }>(
        '/owner/qr-roles',
        {
          userId: owner.id,
          restaurantId: secondProfile.id,
          method: 'PATCH',
          body: { qrEnabledRoles: ['barista'] },
        },
      )
      assert.equal(secondQrUpdate.status, 200)
      assert.deepEqual(secondQrUpdate.body.qrEnabledRoles, ['barista'])
      const originalAfterIndependentUpdate =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: { id: originalRestaurant.id },
          select: { qrEnabledRoles: true },
        })
      assert.deepEqual(
        originalAfterIndependentUpdate.qrEnabledRoles,
        ['socialManager'],
      )

      registerPlace(`manager-${runId}`, '103')
      const managerAttempt = await request('/owner/restaurants', {
        userId: manager.id,
        restaurantId: originalRestaurant.id,
        method: 'POST',
        body: additionalRestaurantInput(
          'Manager Cafe',
          `manager-${runId}`,
        ),
      })
      assert.equal(managerAttempt.status, 403)

      const mixedRoleUser = await createUser('Mixed Role Owner')
      const mixedOwnerRestaurant = await createRestaurant('Mixed Owner Cafe')
      const mixedManagerRestaurant = await createRestaurant(
        'Mixed Manager Cafe',
      )
      await addMember(mixedOwnerRestaurant.id, mixedRoleUser, 'owner')
      await addMember(
        mixedManagerRestaurant.id,
        mixedRoleUser,
        'hiringManager',
      )
      registerPlace(`mixed-blocked-${runId}`, '104')
      const mixedBlocked = await request('/owner/restaurants', {
        userId: mixedRoleUser.id,
        restaurantId: mixedManagerRestaurant.id,
        method: 'POST',
        body: additionalRestaurantInput(
          'Mixed Blocked Cafe',
          `mixed-blocked-${runId}`,
        ),
      })
      assert.equal(mixedBlocked.status, 403)

      registerPlace(`mixed-allowed-${runId}`, '105')
      const mixedAllowed = await request<{ id: string }>(
        '/owner/restaurants',
        {
          userId: mixedRoleUser.id,
          restaurantId: mixedOwnerRestaurant.id,
          method: 'POST',
          body: additionalRestaurantInput(
            'Mixed Allowed Cafe',
            `mixed-allowed-${runId}`,
          ),
        },
      )
      assert.equal(mixedAllowed.status, 201)
      createdRestaurantIds.add(mixedAllowed.body.id)
      const mixedAllowedProfile =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: { id: mixedAllowed.body.id },
        })
      createdUserIds.add(mixedAllowedProfile.userId)

      const unauthenticatedAttempt = await request(
        '/owner/restaurants',
        {
          method: 'POST',
          body: additionalRestaurantInput(
            'Unauthenticated Cafe',
            `manager-${runId}`,
          ),
        },
      )
      assert.equal(unauthenticatedAttempt.status, 401)

      const unrelatedRestaurant = await createRestaurant('Unrelated Cafe')
      const unrelatedAttempt = await request('/owner/restaurants', {
        userId: owner.id,
        restaurantId: unrelatedRestaurant.id,
        method: 'POST',
        body: additionalRestaurantInput(
          'Unauthorized Cafe',
          `manager-${runId}`,
        ),
      })
      assert.equal(unrelatedAttempt.status, 403)

      const callerOverrideAttempt = await request(
        '/owner/restaurants',
        {
          userId: owner.id,
          restaurantId: originalRestaurant.id,
          method: 'POST',
          body: {
            ...additionalRestaurantInput(
              'Caller Override Cafe',
              `manager-${runId}`,
            ),
            userId: manager.id,
          },
        },
      )
      assert.equal(callerOverrideAttempt.status, 400)

      const countsBeforeInvalid = {
        users: await prisma.user.count({
          where: { fullName: { contains: runId } },
        }),
        restaurants: await prisma.restaurantOwnerProfile.count({
          where: { description: { contains: runId } },
        }),
      }
      const invalidAttempt = await request('/owner/restaurants', {
        userId: owner.id,
        restaurantId: originalRestaurant.id,
        method: 'POST',
        body: {
          ...additionalRestaurantInput('', `manager-${runId}`),
          restaurantName: '',
        },
      })
      assert.equal(invalidAttempt.status, 400)
      assert.deepEqual(
        {
          users: await prisma.user.count({
            where: { fullName: { contains: runId } },
          }),
          restaurants: await prisma.restaurantOwnerProfile.count({
            where: { description: { contains: runId } },
          }),
        },
        countsBeforeInvalid,
      )

      registerPlace(`same-name-${runId}`, '106')
      const duplicateNameResponse = await request<{
        id: string
        slug: string
      }>('/owner/restaurants', {
        userId: owner.id,
        restaurantId: originalRestaurant.id,
        method: 'POST',
        body: additionalRestaurantInput(
          'Second Cafe',
          `same-name-${runId}`,
        ),
      })
      assert.equal(duplicateNameResponse.status, 201)
      assert.notEqual(
        duplicateNameResponse.body.slug,
        secondProfile.slug,
      )
      createdRestaurantIds.add(duplicateNameResponse.body.id)
      const duplicateNameProfile =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: { id: duplicateNameResponse.body.id },
        })
      createdUserIds.add(duplicateNameProfile.userId)

      const countsBeforeDuplicateLocation = {
        users: await prisma.user.count({
          where: { fullName: { contains: runId } },
        }),
        restaurants: await prisma.restaurantOwnerProfile.count({
          where: { description: { contains: runId } },
        }),
      }
      const duplicateLocationAttempt = await request(
        '/owner/restaurants',
        {
          userId: owner.id,
          restaurantId: originalRestaurant.id,
          method: 'POST',
          body: additionalRestaurantInput(
            'Accidental Duplicate Cafe',
            `second-${runId}`,
          ),
        },
      )
      assert.equal(duplicateLocationAttempt.status, 409)
      assert.deepEqual(
        {
          users: await prisma.user.count({
            where: { fullName: { contains: runId } },
          }),
          restaurants: await prisma.restaurantOwnerProfile.count({
            where: { description: { contains: runId } },
          }),
        },
        countsBeforeDuplicateLocation,
      )

      const firstTimeOwner = await createUser('First Time Owner')
      registerPlace(`first-owner-${runId}`, '107')
      const firstProfileResponse = await request<{ id: string }>(
        '/owner/profile',
        {
          userId: firstTimeOwner.id,
          method: 'PUT',
          body: additionalRestaurantInput(
            'First Owner Cafe',
            `first-owner-${runId}`,
          ),
        },
      )
      assert.equal(firstProfileResponse.status, 200)
      createdRestaurantIds.add(firstProfileResponse.body.id)
      assert.ok(
        await prisma.restaurantMember.findFirst({
          where: {
            restaurantId: firstProfileResponse.body.id,
            userId: firstTimeOwner.id,
            role: 'owner',
            status: 'active',
          },
        }),
      )
    } finally {
      clearGooglePlaceDetailsForTest()

      if (createdRestaurantIds.size > 0) {
        const profileUsers =
          await prisma.restaurantOwnerProfile.findMany({
            where: { id: { in: [...createdRestaurantIds] } },
            select: { userId: true },
          })

        for (const profileUser of profileUsers) {
          createdUserIds.add(profileUser.userId)
        }

        await prisma.restaurantOwnerProfile.deleteMany({
          where: { id: { in: [...createdRestaurantIds] } },
        })
      }

      if (createdUserIds.size > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: [...createdUserIds] } },
        })
      }

      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
      await prisma.$disconnect()
    }
  },
)
