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
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run Admin restaurant-team tests against DATABASE_URL.',
    )
  }

  if (databaseUrl && databaseUrl === testDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run Admin restaurant-team tests against the normal app database.',
    )
  }

  if (!testDatabaseUrl.toLowerCase().includes('test')) {
    throw new Error(
      'Admin restaurant-team tests require a dedicated database with test in its URL.',
    )
  }
}

assertSafeTestDatabaseUrl()

type ApiResponse<T> = {
  status: number
  body: T
}

type TeamMemberResponse = {
  id: string
  phoneNumber: string
  displayName: string
  role: 'owner' | 'hiringManager'
  status: 'active' | 'pending' | 'removed'
  user: {
    id: string
    fullName: string
    phoneNumber: string | null
  } | null
}

type AdminTeamResponse = {
  restaurantId: string
  members: TeamMemberResponse[]
}

type OwnerTeamResponse = {
  restaurant: { id: string }
  currentRole: 'owner' | 'hiringManager'
  members: TeamMemberResponse[]
}

type OwnerRestaurantsResponse = {
  restaurants: Array<{
    restaurantId: string
    restaurantName: string
    membershipRole: 'owner' | 'hiringManager'
  }>
}

type AuthResponse = {
  token: string
  user: {
    id: string
    restaurantMemberRole: 'owner' | 'hiringManager' | null
  }
}

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text()

  return {
    status: response.status,
    body: text ? (JSON.parse(text) as T) : ({} as T),
  }
}

