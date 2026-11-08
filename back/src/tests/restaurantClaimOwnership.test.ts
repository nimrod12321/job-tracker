import assert from 'node:assert/strict'
import { randomInt, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import 'dotenv/config'
import type { Express } from 'express'

const shouldRunSecurityTests = process.env.RUN_SECURITY_TESTS === 'true'

function normalizeDatabaseUrl(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, '')
}

function assertSafeTestDatabaseUrl() {
  if (!shouldRunSecurityTests) return

  const testDatabaseUrl = normalizeDatabaseUrl(
    process.env.TEST_DATABASE_URL,
  )
  const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL)

  if (!testDatabaseUrl) {
    throw new Error(
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run restaurant-claim tests against DATABASE_URL.',
    )
  }

  if (databaseUrl && databaseUrl === testDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run restaurant-claim tests against the normal app database.',
    )
  }

  if (!testDatabaseUrl.toLowerCase().includes('test')) {
    throw new Error(
      'Restaurant-claim tests require a dedicated database with test in its URL.',
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
  'restaurant claims retire competing pending owners without weakening existing ownership',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run restaurant-claim ownership tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'restaurant-claim-ownership-test-secret'

    const [
      { app },
      { prisma },
      { signAuthToken },
      { createRestaurantClaim },
      { linkPendingRestaurantMemberships },
    ] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js'),
      import('../lib/jwt.js'),
      import('../services/restaurantClaim.service.js'),
      import('../services/restaurantAccess.service.js'),
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

    async function createUser(label: string, phoneNumber = createPhone()) {
      const user = await prisma.user.create({
        data: {
          fullName: `${label} ${runId}`,
          phoneNumber,
          phoneVerifiedAt: new Date(),
          track: 'restaurantOwner',
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
          city: 'Tel Aviv',
          street: 'Dizengoff',
          slug: `${label.toLowerCase().replaceAll(' ', '-')}-${runId}`,
        },
      })
      createdRestaurantIds.add(restaurant.id)
      return restaurant
    }

    async function addMember(
      restaurantId: string,
      input: {
        phoneNumber: string
        userId?: string
        role: 'owner' | 'hiringManager'
        status: 'active' | 'pending' | 'removed'
      },
    ) {
      return prisma.restaurantMember.create({
        data: {
          restaurantId,
          phoneNumber: input.phoneNumber,
          ...(input.userId ? { userId: input.userId } : {}),
          displayName: `Member ${runId}`,
          role: input.role,
          status: input.status,
        },
      })
    }

    async function createClaim(restaurantId: string) {
      return createRestaurantClaim(prisma, restaurantId)
    }

    async function completeClaim(
      slug: string,
      token: string,
      userId: string,
    ) {
      return readJson<{
        alreadyOwned?: boolean
        code?: string
      }>(
        await fetch(`${baseUrl}/owner/claims/${slug}/complete`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${signAuthToken(userId)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        }),
      )
    }

    try {
      const existingOwner = await createUser('Existing Owner')
      const cafeA = await createRestaurant('Cafe A')
      const cafeAOwnerMembership = await addMember(cafeA.id, {
        phoneNumber: existingOwner.phoneNumber!,
        userId: existingOwner.id,
        role: 'owner',
        status: 'active',
      })

      const cafeB = await createRestaurant('Cafe B')
      const cafeBClaim = await createClaim(cafeB.id)
      const displacedPhone = createPhone()
      const displacedPendingOwner = await addMember(cafeB.id, {
        phoneNumber: displacedPhone,
        role: 'owner',
        status: 'pending',
      })

      const secondRestaurantClaim = await completeClaim(
        cafeB.slug!,
        cafeBClaim.token,
        existingOwner.id,
      )
      assert.equal(secondRestaurantClaim.status, 200)
      assert.equal(secondRestaurantClaim.body.alreadyOwned, false)

      assert.ok(
        await prisma.restaurantMember.findFirst({
          where: {
            id: cafeAOwnerMembership.id,
            userId: existingOwner.id,
            role: 'owner',
            status: 'active',
          },
        }),
      )
      assert.equal(
        await prisma.restaurantMember.count({
          where: {
            restaurantId: cafeB.id,
            userId: existingOwner.id,
            role: 'owner',
            status: 'active',
          },
        }),
        1,
      )
      assert.ok(
        (
          await prisma.restaurantClaim.findUniqueOrThrow({
            where: { restaurantOwnerProfileId: cafeB.id },
          })
        ).claimedAt,
      )
      assert.equal(
        (
          await prisma.restaurantMember.findUniqueOrThrow({
            where: { id: displacedPendingOwner.id },
          })
        ).status,
        'removed',
      )

      const displacedUser = await createUser(
        'Displaced Pending Owner',
        displacedPhone,
      )
      await linkPendingRestaurantMemberships(
        displacedUser.id,
        displacedUser.phoneNumber,
      )
      assert.equal(
        await prisma.restaurantMember.count({
          where: {
            restaurantId: cafeB.id,
            userId: displacedUser.id,
            role: 'owner',
            status: 'active',
          },
        }),
        0,
      )
      assert.equal(
        (
          await prisma.restaurantMember.findUniqueOrThrow({
            where: { id: displacedPendingOwner.id },
          })
        ).status,
        'removed',
      )

      const reuseUser = await createUser('Claim Reuse User')
      const reuseAttempt = await completeClaim(
        cafeB.slug!,
        cafeBClaim.token,
        reuseUser.id,
      )
      assert.equal(reuseAttempt.status, 409)
      assert.equal(reuseAttempt.body.code, 'ALREADY_ACTIVATED')
      assert.equal(
        await prisma.restaurantMember.count({
          where: {
            restaurantId: cafeB.id,
            userId: reuseUser.id,
          },
        }),
        0,
      )

      const samePhoneUser = await createUser('Same Phone Owner')
      const samePhoneCafe = await createRestaurant('Same Phone Cafe')
      const samePhoneClaim = await createClaim(samePhoneCafe.id)
      const samePhoneMembership = await addMember(samePhoneCafe.id, {
        phoneNumber: samePhoneUser.phoneNumber!,
        role: 'owner',
        status: 'pending',
      })
      const samePhoneCompetitor = await addMember(samePhoneCafe.id, {
        phoneNumber: createPhone(),
        role: 'owner',
        status: 'pending',
      })

      await linkPendingRestaurantMemberships(
        samePhoneUser.id,
        samePhoneUser.phoneNumber,
      )
      const samePhoneCompletion = await completeClaim(
        samePhoneCafe.slug!,
        samePhoneClaim.token,
        samePhoneUser.id,
      )
      assert.equal(samePhoneCompletion.status, 200)
      assert.equal(samePhoneCompletion.body.alreadyOwned, true)
      assert.deepEqual(
        await prisma.restaurantMember.findUniqueOrThrow({
          where: { id: samePhoneMembership.id },
          select: { userId: true, role: true, status: true },
        }),
        {
          userId: samePhoneUser.id,
          role: 'owner',
          status: 'active',
        },
      )
      assert.equal(
        (
          await prisma.restaurantMember.findUniqueOrThrow({
            where: { id: samePhoneCompetitor.id },
          })
        ).status,
        'removed',
      )

      const activeOwnerCafe = await createRestaurant('Active Owner Cafe')
      const activeOwnerClaim = await createClaim(activeOwnerCafe.id)
      const activeCafeOwner = await createUser('Active Cafe Owner')
      const blockedClaimant = await createUser('Blocked Claimant')
      const activeOwnerMembership = await addMember(activeOwnerCafe.id, {
        phoneNumber: activeCafeOwner.phoneNumber!,
        userId: activeCafeOwner.id,
        role: 'owner',
        status: 'active',
      })
      const blockedAttempt = await completeClaim(
        activeOwnerCafe.slug!,
        activeOwnerClaim.token,
        blockedClaimant.id,
      )
      assert.equal(blockedAttempt.status, 409)
      assert.equal(blockedAttempt.body.code, 'ALREADY_ACTIVATED')
      assert.ok(
        await prisma.restaurantMember.findFirst({
          where: {
            id: activeOwnerMembership.id,
            userId: activeCafeOwner.id,
            status: 'active',
          },
        }),
      )
      assert.equal(
        (
          await prisma.restaurantClaim.findUniqueOrThrow({
            where: {
              restaurantOwnerProfileId: activeOwnerCafe.id,
            },
          })
        ).claimedAt,
        null,
      )

      const rollbackOwner = await createUser('Rollback Owner')
      const rollbackCafeA = await createRestaurant('Rollback Cafe A')
      const rollbackCafeAOwner = await addMember(rollbackCafeA.id, {
        phoneNumber: rollbackOwner.phoneNumber!,
        userId: rollbackOwner.id,
        role: 'owner',
        status: 'active',
      })
      const rollbackCafeB = await createRestaurant('Rollback Cafe B')
      const rollbackClaim = await createClaim(rollbackCafeB.id)
      const rollbackPending = await addMember(rollbackCafeB.id, {
        phoneNumber: rollbackOwner.phoneNumber!,
        role: 'owner',
        status: 'pending',
      })
      const rollbackManagerPhone = createPhone()
      const rollbackManager = await addMember(rollbackCafeB.id, {
        phoneNumber: rollbackManagerPhone,
        userId: rollbackOwner.id,
        role: 'hiringManager',
        status: 'active',
      })

      const failedClaim = await completeClaim(
        rollbackCafeB.slug!,
        rollbackClaim.token,
        rollbackOwner.id,
      )
      assert.equal(failedClaim.status, 500)
      assert.deepEqual(
        await prisma.restaurantMember.findUniqueOrThrow({
          where: { id: rollbackPending.id },
          select: { userId: true, role: true, status: true },
        }),
        { userId: null, role: 'owner', status: 'pending' },
      )
      assert.deepEqual(
        await prisma.restaurantMember.findUniqueOrThrow({
          where: { id: rollbackManager.id },
          select: {
            phoneNumber: true,
            userId: true,
            role: true,
            status: true,
          },
        }),
        {
          phoneNumber: rollbackManagerPhone,
          userId: rollbackOwner.id,
          role: 'hiringManager',
          status: 'active',
        },
      )
      assert.ok(
        await prisma.restaurantMember.findFirst({
          where: {
            id: rollbackCafeAOwner.id,
            userId: rollbackOwner.id,
            role: 'owner',
            status: 'active',
          },
        }),
      )
      assert.equal(
        (
          await prisma.restaurantClaim.findUniqueOrThrow({
            where: {
              restaurantOwnerProfileId: rollbackCafeB.id,
            },
          })
        ).claimedAt,
        null,
      )
    } finally {
      if (createdRestaurantIds.size > 0) {
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
