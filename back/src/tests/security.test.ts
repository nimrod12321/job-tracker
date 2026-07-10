import { createServer, type Server } from 'node:http'
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
  if (!shouldRunSecurityTests) {
    return
  }

  const testDatabaseUrl = normalizeDatabaseUrl(process.env.TEST_DATABASE_URL)
  const regularDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL)

  if (!testDatabaseUrl) {
    throw new Error(
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run against DATABASE_URL.',
    )
  }

  if (regularDatabaseUrl && testDatabaseUrl === regularDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run security tests against the normal app database.',
    )
  }

  const parsedUrl = new URL(testDatabaseUrl)
  const normalizedUrl = testDatabaseUrl.toLowerCase()
  const databaseName = parsedUrl.pathname.replace(/^\//, '').toLowerCase()
  const host = parsedUrl.hostname.toLowerCase()
  const clearlyTestDatabase =
    normalizedUrl.includes('test') || normalizedUrl.includes('testing')

  if (
    !clearlyTestDatabase &&
    (normalizedUrl.includes('peepss') ||
      normalizedUrl.includes('production') ||
      normalizedUrl.includes('prod') ||
      host.includes('neon.tech'))
  ) {
    throw new Error(
      'TEST_DATABASE_URL looks production-like. Use a dedicated database with test in the name, never the Peepss production database.',
    )
  }
}

assertSafeTestDatabaseUrl()

type ApiResponse<T> = {
  status: number
  body: T
}

type AuthResponse = {
  token: string
  user?: {
    id?: string
    phoneNumber?: string | null
    restaurantMemberRole?: 'owner' | 'hiringManager' | null
  }
}

type OwnerTeamMemberResponse = {
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

type OwnerTeamResponse = {
  currentRole: 'owner' | 'hiringManager'
  members: OwnerTeamMemberResponse[]
}

type OwnerProfileResponse = {
  id: string
  slug: string | null
}

type OwnerJobResponse = {
  id: string
  kind: 'draft' | 'posted'
  isActive: boolean
}

type RestaurantExploreResponse = {
  jobs: Array<{
    id: string
    restaurantName: string
    contactPhone?: unknown
    contactWhatsapp?: unknown
  }>
}

type AdminRestaurantResponse = {
  id: string
  restaurantName: string
  slug: string | null
  city: string
  street: string
  qrLeadsCount: number
  hasNewCandidate: boolean
  newCandidateCount: number
  ownerUser: {
    id: string
    phoneNumber: string | null
  } | null
}

type AdminRestaurantDetailResponse = {
  restaurant: AdminRestaurantResponse
  ownerAccountPhone: string | null
  restaurantContactPhone: string
  qrLeads: Array<{
    id: string
    fullName: string
  }>
  jobs: unknown[]
  applications: unknown[]
}

type PrismaModule = typeof import('../lib/prisma.js')
type OtpProviderModule = typeof import('../services/otpProvider.js')

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text()

  return {
    status: response.status,
    body: text ? (JSON.parse(text) as T) : ({} as T),
  }
}