test(
  'Admin Restaurant Team Management v1 is isolated, revocable, and race-safe',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run Admin restaurant-team tests.',
  },
  async (t) => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = normalizeDatabaseUrl(
      process.env.TEST_DATABASE_URL,
    )
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'admin-restaurant-team-test-secret'

    const runId = randomUUID()
    const adminEmail = `admin-team-${runId}@example.test`
    process.env.ADMIN_EMAILS = adminEmail

    const [
      { app },
      { prisma },
      { signAuthToken },
      { getCapturedOtpCodeForTest },
      {
        linkPendingRestaurantMemberships,
      },
      {
        removeRestaurantHiringManager,
      },
      {
        completeRestaurantClaim,
        createRestaurantClaim,
      },
    ] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js'),
      import('../lib/jwt.js'),
      import('../services/otpProvider.js'),
      import('../services/restaurantAccess.service.js'),
      import('../services/restaurantTeam.service.js'),
      import('../services/restaurantClaim.service.js'),
    ])

    const server = createServer(app)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${address.port}/api`
    const createdUserIds = new Set<string>()
    const createdRestaurantIds = new Set<string>()
    const testPhoneNumbers = new Set<string>()
    let phoneSequence = randomInt(10_000_000, 80_000_000)

    function createPhoneNumber() {
      phoneSequence += 1
      const phoneNumber = `+9725${phoneSequence
        .toString()
        .padStart(8, '0')}`
      testPhoneNumbers.add(phoneNumber)
      return phoneNumber
    }

    async function createUser(
      label: string,
      input: {
        phoneNumber?: string | null
        email?: string
        track?: 'highTech' | 'restaurant' | 'restaurantOwner'
      } = {},
    ) {
      const phoneNumber =
        input.phoneNumber === undefined
          ? createPhoneNumber()
          : input.phoneNumber

      if (phoneNumber) {
        testPhoneNumbers.add(phoneNumber)
      }

      const user = await prisma.user.create({
        data: {
          fullName: `${label} ${runId}`,
          ...(input.email ? { email: input.email } : {}),
          ...(phoneNumber
            ? {
                phoneNumber,
                phoneVerifiedAt: new Date(),
              }
            : {}),
          track: input.track ?? 'restaurantOwner',
        },
      })
      createdUserIds.add(user.id)
      return user
    }

    async function createRestaurant(
      label: string,
      profileUser?: Awaited<ReturnType<typeof createUser>>,
    ) {
      const ownerProfileUser =
        profileUser ??
        (await createUser(`${label} profile`, {
          phoneNumber: null,
        }))
      const slugLabel = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      const restaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: ownerProfileUser.id,
          restaurantName: `${label} ${runId}`,
          contactPerson: `${label} contact`,
          phoneNumber: '+972501111111',
          whatsappNumber: '+972501111112',
          city: 'Tel Aviv',
          street: 'Dizengoff 100',
          description: `${label} immutable description`,
          slug: `admin-team-${slugLabel}-${runId}`,
          qrEnabledRoles: ['waiter', 'cook'],
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
        displayName?: string
        role: 'owner' | 'hiringManager'
        status: 'active' | 'pending' | 'removed'
      },
    ) {
      testPhoneNumbers.add(input.phoneNumber)
      return prisma.restaurantMember.create({
        data: {
          restaurantId,
          phoneNumber: input.phoneNumber,
          ...(input.userId ? { userId: input.userId } : {}),
          displayName: input.displayName ?? `Member ${runId}`,
          role: input.role,
          status: input.status,
        },
      })
    }

    async function request<T>(
      path: string,
      options: RequestInit = {},
    ) {
      return readJson<T>(await fetch(`${baseUrl}${path}`, options))
    }

    function jsonHeaders(token?: string, restaurantId?: string) {
      return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(restaurantId
          ? { 'X-Restaurant-Id': restaurantId }
          : {}),
      }
    }

    async function registerByOtp(
      phoneNumber: string,
      label: string,
    ) {
      const requested = await request<{ ok?: boolean }>(
        '/auth/request-code',
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            phoneNumber,
            purpose: 'register',
          }),
        },
      )
      assert.equal(requested.status, 200)

      const code = getCapturedOtpCodeForTest(phoneNumber, 'register')
      assert.match(code ?? '', /^\d{4}$/)

      const verified = await request<AuthResponse>(
        '/auth/verify-code',
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            phoneNumber,
            code,
            purpose: 'register',
            fullName: `${label} ${runId}`,
            track: 'restaurantOwner',
          }),
        },
      )
      assert.equal(verified.status, 200)
      createdUserIds.add(verified.body.user.id)
      return verified.body
    }

    const admin = await createUser('Admin', {
      email: adminEmail,
      phoneNumber: null,
      track: 'highTech',
    })
    const nonAdmin = await createUser('Non-admin', {
      email: `non-admin-team-${runId}@example.test`,
      phoneNumber: null,
      track: 'highTech',
    })
    const adminToken = signAuthToken(admin.id)
    const nonAdminToken = signAuthToken(nonAdmin.id)

    try {
      await t.test(
        'admin-only endpoints add, list, and remove managers without crossing restaurant boundaries',
        async () => {
          const ownerA = await createUser('Endpoint owner A')
          const ownerB = await createUser('Endpoint owner B')
          const restaurantA = await createRestaurant(
            'Endpoint restaurant A',
            ownerA,
          )
          const restaurantB = await createRestaurant(
            'Endpoint restaurant B',
            ownerB,
          )
          const ownerMemberA = await addMember(restaurantA.id, {
            phoneNumber: ownerA.phoneNumber!,
            userId: ownerA.id,
            displayName: 'Owner A',
            role: 'owner',
            status: 'active',
          })
          const ownerMemberB = await addMember(restaurantB.id, {
            phoneNumber: ownerB.phoneNumber!,
            userId: ownerB.id,
            displayName: 'Owner B',
            role: 'owner',
            status: 'active',
          })
          const removedMember = await addMember(restaurantA.id, {
            phoneNumber: createPhoneNumber(),
            role: 'hiringManager',
            status: 'removed',
          })
          const untouchedJob = await prisma.restaurantJob.create({
            data: {
              ownerProfileId: restaurantA.id,
              restaurantName: restaurantA.restaurantName,
              role: 'waiter',
              location: restaurantA.city,
              area: restaurantA.street,
              description: 'Untouched job',
              kind: 'posted',
              isActive: true,
            },
          })
          const untouchedLead =
            await prisma.restaurantCandidateLead.create({
              data: {
                ownerProfileId: restaurantA.id,
                fullName: 'Untouched candidate',
                phoneNumber: createPhoneNumber(),
                wantedRoles: ['waiter'],
                experienceText: 'Untouched experience',
                status: 'contacted',
              },
            })
          const restaurantBefore =
            await prisma.restaurantOwnerProfile.findUniqueOrThrow({
              where: { id: restaurantA.id },
              select: {
                userId: true,
                restaurantName: true,
                contactPerson: true,
                phoneNumber: true,
                whatsappNumber: true,
                city: true,
                street: true,
                description: true,
                slug: true,
                qrEnabledRoles: true,
              },
            })
          const jobBefore =
            await prisma.restaurantJob.findUniqueOrThrow({
              where: { id: untouchedJob.id },
            })
          const leadBefore =
            await prisma.restaurantCandidateLead.findUniqueOrThrow({
              where: { id: untouchedLead.id },
            })

          const unauthenticated = await request(
            `/admin/restaurants/${restaurantA.id}/team`,
          )
          assert.equal(unauthenticated.status, 401)

          const forbidden = await request(
            `/admin/restaurants/${restaurantA.id}/team`,
            { headers: jsonHeaders(nonAdminToken) },
          )
          assert.equal(forbidden.status, 403)

          const teamA = await request<AdminTeamResponse>(
            `/admin/restaurants/${restaurantA.id}/team`,
            { headers: jsonHeaders(adminToken) },
          )
          assert.equal(teamA.status, 200)
          assert.equal(teamA.body.restaurantId, restaurantA.id)
          assert.deepEqual(
            teamA.body.members.map(({ id }) => id),
            [ownerMemberA.id],
          )
          assert.ok(
            !teamA.body.members.some(
              ({ id }) =>
                id === ownerMemberB.id || id === removedMember.id,
            ),
          )

          const ownerTeam = await request<OwnerTeamResponse>(
            '/owner/team',
            {
              headers: jsonHeaders(
                signAuthToken(ownerA.id),
                restaurantA.id,
              ),
            },
          )
          assert.equal(ownerTeam.status, 200)
          assert.equal(ownerTeam.body.currentRole, 'owner')
          assert.equal(ownerTeam.body.restaurant.id, restaurantA.id)

          const sharedManager = await createUser('Shared manager', {
            track: 'restaurant',
          })
          const addedToA = await request<TeamMemberResponse>(
            `/admin/restaurants/${restaurantA.id}/team/hiring-managers`,
            {
              method: 'POST',
              headers: jsonHeaders(adminToken),
              body: JSON.stringify({
                phoneNumber: sharedManager.phoneNumber,
                displayName: 'Shared manager',
              }),
            },
          )
          assert.equal(addedToA.status, 201)
          assert.equal(addedToA.body.status, 'active')
          assert.equal(addedToA.body.role, 'hiringManager')
          assert.equal(addedToA.body.user?.id, sharedManager.id)

          const addedToB = await request<TeamMemberResponse>(
            `/admin/restaurants/${restaurantB.id}/team/hiring-managers`,
            {
              method: 'POST',
              headers: jsonHeaders(adminToken),
              body: JSON.stringify({
                phoneNumber: sharedManager.phoneNumber,
                displayName: 'Shared manager B',
              }),
            },
          )
          assert.equal(addedToB.status, 201)
          assert.equal(addedToB.body.status, 'active')

          const sharedRestaurants =
            await request<OwnerRestaurantsResponse>(
              '/owner/restaurants',
              {
                headers: jsonHeaders(
                  signAuthToken(sharedManager.id),
                ),
              },
            )
          assert.equal(sharedRestaurants.status, 200)
          assert.deepEqual(
            sharedRestaurants.body.restaurants
              .map(({ restaurantId, membershipRole }) => ({
                restaurantId,
                membershipRole,
              }))
              .sort((left, right) =>
                left.restaurantId.localeCompare(right.restaurantId),
              ),
            [restaurantA.id, restaurantB.id]
              .sort()
              .map((restaurantId) => ({
                restaurantId,
                membershipRole: 'hiringManager' as const,
              })),
          )

          const managerCannotManageTeam = await request(
            '/owner/team',
            {
              headers: jsonHeaders(
                signAuthToken(sharedManager.id),
                restaurantA.id,
              ),
            },
          )
          assert.equal(managerCannotManageTeam.status, 403)

          const pendingPhone = createPhoneNumber()
          const pendingManager = await request<TeamMemberResponse>(
            `/admin/restaurants/${restaurantA.id}/team/hiring-managers`,
            {
              method: 'POST',
              headers: jsonHeaders(adminToken),
              body: JSON.stringify({
                phoneNumber: pendingPhone,
                displayName: 'Pending manager',
              }),
            },
          )
          assert.equal(pendingManager.status, 201)
          assert.equal(pendingManager.body.status, 'pending')
          assert.equal(pendingManager.body.user, null)

          const repeatedManager = await request<TeamMemberResponse>(
            `/admin/restaurants/${restaurantA.id}/team/hiring-managers`,
            {
              method: 'POST',
              headers: jsonHeaders(adminToken),
              body: JSON.stringify({
                phoneNumber: pendingPhone,
                displayName: 'Pending manager updated',
              }),
            },
          )
          assert.equal(repeatedManager.status, 200)
          assert.equal(repeatedManager.body.id, pendingManager.body.id)
          assert.equal(repeatedManager.body.status, 'pending')

          const ownerDowngrade = await request<{
            code?: string
          }>(
            `/admin/restaurants/${restaurantA.id}/team/hiring-managers`,
            {
              method: 'POST',
              headers: jsonHeaders(adminToken),
              body: JSON.stringify({
                phoneNumber: ownerA.phoneNumber,
                displayName: 'Not a manager',
              }),
            },
          )
          assert.equal(ownerDowngrade.status, 409)
          assert.equal(ownerDowngrade.body.code, 'OWNER_ROLE_PROTECTED')
          assert.deepEqual(
            await prisma.restaurantMember.findUniqueOrThrow({
              where: { id: ownerMemberA.id },
              select: { role: true, status: true, userId: true },
            }),
            {
              role: 'owner',
              status: 'active',
              userId: ownerA.id,
            },
          )

          const ownerRemovalRejected = await request(
            `/admin/restaurants/${restaurantA.id}/team/members/${ownerMemberA.id}`,
            {
              method: 'DELETE',
              headers: jsonHeaders(adminToken),
            },
          )
          assert.equal(ownerRemovalRejected.status, 409)
          assert.equal(
            (
              await prisma.restaurantMember.findUniqueOrThrow({
                where: { id: ownerMemberA.id },
              })
            ).status,
            'active',
          )

          const wrongRestaurantRemoval = await request(
            `/admin/restaurants/${restaurantA.id}/team/members/${addedToB.body.id}`,
            {
              method: 'DELETE',
              headers: jsonHeaders(adminToken),
            },
          )
          assert.equal(wrongRestaurantRemoval.status, 404)
          assert.equal(
            (
              await prisma.restaurantMember.findUniqueOrThrow({
                where: { id: addedToB.body.id },
              })
            ).status,
            'active',
          )

          const removedPending = await request(
            `/admin/restaurants/${restaurantA.id}/team/members/${pendingManager.body.id}`,
            {
              method: 'DELETE',
              headers: jsonHeaders(adminToken),
            },
          )
          assert.equal(removedPending.status, 204)
          assert.equal(
            (
              await prisma.restaurantMember.findUniqueOrThrow({
                where: { id: pendingManager.body.id },
              })
            ).status,
            'removed',
          )

          const removedFromA = await request(
            `/admin/restaurants/${restaurantA.id}/team/members/${addedToA.body.id}`,
            {
              method: 'DELETE',
              headers: jsonHeaders(adminToken),
            },
          )
          assert.equal(removedFromA.status, 204)
          const sharedAfterRemoval =
            await request<OwnerRestaurantsResponse>(
              '/owner/restaurants',
              {
                headers: jsonHeaders(
                  signAuthToken(sharedManager.id),
                ),
              },
            )
          assert.deepEqual(
            sharedAfterRemoval.body.restaurants.map(
              ({ restaurantId }) => restaurantId,
            ),
            [restaurantB.id],
          )
          const removedManagerCannotReadA = await request(
            '/owner/jobs',
            {
              headers: jsonHeaders(
                signAuthToken(sharedManager.id),
                restaurantA.id,
              ),
            },
          )
          assert.equal(removedManagerCannotReadA.status, 403)
          const managerStillReadsB = await request(
            '/owner/jobs',
            {
              headers: jsonHeaders(
                signAuthToken(sharedManager.id),
                restaurantB.id,
              ),
            },
          )
          assert.equal(managerStillReadsB.status, 200)

          const reactivatedManager = await request<TeamMemberResponse>(
            `/admin/restaurants/${restaurantA.id}/team/hiring-managers`,
            {
              method: 'POST',
              headers: jsonHeaders(adminToken),
              body: JSON.stringify({
                phoneNumber: sharedManager.phoneNumber,
                displayName: 'Shared manager restored',
              }),
            },
          )
          assert.equal(reactivatedManager.status, 200)
          assert.equal(reactivatedManager.body.id, addedToA.body.id)
          assert.equal(reactivatedManager.body.status, 'active')

          const removedAgain = await request(
            `/admin/restaurants/${restaurantA.id}/team/members/${addedToA.body.id}`,
            {
              method: 'DELETE',
              headers: jsonHeaders(adminToken),
            },
          )
          assert.equal(removedAgain.status, 204)

          assert.deepEqual(
            await prisma.restaurantOwnerProfile.findUniqueOrThrow({
              where: { id: restaurantA.id },
              select: {
                userId: true,
                restaurantName: true,
                contactPerson: true,
                phoneNumber: true,
                whatsappNumber: true,
                city: true,
                street: true,
                description: true,
                slug: true,
                qrEnabledRoles: true,
              },
            }),
            restaurantBefore,
          )
          assert.deepEqual(
            await prisma.restaurantJob.findUniqueOrThrow({
              where: { id: untouchedJob.id },
            }),
            jobBefore,
          )
          assert.deepEqual(
            await prisma.restaurantCandidateLead.findUniqueOrThrow({
              where: { id: untouchedLead.id },
            }),
            leadBefore,
          )
        },
      )

      await t.test(
        'owner replacement promotes an existing user, preserves other memberships, and links only a live pending phone',
        async () => {
          const oldOwner = await createUser('Old legacy owner')
          const replacementUser = await createUser(
            'Existing replacement owner',
          )
          const restaurant = await createRestaurant(
            'Existing replacement restaurant',
            oldOwner,
          )
          const oldOwnerMember = await addMember(restaurant.id, {
            phoneNumber: oldOwner.phoneNumber!,
            userId: oldOwner.id,
            displayName: 'Old owner',
            role: 'owner',
            status: 'active',
          })
          const replacementMember = await addMember(restaurant.id, {
            phoneNumber: replacementUser.phoneNumber!,
            userId: replacementUser.id,
            displayName: 'Existing manager',
            role: 'hiringManager',
            status: 'active',
          })

          const otherOwner = await createUser('Other restaurant owner')
          const otherRestaurant = await createRestaurant(
            'Old owner retained restaurant',
            otherOwner,
          )
          await addMember(otherRestaurant.id, {
            phoneNumber: otherOwner.phoneNumber!,
            userId: otherOwner.id,
            role: 'owner',
            status: 'active',
          })
          const retainedMembership = await addMember(
            otherRestaurant.id,
            {
              phoneNumber: oldOwner.phoneNumber!,
              userId: oldOwner.id,
              displayName: 'Retained manager',
              role: 'hiringManager',
              status: 'active',
            },
          )
          const invariantJob = await prisma.restaurantJob.create({
            data: {
              ownerProfileId: restaurant.id,
              restaurantName: restaurant.restaurantName,
              role: 'cook',
              location: restaurant.city,
              area: restaurant.street,
              description: 'Replacement-invariant job',
              kind: 'posted',
              isActive: true,
            },
          })
          const invariantLead =
            await prisma.restaurantCandidateLead.create({
              data: {
                ownerProfileId: restaurant.id,
                fullName: 'Replacement-invariant lead',
                phoneNumber: createPhoneNumber(),
                wantedRoles: ['cook'],
                status: 'relevant',
              },
            })
          const profileBefore =
            await prisma.restaurantOwnerProfile.findUniqueOrThrow({
              where: { id: restaurant.id },
            })
          const jobBefore =
            await prisma.restaurantJob.findUniqueOrThrow({
              where: { id: invariantJob.id },
            })
          const leadBefore =
            await prisma.restaurantCandidateLead.findUniqueOrThrow({
              where: { id: invariantLead.id },
            })

          const replaced = await request<TeamMemberResponse>(
            `/admin/restaurants/${restaurant.id}/team/owners/${oldOwnerMember.id}/replace`,
            {
              method: 'POST',
              headers: jsonHeaders(adminToken),
              body: JSON.stringify({
                phoneNumber: replacementUser.phoneNumber,
                displayName: 'Promoted owner',
              }),
            },
          )
          assert.equal(replaced.status, 200)
          assert.equal(replaced.body.id, replacementMember.id)
          assert.equal(replaced.body.role, 'owner')
          assert.equal(replaced.body.status, 'active')
          assert.equal(replaced.body.user?.id, replacementUser.id)
          assert.deepEqual(
            await prisma.restaurantMember.findUniqueOrThrow({
              where: { id: oldOwnerMember.id },
              select: { role: true, status: true, userId: true },
            }),
            {
              role: 'owner',
              status: 'removed',
              userId: oldOwner.id,
            },
          )

          const profileStillPointsAtLegacyUser =
            await prisma.restaurantOwnerProfile.findUniqueOrThrow({
              where: { id: restaurant.id },
              select: { userId: true },
            })
          assert.equal(profileStillPointsAtLegacyUser.userId, oldOwner.id)

          const revokedLegacyAccess = await request(
            '/owner/team',
            {
              headers: jsonHeaders(
                signAuthToken(oldOwner.id),
                restaurant.id,
              ),
            },
          )
          assert.equal(revokedLegacyAccess.status, 403)

          const oldOwnerRestaurants =
            await request<OwnerRestaurantsResponse>(
              '/owner/restaurants',
              {
                headers: jsonHeaders(signAuthToken(oldOwner.id)),
              },
            )
          assert.ok(
            !oldOwnerRestaurants.body.restaurants.some(
              ({ restaurantId }) => restaurantId === restaurant.id,
            ),
          )
          assert.deepEqual(
            oldOwnerRestaurants.body.restaurants.map(
              ({ restaurantId, membershipRole }) => ({
                restaurantId,
                membershipRole,
              }),
            ),
            [
              {
                restaurantId: otherRestaurant.id,
                membershipRole: 'hiringManager',
              },
            ],
          )
          assert.deepEqual(
            await prisma.restaurantMember.findUniqueOrThrow({
              where: { id: retainedMembership.id },
              select: { userId: true, role: true, status: true },
            }),
            {
              userId: oldOwner.id,
              role: 'hiringManager',
              status: 'active',
            },
          )

          const promotedOwnerTeam = await request<OwnerTeamResponse>(
            '/owner/team',
            {
              headers: jsonHeaders(
                signAuthToken(replacementUser.id),
                restaurant.id,
              ),
            },
          )
          assert.equal(promotedOwnerTeam.status, 200)
          assert.equal(promotedOwnerTeam.body.currentRole, 'owner')
          assert.equal(promotedOwnerTeam.body.restaurant.id, restaurant.id)
          assert.deepEqual(
            promotedOwnerTeam.body.members.map(({ id }) => id),
            [replacementMember.id],
          )

          assert.deepEqual(
            await prisma.restaurantOwnerProfile.findUniqueOrThrow({
              where: { id: restaurant.id },
            }),
            profileBefore,
          )
          assert.deepEqual(
            await prisma.restaurantJob.findUniqueOrThrow({
              where: { id: invariantJob.id },
            }),
            jobBefore,
          )
          assert.deepEqual(
            await prisma.restaurantCandidateLead.findUniqueOrThrow({
              where: { id: invariantLead.id },
            }),
            leadBefore,
          )

          const pendingOldOwner = await createUser('Pending old owner')
          const pendingRestaurant = await createRestaurant(
            'Pending replacement restaurant',
            pendingOldOwner,
          )
          const pendingOldOwnerMember = await addMember(
            pendingRestaurant.id,
            {
              phoneNumber: pendingOldOwner.phoneNumber!,
              userId: pendingOldOwner.id,
              role: 'owner',
              status: 'active',
            },
          )
          const pendingReplacementPhone = createPhoneNumber()
          const pendingReplacement = await request<TeamMemberResponse>(
            `/admin/restaurants/${pendingRestaurant.id}/team/owners/${pendingOldOwnerMember.id}/replace`,
            {
              method: 'POST',
              headers: jsonHeaders(adminToken),
              body: JSON.stringify({
                phoneNumber: pendingReplacementPhone,
                displayName: 'Pending replacement',
              }),
            },
          )
          assert.equal(pendingReplacement.status, 200)
          assert.equal(pendingReplacement.body.role, 'owner')
          assert.equal(pendingReplacement.body.status, 'pending')
          assert.equal(pendingReplacement.body.user, null)

          const oldPendingOwnerDenied = await request(
            '/owner/profile',
            {
              headers: jsonHeaders(
                signAuthToken(pendingOldOwner.id),
                pendingRestaurant.id,
              ),
            },
          )
          assert.equal(oldPendingOwnerDenied.status, 403)

          const otpOwner = await registerByOtp(
            pendingReplacementPhone,
            'OTP replacement owner',
          )
          assert.equal(otpOwner.user.restaurantMemberRole, 'owner')
          assert.deepEqual(
            await prisma.restaurantMember.findUniqueOrThrow({
              where: { id: pendingReplacement.body.id },
              select: { userId: true, role: true, status: true },
            }),
            {
              userId: otpOwner.user.id,
              role: 'owner',
              status: 'active',
            },
          )
          const otpOwnerTeam = await request<OwnerTeamResponse>(
            '/owner/team',
            {
              headers: jsonHeaders(
                otpOwner.token,
                pendingRestaurant.id,
              ),
            },
          )
          assert.equal(otpOwnerTeam.status, 200)
          assert.equal(otpOwnerTeam.body.currentRole, 'owner')

          const revokedPhone = createPhoneNumber()
          const revokedInvite = await request<TeamMemberResponse>(
            `/admin/restaurants/${pendingRestaurant.id}/team/hiring-managers`,
            {
              method: 'POST',
              headers: jsonHeaders(adminToken),
              body: JSON.stringify({
                phoneNumber: revokedPhone,
                displayName: 'Revoked before OTP',
              }),
            },
          )
          assert.equal(revokedInvite.status, 201)
          assert.equal(revokedInvite.body.status, 'pending')
          const revoked = await request(
            `/admin/restaurants/${pendingRestaurant.id}/team/members/${revokedInvite.body.id}`,
            {
              method: 'DELETE',
              headers: jsonHeaders(adminToken),
            },
          )
          assert.equal(revoked.status, 204)
          const revokedOtpUser = await registerByOtp(
            revokedPhone,
            'Revoked OTP manager',
          )
          assert.equal(revokedOtpUser.user.restaurantMemberRole, null)
          assert.deepEqual(
            await prisma.restaurantMember.findUniqueOrThrow({
              where: { id: revokedInvite.body.id },
              select: { userId: true, status: true },
            }),
            { userId: null, status: 'removed' },
          )
        },
      )

      await t.test(
        'ambiguous or conflicting ownership returns 409 and leaves every membership unchanged',
        async () => {
          const owner = await createUser('Ambiguous owner')
          const restaurant = await createRestaurant(
            'Ambiguous ownership restaurant',
            owner,
          )
          const selectedOwner = await addMember(restaurant.id, {
            phoneNumber: owner.phoneNumber!,
            userId: owner.id,
            role: 'owner',
            status: 'active',
          })
          const secondOwner = await addMember(restaurant.id, {
            phoneNumber: createPhoneNumber(),
            role: 'owner',
            status: 'pending',
          })
          const ambiguousBefore =
            await prisma.restaurantMember.findMany({
              where: {
                id: { in: [selectedOwner.id, secondOwner.id] },
              },
              orderBy: { id: 'asc' },
            })

          const ambiguous = await request<{ code?: string }>(
            `/admin/restaurants/${restaurant.id}/team/owners/${selectedOwner.id}/replace`,
            {
              method: 'POST',
              headers: jsonHeaders(adminToken),
              body: JSON.stringify({
                phoneNumber: createPhoneNumber(),
                displayName: 'Must not be written',
              }),
            },
          )
          assert.equal(ambiguous.status, 409)
          assert.equal(ambiguous.body.code, 'OWNER_STATE_CONFLICT')
          assert.deepEqual(
            await prisma.restaurantMember.findMany({
              where: {
                id: { in: [selectedOwner.id, secondOwner.id] },
              },
              orderBy: { id: 'asc' },
            }),
            ambiguousBefore,
          )
          assert.equal(
            await prisma.restaurantMember.count({
              where: { restaurantId: restaurant.id },
            }),
            2,
          )

          const conflictOwner = await createUser('Conflict owner')
          const conflictRestaurant = await createRestaurant(
            'Identity conflict restaurant',
            conflictOwner,
          )
          const conflictSelectedOwner = await addMember(
            conflictRestaurant.id,
            {
              phoneNumber: conflictOwner.phoneNumber!,
              userId: conflictOwner.id,
              role: 'owner',
              status: 'active',
            },
          )
          const conflictedUser = await createUser('Conflicted user')
          const membershipByPhone = await addMember(
            conflictRestaurant.id,
            {
              phoneNumber: conflictedUser.phoneNumber!,
              role: 'hiringManager',
              status: 'pending',
            },
          )
          const membershipByUser = await addMember(
            conflictRestaurant.id,
            {
              phoneNumber: createPhoneNumber(),
              userId: conflictedUser.id,
              role: 'hiringManager',
              status: 'active',
            },
          )
          const conflictIds = [
            conflictSelectedOwner.id,
            membershipByPhone.id,
            membershipByUser.id,
          ]
          const conflictBefore =
            await prisma.restaurantMember.findMany({
              where: { id: { in: conflictIds } },
              orderBy: { id: 'asc' },
            })

          const identityConflict = await request<{ code?: string }>(
            `/admin/restaurants/${conflictRestaurant.id}/team/owners/${conflictSelectedOwner.id}/replace`,
            {
              method: 'POST',
              headers: jsonHeaders(adminToken),
              body: JSON.stringify({
                phoneNumber: conflictedUser.phoneNumber,
                displayName: 'Conflicting owner',
              }),
            },
          )
          assert.equal(identityConflict.status, 409)
          assert.equal(identityConflict.body.code, 'MEMBERSHIP_CONFLICT')
          assert.deepEqual(
            await prisma.restaurantMember.findMany({
              where: { id: { in: conflictIds } },
              orderBy: { id: 'asc' },
            }),
            conflictBefore,
          )
        },
      )

      await t.test(
        'link-vs-remove and claim-vs-link races converge on revoked access and one active owner',
        async () => {
          const raceOwner = await createUser('Removal race owner')
          const removalRaceRestaurant = await createRestaurant(
            'Removal race restaurant',
            raceOwner,
          )
          await addMember(removalRaceRestaurant.id, {
            phoneNumber: raceOwner.phoneNumber!,
            userId: raceOwner.id,
            role: 'owner',
            status: 'active',
          })
          const racingPhone = createPhoneNumber()
          const racingInvite = await addMember(
            removalRaceRestaurant.id,
            {
              phoneNumber: racingPhone,
              role: 'hiringManager',
              status: 'pending',
            },
          )
          const racingUser = await createUser('Racing manager', {
            phoneNumber: racingPhone,
            track: 'restaurant',
          })

          await Promise.all([
            linkPendingRestaurantMemberships(
              racingUser.id,
              racingUser.phoneNumber,
            ),
            removeRestaurantHiringManager({
              restaurantId: removalRaceRestaurant.id,
              memberId: racingInvite.id,
            }),
          ])

          const finalRacingInvite =
            await prisma.restaurantMember.findUniqueOrThrow({
              where: { id: racingInvite.id },
            })
          assert.equal(finalRacingInvite.status, 'removed')
          assert.ok(
            finalRacingInvite.userId === null ||
              finalRacingInvite.userId === racingUser.id,
          )
          const racingUserRestaurants =
            await request<OwnerRestaurantsResponse>(
              '/owner/restaurants',
              {
                headers: jsonHeaders(signAuthToken(racingUser.id)),
              },
            )
          assert.equal(racingUserRestaurants.status, 403)

          const claimRaceRestaurant = await createRestaurant(
            'Claim activation race restaurant',
          )
          const pendingOwnerPhone = createPhoneNumber()
          const pendingOwner = await createUser('Pending race owner', {
            phoneNumber: pendingOwnerPhone,
          })
          const pendingOwnerMembership = await addMember(
            claimRaceRestaurant.id,
            {
              phoneNumber: pendingOwnerPhone,
              role: 'owner',
              status: 'pending',
            },
          )
          const claimant = await createUser('Competing claimant')
          const { token: claimToken } = await createRestaurantClaim(
            prisma,
            claimRaceRestaurant.id,
          )

          const [claimResult, linkResult] = await Promise.allSettled([
            completeRestaurantClaim({
              restaurantSlug: claimRaceRestaurant.slug!,
              token: claimToken,
              userId: claimant.id,
            }),
            linkPendingRestaurantMemberships(
              pendingOwner.id,
              pendingOwner.phoneNumber,
            ),
          ])

          assert.equal(linkResult.status, 'fulfilled')
          if (claimResult.status === 'rejected') {
            assert.equal(
              (claimResult.reason as { code?: string }).code,
              'ALREADY_ACTIVATED',
            )
          }

          const activeOwners = await prisma.restaurantMember.findMany({
            where: {
              restaurantId: claimRaceRestaurant.id,
              role: 'owner',
              status: 'active',
            },
          })
          assert.equal(activeOwners.length, 1)
          assert.ok(
            activeOwners[0]?.userId === pendingOwner.id ||
              activeOwners[0]?.userId === claimant.id,
          )
          assert.equal(
            await prisma.restaurantMember.count({
              where: {
                restaurantId: claimRaceRestaurant.id,
                role: 'owner',
                status: 'pending',
              },
            }),
            0,
          )
          const finalPendingOwnerMembership =
            await prisma.restaurantMember.findUniqueOrThrow({
              where: { id: pendingOwnerMembership.id },
            })
          assert.ok(
            finalPendingOwnerMembership.status === 'active' ||
              finalPendingOwnerMembership.status === 'removed',
          )
        },
      )
    } finally {
      if (createdRestaurantIds.size > 0) {
        await prisma.restaurantOwnerProfile.deleteMany({
          where: { id: { in: [...createdRestaurantIds] } },
        })
      }

      if (testPhoneNumbers.size > 0) {
        await prisma.otpVerification.deleteMany({
          where: {
            phoneNumber: { in: [...testPhoneNumbers] },
          },
        })
      }

      if (createdUserIds.size > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: [...createdUserIds] } },
        })
      }

      await new Promise<void>((resolve, reject) => {
        server.close((error) =>
          error ? reject(error) : resolve(),
        )
      })
      await prisma.$disconnect()
    }
  },
)