test(
  'critical restaurant security integration tests',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run integration security tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'security-test-secret'

    const runId = `security-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`
    const adminEmail = `admin-${runId}@example.test`
    const secondAdminEmail = `admin-two-${runId}@example.test`

    process.env.ADMIN_EMAILS = `${adminEmail},${secondAdminEmail}`

    const [{ app }, { prisma }, { getCapturedOtpCodeForTest }] =
      await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js') as Promise<PrismaModule>,
      import('../services/otpProvider.js') as Promise<OtpProviderModule>,
    ])

    const server = createServer(app)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${address.port}/api`
    const createdOwnerProfileIds: string[] = []
    const createdRestaurantNames: string[] = []
    const createdEmails: string[] = []
    const createdUserIds: string[] = []

    async function request<T>(
      path: string,
      options: RequestInit = {},
    ): Promise<ApiResponse<T>> {
      return readJson<T>(await fetch(`${baseUrl}${path}`, options))
    }

    function jsonHeaders(token?: string) {
      return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
    }

    async function requestPhoneCode(
      phoneNumber: string,
      purpose: 'login' | 'register' | 'qrApply',
    ) {
      return request<Record<string, unknown>>('/auth/request-code', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          phoneNumber,
          purpose,
        }),
      })
    }

    async function verifyPhoneCode(body: Record<string, unknown>) {
      return request<AuthResponse>('/auth/verify-code', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(body),
      })
    }

    async function registerAndLogin(
      email: string,
      track: 'restaurant' | 'restaurantOwner' | 'highTech',
    ) {
      createdEmails.push(email)

      await request('/auth/register', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          email,
          password: 'password123',
          track,
        }),
      })

      const login = await request<AuthResponse>('/auth/login', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          email,
          password: 'password123',
        }),
      })

      assert.equal(login.status, 200)

      return login.body.token
    }

    async function createOwner(emailPrefix: string) {
      const email = `${emailPrefix}-${runId}@example.test`
      const token = await registerAndLogin(email, 'restaurantOwner')
      const restaurantName = `${emailPrefix} ${runId}`
      createdRestaurantNames.push(restaurantName)

      const profile = await request<OwnerProfileResponse>('/owner/profile', {
        method: 'PUT',
        headers: jsonHeaders(token),
        body: JSON.stringify({
          restaurantName,
          contactPerson: 'Owner',
          phoneNumber: '0500000000',
          whatsappNumber: '0500000000',
          city: 'Tel Aviv',
          street: emailPrefix,
          description: 'Security test restaurant',
        }),
      })

      assert.equal(profile.status, 200)
      createdOwnerProfileIds.push(profile.body.id)

      return {
        email,
        profile: profile.body,
        token,
      }
    }

    try {
      const ownerA = await createOwner('owner-a')
      const ownerB = await createOwner('owner-b')

      assert.ok(ownerA.profile.slug)
      assert.ok(ownerB.profile.slug)

      const ownerAInitialJobs = await request<OwnerJobResponse[]>(
        '/owner/jobs',
        {
          headers: jsonHeaders(ownerA.token),
        },
      )
      assert.equal(ownerAInitialJobs.status, 200)
      assert.equal(
        ownerAInitialJobs.body.filter((job) => job.kind === 'draft')
          .length,
        5,
      )
      assert.equal(
        ownerAInitialJobs.body.filter((job) => job.kind === 'posted')
          .length,
        0,
      )

      const unverifiedLeadCreate = await request<{ message?: string }>(
        `/public/restaurants/${ownerA.profile.slug}/leads`,
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            fullName: 'Lead One',
            phoneNumber: '050-123-4567',
            wantedRoles: ['waiter'],
            experienceText: 'Two years',
            availability: 'Evenings',
            age: 24,
          }),
        },
      )
      assert.equal(unverifiedLeadCreate.status, 410)
      assert.equal(
        unverifiedLeadCreate.body.message,
        'Phone verification is required before applying.',
      )

      const unverifiedLeadCount =
        await prisma.restaurantCandidateLead.count({
          where: {
            ownerProfileId: ownerA.profile.id,
          },
        })
      assert.equal(unverifiedLeadCount, 0)

      const ownerALead = await prisma.restaurantCandidateLead.create({
        data: {
          ownerProfileId: ownerA.profile.id,
          fullName: 'Lead One',
          phoneNumber: '0501234567',
          wantedRoles: ['waiter'],
          experienceText: 'Two years',
          availability: 'Evenings',
          age: 24,
          source: 'security-test',
        },
      })

      const stolenLeadPatch = await request(
        `/owner/leads/${ownerALead.id}/status`,
        {
          method: 'PATCH',
          headers: jsonHeaders(ownerB.token),
          body: JSON.stringify({
            status: 'relevant',
          }),
        },
      )
      assert.equal(stolenLeadPatch.status, 404)

      const stolenLeadDelete = await request(
        `/owner/leads/${ownerALead.id}`,
        {
          method: 'DELETE',
          headers: jsonHeaders(ownerB.token),
        },
      )
      assert.equal(stolenLeadDelete.status, 404)

      const ownerAJob = await request<OwnerJobResponse>('/owner/jobs', {
        method: 'POST',
        headers: jsonHeaders(ownerA.token),
        body: JSON.stringify({
          role: 'waiter',
          description: 'Owner A draft',
          requirements: 'Kind people',
          shiftInfo: 'Evenings',
          contactPhone: '',
          contactWhatsapp: '',
        }),
      })
      assert.equal(ownerAJob.status, 201)
      assert.equal(ownerAJob.body.kind, 'draft')

      const publishedOwnerAJob = await request<OwnerJobResponse>(
        `/owner/jobs/${ownerAJob.body.id}/publish`,
        {
          method: 'POST',
          headers: jsonHeaders(ownerA.token),
        },
      )
      assert.equal(publishedOwnerAJob.status, 201)
      assert.equal(publishedOwnerAJob.body.kind, 'posted')
      assert.equal(publishedOwnerAJob.body.isActive, true)

      const ownerAJobsAfterPublish = await request<OwnerJobResponse[]>(
        '/owner/jobs',
        {
          headers: jsonHeaders(ownerA.token),
        },
      )
      assert.equal(ownerAJobsAfterPublish.status, 200)
      assert.ok(
        ownerAJobsAfterPublish.body.some(
          (job) => job.id === ownerAJob.body.id && job.kind === 'draft',
        ),
      )
      assert.ok(
        ownerAJobsAfterPublish.body.some(
          (job) =>
            job.id === publishedOwnerAJob.body.id &&
            job.kind === 'posted',
        ),
      )

      for (const [method, path, body] of [
        [
          'PUT',
          `/owner/jobs/${ownerAJob.body.id}`,
          {
            role: 'cook',
            description: 'Stolen update',
            requirements: '',
            shiftInfo: '',
            contactPhone: '',
            contactWhatsapp: '',
          },
        ],
        ['PATCH', `/owner/jobs/${ownerAJob.body.id}/active`, { isActive: true }],
        ['POST', `/owner/jobs/${ownerAJob.body.id}/publish`, undefined],
        ['DELETE', `/owner/jobs/${ownerAJob.body.id}`, undefined],
      ] as const) {
        const options: RequestInit = {
          method,
          headers: jsonHeaders(ownerB.token),
        }

        if (body) {
          options.body = JSON.stringify(body)
        }

        const response = await request(path, options)

        assert.equal(response.status, 404)
      }

      await prisma.user.update({
        where: {
          email: ownerA.email,
        },
        data: {
          phoneNumber: '+972501234321',
          phoneVerifiedAt: new Date(),
        },
      })

      const ownerTeamBeforeInvite = await request<OwnerTeamResponse>(
        '/owner/team',
        {
          headers: jsonHeaders(ownerA.token),
        },
      )
      assert.equal(ownerTeamBeforeInvite.status, 200)
      assert.equal(ownerTeamBeforeInvite.body.currentRole, 'owner')

      const ownerMember = ownerTeamBeforeInvite.body.members.find(
        (member) => member.role === 'owner',
      )
      assert.ok(ownerMember)
      assert.equal(ownerMember.status, 'active')

      const removeOwnerMember = await request(
        `/owner/team/members/${ownerMember.id}`,
        {
          method: 'DELETE',
          headers: jsonHeaders(ownerA.token),
        },
      )
      assert.equal(removeOwnerMember.status, 400)

      const invitedPhoneInput = '050-222-3333'
      const invitedPhone = '+972502223333'
      const invitedMember = await request<OwnerTeamMemberResponse>(
        '/owner/team/members',
        {
          method: 'POST',
          headers: jsonHeaders(ownerA.token),
          body: JSON.stringify({
            displayName: 'Hiring Manager',
            phoneNumber: invitedPhoneInput,
          }),
        },
      )
      assert.equal(invitedMember.status, 201)
      assert.equal(invitedMember.body.phoneNumber, invitedPhone)
      assert.equal(invitedMember.body.role, 'hiringManager')
      assert.equal(invitedMember.body.status, 'pending')
      assert.equal(invitedMember.body.user, null)

      const duplicateInvite = await request<OwnerTeamMemberResponse>(
        '/owner/team/members',
        {
          method: 'POST',
          headers: jsonHeaders(ownerA.token),
          body: JSON.stringify({
            displayName: 'Hiring Manager Duplicate',
            phoneNumber: invitedPhone,
          }),
        },
      )
      assert.equal(duplicateInvite.status, 200)
      assert.equal(duplicateInvite.body.id, invitedMember.body.id)
      assert.equal(
        await prisma.restaurantMember.count({
          where: {
            restaurantId: ownerA.profile.id,
            phoneNumber: invitedPhone,
            status: {
              not: 'removed',
            },
          },
        }),
        1,
      )

      const requestedHiringManagerCode = await requestPhoneCode(
        invitedPhoneInput,
        'register',
      )
      assert.equal(requestedHiringManagerCode.status, 200)
      const capturedHiringManagerCode = getCapturedOtpCodeForTest(
        invitedPhone,
        'register',
      )
      assert.match(capturedHiringManagerCode ?? '', /^\d{4}$/)

      const hiringManagerAuth = await verifyPhoneCode({
        phoneNumber: invitedPhoneInput,
        code: capturedHiringManagerCode,
        purpose: 'register',
        fullName: 'Hiring Manager',
        track: 'restaurant',
      })
      assert.equal(hiringManagerAuth.status, 200)
      assert.equal(
        hiringManagerAuth.body.user?.restaurantMemberRole,
        'hiringManager',
      )
      assert.ok(hiringManagerAuth.body.user?.id)
      createdUserIds.push(hiringManagerAuth.body.user.id)
      const hiringManagerToken = hiringManagerAuth.body.token

      const activeHiringMember =
        await prisma.restaurantMember.findUniqueOrThrow({
          where: {
            id: invitedMember.body.id,
          },
        })
      assert.equal(activeHiringMember.status, 'active')
      assert.equal(activeHiringMember.userId, hiringManagerAuth.body.user.id)

      const hiringManagerJobs = await request<OwnerJobResponse[]>(
        '/owner/jobs',
        {
          headers: jsonHeaders(hiringManagerToken),
        },
      )
      assert.equal(hiringManagerJobs.status, 200)
      assert.ok(
        hiringManagerJobs.body.some((job) => job.id === ownerAJob.body.id),
      )

      const hiringManagerCreatedJob = await request<OwnerJobResponse>(
        '/owner/jobs',
        {
          method: 'POST',
          headers: jsonHeaders(hiringManagerToken),
          body: JSON.stringify({
            role: 'host',
            description: 'Manager created draft',
            requirements: '',
            shiftInfo: 'Morning',
            contactPhone: '',
            contactWhatsapp: '',
          }),
        },
      )
      assert.equal(hiringManagerCreatedJob.status, 201)
      assert.equal(hiringManagerCreatedJob.body.kind, 'draft')

      const hiringManagerUpdatedJob = await request<OwnerJobResponse>(
        `/owner/jobs/${hiringManagerCreatedJob.body.id}`,
        {
          method: 'PUT',
          headers: jsonHeaders(hiringManagerToken),
          body: JSON.stringify({
            role: 'bartender',
            description: 'Manager updated draft',
            requirements: '',
            shiftInfo: 'Evening',
            contactPhone: '',
            contactWhatsapp: '',
          }),
        },
      )
      assert.equal(hiringManagerUpdatedJob.status, 200)

      const hiringManagerPublishedJob = await request<OwnerJobResponse>(
        `/owner/jobs/${hiringManagerCreatedJob.body.id}/publish`,
        {
          method: 'POST',
          headers: jsonHeaders(hiringManagerToken),
        },
      )
      assert.equal(hiringManagerPublishedJob.status, 201)
      assert.equal(hiringManagerPublishedJob.body.kind, 'posted')

      const hiringManagerProfileUpdate = await request(
        '/owner/profile',
        {
          method: 'PUT',
          headers: jsonHeaders(hiringManagerToken),
          body: JSON.stringify({
            restaurantName: 'Should Not Change',
            contactPerson: 'Manager',
            phoneNumber: '0501111111',
            whatsappNumber: '',
            city: 'Tel Aviv',
            street: 'Nope',
            description: '',
          }),
        },
      )
      assert.equal(hiringManagerProfileUpdate.status, 403)

      const hiringManagerTeamRead = await request('/owner/team', {
        headers: jsonHeaders(hiringManagerToken),
      })
      assert.equal(hiringManagerTeamRead.status, 403)

      const hiringManagerTeamInvite = await request(
        '/owner/team/members',
        {
          method: 'POST',
          headers: jsonHeaders(hiringManagerToken),
          body: JSON.stringify({
            displayName: 'Other',
            phoneNumber: '0503334444',
          }),
        },
      )
      assert.equal(hiringManagerTeamInvite.status, 403)

      const ownerBPrivateJob = await request<OwnerJobResponse>(
        '/owner/jobs',
        {
          method: 'POST',
          headers: jsonHeaders(ownerB.token),
          body: JSON.stringify({
            role: 'waiter',
            description: 'Owner B private draft',
            requirements: '',
            shiftInfo: '',
            contactPhone: '',
            contactWhatsapp: '',
          }),
        },
      )
      assert.equal(ownerBPrivateJob.status, 201)

      const hiringManagerStolenOwnerBJob = await request(
        `/owner/jobs/${ownerBPrivateJob.body.id}`,
        {
          method: 'PUT',
          headers: jsonHeaders(hiringManagerToken),
          body: JSON.stringify({
            role: 'cook',
            description: 'Cross restaurant edit',
            requirements: '',
            shiftInfo: '',
            contactPhone: '',
            contactWhatsapp: '',
          }),
        },
      )
      assert.equal(hiringManagerStolenOwnerBJob.status, 404)

      const hiringManagerDeleteJob = await request(
        `/owner/jobs/${hiringManagerCreatedJob.body.id}`,
        {
          method: 'DELETE',
          headers: jsonHeaders(hiringManagerToken),
        },
      )
      assert.equal(hiringManagerDeleteJob.status, 403)

      const removedHiringMember = await request(
        `/owner/team/members/${invitedMember.body.id}`,
        {
          method: 'DELETE',
          headers: jsonHeaders(ownerA.token),
        },
      )
      assert.equal(removedHiringMember.status, 204)

      const removedHiringManagerJobs = await request('/owner/jobs', {
        headers: jsonHeaders(hiringManagerToken),
      })
      assert.equal(removedHiringManagerJobs.status, 403)

      const nonAdminToken = ownerA.token
      const nonAdminAdminRequest = await request(
        '/admin/restaurant-leads',
        {
          headers: jsonHeaders(nonAdminToken),
        },
      )
      assert.equal(nonAdminAdminRequest.status, 403)

      const adminToken = await registerAndLogin(adminEmail, 'restaurantOwner')
      const secondAdminToken = await registerAndLogin(
        secondAdminEmail,
        'restaurantOwner',
      )
      const adminRequest = await request('/admin/restaurant-leads', {
        headers: jsonHeaders(adminToken),
      })
      assert.equal(adminRequest.status, 200)

      const nonAdminRestaurantsRequest = await request(
        '/admin/restaurants',
        {
          headers: jsonHeaders(nonAdminToken),
        },
      )
      assert.equal(nonAdminRestaurantsRequest.status, 403)

      await prisma.restaurantCandidateLead.create({
        data: {
          ownerProfileId: ownerB.profile.id,
          fullName: 'Owner B Unread Lead',
          phoneNumber: '0505555555',
          wantedRoles: ['host'],
          source: 'security-test',
        },
      })

      const adminRestaurantsRequest = await request<
        AdminRestaurantResponse[]
      >('/admin/restaurants', {
        headers: jsonHeaders(adminToken),
      })
      assert.equal(adminRestaurantsRequest.status, 200)
      assert.ok(
        adminRestaurantsRequest.body.every(
          (restaurant) =>
            typeof restaurant.id === 'string' &&
            typeof restaurant.restaurantName === 'string' &&
            typeof restaurant.hasNewCandidate === 'boolean' &&
            typeof restaurant.newCandidateCount === 'number',
        ),
      )
      const ownerAAdminRestaurant = adminRestaurantsRequest.body.find(
        (restaurant) => restaurant.id === ownerA.profile.id,
      )
      assert.equal(ownerAAdminRestaurant?.hasNewCandidate, true)
      assert.equal(ownerAAdminRestaurant?.newCandidateCount, 1)
      const ownerBAdminRestaurant = adminRestaurantsRequest.body.find(
        (restaurant) => restaurant.id === ownerB.profile.id,
      )
      assert.equal(ownerBAdminRestaurant?.hasNewCandidate, true)
      assert.equal(ownerBAdminRestaurant?.newCandidateCount, 1)

      const nonAdminMarkSeen = await request(
        `/admin/restaurants/${ownerA.profile.id}/mark-seen`,
        {
          method: 'POST',
          headers: jsonHeaders(nonAdminToken),
        },
      )
      assert.equal(nonAdminMarkSeen.status, 403)

      const adminMarkSeen = await request<{ ok: boolean }>(
        `/admin/restaurants/${ownerA.profile.id}/mark-seen`,
        {
          method: 'POST',
          headers: jsonHeaders(adminToken),
        },
      )
      assert.equal(adminMarkSeen.status, 200)
      assert.equal(adminMarkSeen.body.ok, true)

      const ownerALeadAfterSeen =
        await prisma.restaurantCandidateLead.findUniqueOrThrow({
          where: {
            id: ownerALead.id,
          },
        })
      assert.equal(ownerALeadAfterSeen.status, 'new')

      const adminRestaurantsAfterSeen = await request<
        AdminRestaurantResponse[]
      >('/admin/restaurants', {
        headers: jsonHeaders(adminToken),
      })
      assert.equal(adminRestaurantsAfterSeen.status, 200)
      const ownerAAfterSeen = adminRestaurantsAfterSeen.body.find(
        (restaurant) => restaurant.id === ownerA.profile.id,
      )
      const ownerBAfterOwnerASeen = adminRestaurantsAfterSeen.body.find(
        (restaurant) => restaurant.id === ownerB.profile.id,
      )
      assert.equal(ownerAAfterSeen?.hasNewCandidate, false)
      assert.equal(ownerAAfterSeen?.newCandidateCount, 0)
      assert.equal(ownerBAfterOwnerASeen?.hasNewCandidate, true)
      assert.equal(ownerBAfterOwnerASeen?.newCandidateCount, 1)

      const secondAdminRestaurantsAfterFirstAdminSeen = await request<
        AdminRestaurantResponse[]
      >('/admin/restaurants', {
        headers: jsonHeaders(secondAdminToken),
      })
      assert.equal(secondAdminRestaurantsAfterFirstAdminSeen.status, 200)
      const ownerAForSecondAdmin =
        secondAdminRestaurantsAfterFirstAdminSeen.body.find(
          (restaurant) => restaurant.id === ownerA.profile.id,
        )
      assert.equal(ownerAForSecondAdmin?.hasNewCandidate, true)
      assert.equal(ownerAForSecondAdmin?.newCandidateCount, 1)

      await prisma.restaurantCandidateLead.create({
        data: {
          ownerProfileId: ownerA.profile.id,
          fullName: 'New Lead After Seen',
          phoneNumber: '0501212121',
          wantedRoles: ['waiter'],
          source: 'security-test',
          createdAt: new Date(Date.now() + 1_000),
        },
      })

      const adminRestaurantsAfterNewLead = await request<
        AdminRestaurantResponse[]
      >('/admin/restaurants', {
        headers: jsonHeaders(adminToken),
      })
      assert.equal(adminRestaurantsAfterNewLead.status, 200)
      const ownerAAfterNewLead = adminRestaurantsAfterNewLead.body.find(
        (restaurant) => restaurant.id === ownerA.profile.id,
      )
      assert.equal(ownerAAfterNewLead?.hasNewCandidate, true)
      assert.equal(ownerAAfterNewLead?.newCandidateCount, 1)

      const adminCreatedRestaurant = await request<AdminRestaurantResponse>(
        '/admin/restaurants',
        {
          method: 'POST',
          headers: jsonHeaders(adminToken),
          body: JSON.stringify({
            restaurantName: `Admin Created ${runId}`,
          }),
        },
      )
      assert.equal(adminCreatedRestaurant.status, 201)
      assert.equal(
        adminCreatedRestaurant.body.restaurantName,
        `Admin Created ${runId}`,
      )
      assert.ok(adminCreatedRestaurant.body.slug)
      assert.equal(adminCreatedRestaurant.body.hasNewCandidate, false)
      assert.equal(adminCreatedRestaurant.body.newCandidateCount, 0)
      createdOwnerProfileIds.push(adminCreatedRestaurant.body.id)

      const adminCreatedProfile =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: {
            id: adminCreatedRestaurant.body.id,
          },
          select: {
            userId: true,
          },
        })
      createdUserIds.push(adminCreatedProfile.userId)

      const duplicateNameRestaurant = await request<AdminRestaurantResponse>(
        '/admin/restaurants',
        {
          method: 'POST',
          headers: jsonHeaders(adminToken),
          body: JSON.stringify({
            restaurantName: `Admin Created ${runId}`,
          }),
        },
      )
      assert.equal(duplicateNameRestaurant.status, 201)
      assert.ok(duplicateNameRestaurant.body.slug)
      assert.notEqual(
        duplicateNameRestaurant.body.slug,
        adminCreatedRestaurant.body.slug,
      )
      createdOwnerProfileIds.push(duplicateNameRestaurant.body.id)

      const duplicateProfile =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: {
            id: duplicateNameRestaurant.body.id,
          },
          select: {
            userId: true,
          },
        })
      createdUserIds.push(duplicateProfile.userId)

      const editedAdminRestaurant = await request<AdminRestaurantResponse>(
        `/admin/restaurants/${adminCreatedRestaurant.body.id}`,
        {
          method: 'PATCH',
          headers: jsonHeaders(adminToken),
          body: JSON.stringify({
            restaurantName: `Admin Edited ${runId}`,
            city: 'Tel Aviv',
            street: 'Admin Street',
          }),
        },
      )
      assert.equal(editedAdminRestaurant.status, 200)
      assert.equal(
        editedAdminRestaurant.body.restaurantName,
        `Admin Edited ${runId}`,
      )
      assert.equal(editedAdminRestaurant.body.city, 'Tel Aviv')

      const nonAdminDetailRequest = await request(
        `/admin/restaurants/${adminCreatedRestaurant.body.id}`,
        {
          headers: jsonHeaders(nonAdminToken),
        },
      )
      assert.equal(nonAdminDetailRequest.status, 403)

      await prisma.user.update({
        where: {
          email: ownerA.email,
        },
        data: {
          phoneNumber: '+972501234321',
        },
      })

      const adminRestaurantLead =
        await prisma.restaurantCandidateLead.create({
          data: {
            ownerProfileId: adminCreatedRestaurant.body.id,
            fullName: 'Admin Restaurant Lead',
            phoneNumber: '0507777777',
            wantedRoles: ['waiter'],
            source: 'security-test',
          },
        })

      const otherRestaurantLead =
        await prisma.restaurantCandidateLead.create({
          data: {
            ownerProfileId: ownerB.profile.id,
            fullName: 'Other Restaurant Lead',
            phoneNumber: '0508888888',
            wantedRoles: ['host'],
            source: 'security-test',
          },
        })

      const adminRestaurantsAfterLead = await request<
        AdminRestaurantResponse[]
      >('/admin/restaurants', {
        headers: jsonHeaders(adminToken),
      })
      assert.equal(adminRestaurantsAfterLead.status, 200)
      const adminCreatedRestaurantWithLead =
        adminRestaurantsAfterLead.body.find(
          (restaurant) => restaurant.id === adminCreatedRestaurant.body.id,
        )
      assert.equal(
        adminCreatedRestaurantWithLead?.hasNewCandidate,
        true,
      )
      assert.equal(adminCreatedRestaurantWithLead?.newCandidateCount, 1)

      const adminRestaurantDetail =
        await request<AdminRestaurantDetailResponse>(
          `/admin/restaurants/${adminCreatedRestaurant.body.id}`,
          {
            headers: jsonHeaders(adminToken),
          },
        )
      assert.equal(adminRestaurantDetail.status, 200)
      assert.equal(
        adminRestaurantDetail.body.restaurant.id,
        adminCreatedRestaurant.body.id,
      )
      assert.ok(
        adminRestaurantDetail.body.qrLeads.some(
          (lead) => lead.id === adminRestaurantLead.id,
        ),
      )
      assert.ok(
        adminRestaurantDetail.body.qrLeads.every(
          (lead) => lead.id !== otherRestaurantLead.id,
        ),
      )

      const ownerADetail = await request<AdminRestaurantDetailResponse>(
        `/admin/restaurants/${ownerA.profile.id}`,
        {
          headers: jsonHeaders(adminToken),
        },
      )
      assert.equal(ownerADetail.status, 200)
      assert.equal(ownerADetail.body.ownerAccountPhone, '+972501234321')
      assert.equal(ownerADetail.body.restaurantContactPhone, '0500000000')

      const publicRestaurant = await request<Record<string, unknown>>(
        `/public/restaurants/${ownerA.profile.slug}`,
      )
      assert.equal(publicRestaurant.status, 200)
      assert.deepEqual(Object.keys(publicRestaurant.body).sort(), [
        'city',
        'description',
        'restaurantName',
        'slug',
        'street',
      ])

      const publicAdminCreatedRestaurant =
        await request<Record<string, unknown>>(
          `/public/restaurants/${adminCreatedRestaurant.body.slug}`,
        )
      assert.equal(publicAdminCreatedRestaurant.status, 200)
      assert.equal(
        publicAdminCreatedRestaurant.body.restaurantName,
        `Admin Edited ${runId}`,
      )

      const duplicateUnverifiedLead = await request<{ message?: string }>(
        `/public/restaurants/${ownerA.profile.slug}/leads`,
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            fullName: 'Lead Duplicate',
            phoneNumber: '0501234567',
            wantedRoles: ['waiter'],
            experienceText: '',
            availability: '',
            age: 24,
          }),
        },
      )
      assert.equal(duplicateUnverifiedLead.status, 410)
      assert.equal(
        duplicateUnverifiedLead.body.message,
        'Phone verification is required before applying.',
      )

      const leadCount = await prisma.restaurantCandidateLead.count({
        where: {
          ownerProfileId: ownerA.profile.id,
          phoneNumber: '0501234567',
        },
      })
      assert.equal(leadCount, 1)

      const workerToken = await registerAndLogin(
        `worker-${runId}@example.test`,
        'restaurant',
      )

      const workerOwnerJobs = await request('/owner/jobs', {
        headers: jsonHeaders(workerToken),
      })
      assert.equal(workerOwnerJobs.status, 403)

      await request('/restaurant/profile', {
        method: 'PUT',
        headers: jsonHeaders(workerToken),
        body: JSON.stringify({
          fullName: 'Worker',
          phoneNumber: '0509999999',
          location: 'Tel Aviv',
          wantedRoles: ['waiter'],
          experienceText: '',
          availability: '',
          age: 25,
        }),
      })
      const workerUser = await prisma.user.update({
        where: {
          email: `worker-${runId}@example.test`,
        },
        data: {
          phoneNumber: '+972509999999',
          phoneVerifiedAt: new Date(),
          fullName: 'Worker',
        },
      })

      const unauthorizedVerifiedLead = await request(
        `/public/restaurants/${ownerA.profile.slug}/verified-leads`,
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            phoneNumber: '0500000000',
            wantedRoles: ['waiter'],
            experienceText: '',
            availability: '',
            age: 25,
          }),
        },
      )
      assert.equal(unauthorizedVerifiedLead.status, 401)

      const spoofedVerifiedLead = await request(
        `/public/restaurants/${ownerA.profile.slug}/verified-leads`,
        {
          method: 'POST',
          headers: jsonHeaders(workerToken),
          body: JSON.stringify({
            phoneNumber: '0529999999',
            wantedRoles: ['waiter', 'host'],
            experienceText: 'Verified QR experience',
            availability: 'Evenings',
            age: 25,
          }),
        },
      )
      assert.equal(spoofedVerifiedLead.status, 400)

      const verifiedLeadCreate = await request<{ ok: boolean }>(
        `/public/restaurants/${ownerA.profile.slug}/verified-leads`,
        {
          method: 'POST',
          headers: jsonHeaders(workerToken),
          body: JSON.stringify({
            wantedRoles: ['waiter', 'host'],
            experienceText: 'Verified QR experience',
            availability: 'Evenings',
            age: 25,
          }),
        },
      )
      assert.equal(verifiedLeadCreate.status, 201)

      const verifiedLead = await prisma.restaurantCandidateLead.findFirstOrThrow({
        where: {
          ownerProfileId: ownerA.profile.id,
          phoneNumber: '+972509999999',
        },
      })
      assert.equal(verifiedLead.fullName, 'Worker')
      assert.deepEqual(verifiedLead.wantedRoles.sort(), ['host', 'waiter'])

      assert.equal(
        await prisma.restaurantCandidateLead.count({
          where: {
            ownerProfileId: ownerA.profile.id,
            phoneNumber: '+972529999999',
          },
        }),
        0,
      )

      const workerProfile =
        await prisma.restaurantWorkerProfile.findUniqueOrThrow({
          where: {
            userId: workerUser.id,
          },
        })
      assert.deepEqual(workerProfile.wantedRoles.sort(), [
        'host',
        'waiter',
      ])
      assert.equal(workerProfile.experienceText, 'Verified QR experience')

      const duplicateVerifiedLead = await request<{ ok: boolean }>(
        `/public/restaurants/${ownerA.profile.slug}/verified-leads`,
        {
          method: 'POST',
          headers: jsonHeaders(workerToken),
          body: JSON.stringify({
            wantedRoles: ['waiter'],
            experienceText: 'Duplicate should not create second lead',
            availability: 'Morning',
            age: 25,
          }),
        },
      )
      assert.equal(duplicateVerifiedLead.status, 200)
      assert.equal(
        await prisma.restaurantCandidateLead.count({
          where: {
            ownerProfileId: ownerA.profile.id,
            phoneNumber: '+972509999999',
          },
        }),
        1,
      )

      const activePostedJob = await prisma.restaurantJob.create({
        data: {
          restaurantName: `${runId} Active Posted`,
          role: 'waiter',
          location: 'Tel Aviv',
          area: 'Test',
          ownerProfileId: ownerA.profile.id,
          kind: 'posted',
          isActive: true,
        },
      })
      await prisma.restaurantJob.createMany({
        data: [
          {
            restaurantName: `${runId} Draft`,
            role: 'waiter',
            location: 'Tel Aviv',
            area: 'Test',
            ownerProfileId: ownerA.profile.id,
            kind: 'draft',
            isActive: false,
          },
          {
            restaurantName: `${runId} Inactive Posted`,
            role: 'waiter',
            location: 'Tel Aviv',
            area: 'Test',
            ownerProfileId: ownerA.profile.id,
            kind: 'posted',
            isActive: false,
          },
        ],
      })

      const explore = await request<RestaurantExploreResponse>(
        '/restaurant/explore',
        {
          method: 'POST',
          headers: jsonHeaders(workerToken),
          body: JSON.stringify({
            limit: 10,
            excludeJobIds: [],
          }),
        },
      )
      assert.equal(explore.status, 200)
      assert.ok(
        explore.body.jobs.some((job) => job.id === activePostedJob.id),
      )
      assert.ok(
        explore.body.jobs.every(
          (job) =>
            job.contactPhone === undefined &&
            job.contactWhatsapp === undefined,
        ),
      )
      assert.ok(
        explore.body.jobs.every(
          (job) =>
            !job.restaurantName.includes(`${runId} Draft`) &&
            !job.restaurantName.includes(`${runId} Inactive Posted`),
        ),
      )
    } finally {
      await prisma.restaurantCandidateLead.deleteMany({
        where: {
          ownerProfileId: {
            in: createdOwnerProfileIds,
          },
        },
      })
      await prisma.restaurantApplication.deleteMany({
        where: {
          restaurantJob: {
            ownerProfileId: {
              in: createdOwnerProfileIds,
            },
          },
        },
      })
      await prisma.restaurantJob.deleteMany({
        where: {
          OR: [
            {
              ownerProfileId: {
                in: createdOwnerProfileIds,
              },
            },
            {
              restaurantName: {
                contains: runId,
              },
            },
          ],
        },
      })
      await prisma.user.deleteMany({
        where: {
          OR: [
            {
              email: {
                in: createdEmails,
              },
            },
            {
              id: {
                in: createdUserIds,
              },
            },
          ],
        },
      })
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
      await prisma.$disconnect()
    }
  },
)
