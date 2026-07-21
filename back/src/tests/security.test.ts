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
    workerLocationRequired?: boolean
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
  qrEnabledRoles: string[]
}

type OwnerJobResponse = {
  id: string
  kind: 'draft' | 'posted'
  isActive: boolean
  role?: string
  description?: string
}

type RestaurantExploreResponse = {
  jobs: Array<{
    id: string
    restaurantName: string
    contactPhone?: unknown
    contactWhatsapp?: unknown
  }>
}

type RestaurantMapResponse = Array<{
  restaurantId: string
  restaurantName: string
  formattedAddress: string
  latitude: number
  longitude: number
  jobs: Array<{
    id: string
    role: string
    title: string
  }>
}>

type AdminRestaurantResponse = {
  id: string
  restaurantName: string
  slug: string | null
  qrEnabledRoles: string[]
  ownerLoginPhone: string | null
  phoneNumber: string
  city: string
  street: string
  qrLeadsCount: number
  funnelMetrics: {
    qrScans: number
    uniqueQrVisitors: number
    startedForms: number
    completedForms: number
    ownerViewedCompletedForms: number
    newCandidates: number
    lastScanAt: string | null
    lastCompletedAt: string | null
    lastOwnerViewAt: string | null
  }
  hasNewCandidate: boolean
  newCandidateCount: number
  ownerUser: {
    id: string
    phoneNumber: string | null
  } | null
  claim: {
    status: 'available' | 'claimed' | 'missing'
    token: string | null
    claimedAt: string | null
    createdAt: string | null
  }
}

type PublicRestaurantClaimResponse = {
  restaurantName: string
  slug: string
  city: string
  street: string
  qrEnabledRoles: string[]
  enabledQrRoleCount: number
  claimStatus: 'available'
  ownerLoginPhone?: unknown
  members?: unknown
  userId?: unknown
  candidates?: unknown
}

type RestaurantClaimCompletionResponse = {
  alreadyOwned: boolean
  profileComplete: boolean
  restaurant: {
    id: string
    restaurantName: string
    slug: string | null
  }
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
type GooglePlacesModule = typeof import('../services/googlePlaces.service.js')

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

    const [
      { app },
      { prisma },
      { getCapturedOtpCodeForTest },
      {
        clearGooglePlaceDetailsForTest,
        setGooglePlaceDetailsForTest,
      },
    ] =
      await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js') as Promise<PrismaModule>,
      import('../services/otpProvider.js') as Promise<OtpProviderModule>,
      import('../services/googlePlaces.service.js') as Promise<GooglePlacesModule>,
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

    function registerTestRestaurantPlace(
      placeId: string,
      streetName = 'Dizengoff Street',
      streetNumber = '100',
    ) {
      setGooglePlaceDetailsForTest(placeId, {
        id: placeId,
        formattedAddress: `${streetName} ${streetNumber}, Tel Aviv-Yafo, Israel`,
        location: {
          latitude: 32.0809,
          longitude: 34.7732,
        },
        addressComponents: [
          { longText: streetName, types: ['route'] },
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

    function registerTestWorkerStreet(
      placeId: string,
      streetName = 'Dizengoff Street',
    ) {
      setGooglePlaceDetailsForTest(placeId, {
        id: placeId,
        formattedAddress: `${streetName}, Tel Aviv-Yafo, Israel`,
        location: {
          latitude: 32.083,
          longitude: 34.773,
        },
        addressComponents: [
          { longText: streetName, types: ['route'] },
          { longText: 'Tel Aviv-Yafo', types: ['locality'] },
          {
            longText: 'Israel',
            shortText: 'IL',
            types: ['country'],
          },
        ],
        types: ['route'],
      })
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
      const locationPlaceId = `${emailPrefix}-place-${runId}`
      registerTestRestaurantPlace(locationPlaceId)

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
          locationPlaceId,
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

      const ownerAStoredProfile =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: {
            id: ownerA.profile.id,
          },
        })
      assert.equal(ownerAStoredProfile.locationStatus, 'verified')
      assert.ok(ownerAStoredProfile.googlePlaceId)

      const ownerAReplacementPlaceId = `owner-a-replacement-${runId}`
      registerTestRestaurantPlace(
        ownerAReplacementPlaceId,
        'Allenby Street',
        '20',
      )
      const ownerCannotChangeLocationAfterCreation = await request<{
        message?: string
      }>('/owner/profile', {
        method: 'PUT',
        headers: jsonHeaders(ownerA.token),
        body: JSON.stringify({
          restaurantName: `owner-a ${runId}`,
          contactPerson: 'Owner',
          phoneNumber: '0500000000',
          whatsappNumber: '0500000000',
          city: 'Tel Aviv',
          street: 'Allenby Street 20',
          description: 'Security test restaurant',
          locationPlaceId: ownerAReplacementPlaceId,
        }),
      })
      assert.equal(ownerCannotChangeLocationAfterCreation.status, 403)

      const legacyOwnerEmail = `legacy-location-owner-${runId}@example.test`
      const legacyOwnerToken = await registerAndLogin(
        legacyOwnerEmail,
        'restaurantOwner',
      )
      const legacyOwnerUser = await prisma.user.findUniqueOrThrow({
        where: {
          email: legacyOwnerEmail,
        },
      })
      const legacyRestaurant =
        await prisma.restaurantOwnerProfile.create({
          data: {
            userId: legacyOwnerUser.id,
            restaurantName: `Legacy Location ${runId}`,
            contactPerson: 'Legacy Owner',
            phoneNumber: '0501111111',
            whatsappNumber: '0501111111',
            city: 'Tel Aviv',
            street: 'Legacy Street',
            description: 'Legacy unverified restaurant',
            slug: `legacy-location-${runId}`,
          },
        })
      createdOwnerProfileIds.push(legacyRestaurant.id)
      const legacyPlaceId = `legacy-place-${runId}`
      registerTestRestaurantPlace(legacyPlaceId, 'King George Street', '30')

      const legacyOwnerCannotVerifyLocation = await request<{
        message?: string
      }>('/owner/profile', {
        method: 'PUT',
        headers: jsonHeaders(legacyOwnerToken),
        body: JSON.stringify({
          restaurantName: legacyRestaurant.restaurantName,
          contactPerson: legacyRestaurant.contactPerson,
          phoneNumber: legacyRestaurant.phoneNumber,
          whatsappNumber: legacyRestaurant.whatsappNumber,
          city: legacyRestaurant.city,
          street: legacyRestaurant.street,
          description: legacyRestaurant.description,
          locationPlaceId: legacyPlaceId,
        }),
      })
      assert.equal(legacyOwnerCannotVerifyLocation.status, 403)
      assert.equal(
        (
          await prisma.restaurantOwnerProfile.findUniqueOrThrow({
            where: { id: legacyRestaurant.id },
          })
        ).locationStatus,
        'unverified',
      )

      const ownerAInitialJobs = await request<OwnerJobResponse[]>(
        '/owner/jobs',
        {
          headers: jsonHeaders(ownerA.token),
        },
      )
      assert.equal(ownerAInitialJobs.status, 200)
      assert.equal(
        ownerAInitialJobs.body.length,
        8,
      )
      assert.deepEqual(
        ownerAInitialJobs.body
          .map((job) => job.role)
          .sort(),
        [
          'barista',
          'bartender',
          'cook',
          'counterWorker',
          'floorManager',
          'host',
          'socialManager',
          'waiter',
        ],
      )
      assert.ok(
        ownerAInitialJobs.body.every(
          (job) => job.kind === 'posted' && !job.isActive,
        ),
        'starter jobs should be inactive job-board jobs',
      )
      assert.deepEqual(ownerA.profile.qrEnabledRoles.sort(), [
        'bartender',
        'cook',
        'floorManager',
        'host',
        'waiter',
      ])

      const ownerAInitialPublicRestaurant = await request<{
        qrEnabledRoles: string[]
        isHiringForQr: boolean
      }>(`/public/restaurants/${ownerA.profile.slug}`)
      assert.equal(ownerAInitialPublicRestaurant.status, 200)
      assert.equal(ownerAInitialPublicRestaurant.body.isHiringForQr, true)
      assert.deepEqual(
        ownerAInitialPublicRestaurant.body.qrEnabledRoles.sort(),
        ['bartender', 'cook', 'floorManager', 'host', 'waiter'],
      )

      const qrPageViewEvent = await request<{ ok: boolean }>(
        `/public/restaurants/${ownerA.profile.slug}/qr-events`,
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            type: 'qrPageView',
            sessionId: `scan-${runId}`,
          }),
        },
      )
      assert.equal(qrPageViewEvent.status, 201)
      assert.equal(qrPageViewEvent.body.ok, true)

      const qrFormStartedEvent = await request<{ ok: boolean }>(
        `/public/restaurants/${ownerA.profile.slug}/qr-events`,
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            type: 'qrFormStarted',
            sessionId: `scan-${runId}`,
          }),
        },
      )
      assert.equal(qrFormStartedEvent.status, 201)
      assert.equal(qrFormStartedEvent.body.ok, true)

      const duplicateQrFormStartedEvent = await request<{ ok: boolean }>(
        `/public/restaurants/${ownerA.profile.slug}/qr-events`,
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            type: 'qrFormStarted',
            sessionId: `scan-${runId}`,
          }),
        },
      )
      assert.equal(duplicateQrFormStartedEvent.status, 200)
      assert.equal(
        await prisma.restaurantQrEvent.count({
          where: {
            ownerProfileId: ownerA.profile.id,
            type: 'qrFormStarted',
            sessionId: `scan-${runId}`,
          },
        }),
        1,
      )

      const invalidQrEvent = await request<{ message?: string }>(
        `/public/restaurants/${ownerA.profile.slug}/qr-events`,
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            type: 'leadCompleted',
          }),
        },
      )
      assert.equal(invalidQrEvent.status, 400)

      const unknownRestaurantQrEvent = await request<{ message?: string }>(
        '/public/restaurants/not-a-real-restaurant/qr-events',
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            type: 'qrPageView',
            sessionId: `missing-${runId}`,
          }),
        },
      )
      assert.equal(unknownRestaurantQrEvent.status, 404)

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

      const ownerAWaiterJob = ownerAInitialJobs.body.find(
        (job) => job.role === 'waiter',
      )
      const ownerAHostJob = ownerAInitialJobs.body.find(
        (job) => job.role === 'host',
      )
      const ownerABaristaJob = ownerAInitialJobs.body.find(
        (job) => job.role === 'barista',
      )
      const ownerACounterWorkerJob = ownerAInitialJobs.body.find(
        (job) => job.role === 'counterWorker',
      )

      assert.ok(ownerAWaiterJob)
      assert.ok(ownerAHostJob)
      assert.ok(ownerABaristaJob)
      assert.ok(ownerACounterWorkerJob)

      await prisma.restaurantJob.delete({
        where: {
          id: ownerACounterWorkerJob.id,
        },
      })
      const recreatedCounterWorkerJob = await request<OwnerJobResponse>(
        '/owner/jobs',
        {
          method: 'POST',
          headers: jsonHeaders(ownerA.token),
          body: JSON.stringify({
            role: 'counterWorker',
            description: 'Counter service job',
            requirements: 'Friendly and reliable',
            shiftInfo: 'Flexible counter shifts',
            contactPhone: '',
            contactWhatsapp: '',
          }),
        },
      )
      assert.equal(recreatedCounterWorkerJob.status, 201)
      assert.equal(recreatedCounterWorkerJob.body.role, 'counterWorker')

      const duplicateWaiterJob = await request<{ message?: string }>(
        '/owner/jobs',
        {
          method: 'POST',
          headers: jsonHeaders(ownerA.token),
          body: JSON.stringify({
            role: 'waiter',
            description: 'Duplicate waiter job',
            requirements: 'Kind people',
            shiftInfo: 'Evenings',
            contactPhone: '',
            contactWhatsapp: '',
          }),
        },
      )
      assert.equal(duplicateWaiterJob.status, 409)
      assert.equal(
        duplicateWaiterJob.body.message,
        'A job for this role already exists. Edit the existing job instead.',
      )

      const activatedOwnerAJob = await request<OwnerJobResponse>(
        `/owner/jobs/${ownerAWaiterJob.id}/active`,
        {
          method: 'PATCH',
          headers: jsonHeaders(ownerA.token),
          body: JSON.stringify({
            isActive: true,
          }),
        },
      )
      assert.equal(activatedOwnerAJob.status, 200)
      assert.equal(activatedOwnerAJob.body.kind, 'posted')
      assert.equal(activatedOwnerAJob.body.isActive, true)

      const deactivatedOwnerAJob = await request<OwnerJobResponse>(
        `/owner/jobs/${ownerAWaiterJob.id}/active`,
        {
          method: 'PATCH',
          headers: jsonHeaders(ownerA.token),
          body: JSON.stringify({
            isActive: false,
          }),
        },
      )
      assert.equal(deactivatedOwnerAJob.status, 200)
      assert.equal(deactivatedOwnerAJob.body.isActive, false)

      const duplicateHostJob = await request('/owner/jobs', {
        method: 'POST',
        headers: jsonHeaders(ownerA.token),
        body: JSON.stringify({
          role: 'host',
          description: 'Duplicate host job',
          requirements: '',
          shiftInfo: '',
          contactPhone: '',
          contactWhatsapp: '',
        }),
      })
      assert.equal(duplicateHostJob.status, 409)

      const deleteHostJob = await request(
        `/owner/jobs/${ownerAHostJob.id}`,
        {
          method: 'DELETE',
          headers: jsonHeaders(ownerA.token),
        },
      )
      assert.equal(deleteHostJob.status, 204)

      const ownerAJobsAfterDelete = await request<OwnerJobResponse[]>(
        '/owner/jobs',
        {
          headers: jsonHeaders(ownerA.token),
        },
      )
      assert.equal(ownerAJobsAfterDelete.status, 200)
      assert.ok(
        !ownerAJobsAfterDelete.body.some(
          (job) => job.id === ownerAHostJob.id,
        ),
        'deleted job should be gone',
      )
      assert.ok(
        ownerAJobsAfterDelete.body.some(
          (job) => job.id === ownerAWaiterJob.id,
        ),
        'deleting one job should not delete another role job',
      )

      const recreatedHostJob = await request<OwnerJobResponse>('/owner/jobs', {
        method: 'POST',
        headers: jsonHeaders(ownerA.token),
        body: JSON.stringify({
          role: 'host',
          description: 'Recreated host board job',
          requirements: '',
          shiftInfo: '',
          contactPhone: '',
          contactWhatsapp: '',
        }),
      })
      assert.equal(recreatedHostJob.status, 201)
      assert.equal(recreatedHostJob.body.kind, 'posted')
      assert.equal(recreatedHostJob.body.isActive, false)

      const activateHostJob = await request<OwnerJobResponse>(
        `/owner/jobs/${recreatedHostJob.body.id}/active`,
        {
          method: 'PATCH',
          headers: jsonHeaders(ownerA.token),
          body: JSON.stringify({
            isActive: true,
          }),
        },
      )
      assert.equal(activateHostJob.status, 200)
      assert.equal(activateHostJob.body.isActive, true)

      const compatiblePublishRoute = await request<OwnerJobResponse>(
        `/owner/jobs/${recreatedHostJob.body.id}/publish`,
        {
          method: 'POST',
          headers: jsonHeaders(ownerA.token),
        },
      )
      assert.equal(compatiblePublishRoute.status, 200)
      assert.equal(compatiblePublishRoute.body.id, recreatedHostJob.body.id)
      assert.equal(compatiblePublishRoute.body.isActive, true)

      const ownerAJobsAfterRoleChecks = await request<OwnerJobResponse[]>(
        '/owner/jobs',
        {
          headers: jsonHeaders(ownerA.token),
        },
      )
      assert.equal(ownerAJobsAfterRoleChecks.status, 200)
      assert.equal(
        new Set(ownerAJobsAfterRoleChecks.body.map((job) => job.role)).size,
        ownerAJobsAfterRoleChecks.body.length,
        'one restaurant cannot have duplicate role jobs',
      )

      const activateBarista = await request<OwnerJobResponse>(
        `/owner/jobs/${ownerABaristaJob.id}/active`,
        {
          method: 'PATCH',
          headers: jsonHeaders(ownerA.token),
          body: JSON.stringify({
            isActive: true,
          }),
        },
      )
      assert.equal(activateBarista.status, 200)

      const publicAfterBaristaActivation = await request<{
        qrEnabledRoles: string[]
      }>(`/public/restaurants/${ownerA.profile.slug}`)
      assert.equal(publicAfterBaristaActivation.status, 200)
      assert.ok(
        !publicAfterBaristaActivation.body.qrEnabledRoles.includes('barista'),
        'active job-board jobs must not automatically appear in QR roles',
      )

      assert.equal(
        await prisma.restaurantJob.count({
          where: {
            ownerProfileId: ownerA.profile.id,
            role: 'barista',
          },
        }),
        1,
        'activating a starter job must not create a duplicate job',
      )

      for (const [method, path, body] of [
        [
          'PUT',
          `/owner/jobs/${ownerAWaiterJob.id}`,
          {
            role: 'cook',
            description: 'Stolen update',
            requirements: '',
            shiftInfo: '',
            contactPhone: '',
            contactWhatsapp: '',
          },
        ],
        ['PATCH', `/owner/jobs/${ownerAWaiterJob.id}/active`, { isActive: true }],
        ['POST', `/owner/jobs/${ownerAWaiterJob.id}/publish`, undefined],
        ['DELETE', `/owner/jobs/${ownerAWaiterJob.id}`, undefined],
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
        hiringManagerJobs.body.some((job) => job.id === ownerAWaiterJob.id),
      )

      const hiringManagerQrRolesUpdate = await request<OwnerProfileResponse>(
        '/owner/qr-roles',
        {
          method: 'PATCH',
          headers: jsonHeaders(hiringManagerToken),
          body: JSON.stringify({
            qrEnabledRoles: ['barista'],
          }),
        },
      )
      assert.equal(hiringManagerQrRolesUpdate.status, 200)
      assert.deepEqual(hiringManagerQrRolesUpdate.body.qrEnabledRoles, [
        'barista',
      ])

      const publicAfterManagerQrUpdate = await request<{
        qrEnabledRoles: string[]
        isHiringForQr: boolean
      }>(`/public/restaurants/${ownerA.profile.slug}`)
      assert.equal(publicAfterManagerQrUpdate.status, 200)
      assert.deepEqual(publicAfterManagerQrUpdate.body.qrEnabledRoles, [
        'barista',
      ])
      assert.equal(publicAfterManagerQrUpdate.body.isHiringForQr, true)

      const ownerBPublicAfterManagerQrUpdate = await request<{
        qrEnabledRoles: string[]
      }>(`/public/restaurants/${ownerB.profile.slug}`)
      assert.equal(ownerBPublicAfterManagerQrUpdate.status, 200)
      assert.ok(
        !ownerBPublicAfterManagerQrUpdate.body.qrEnabledRoles.includes(
          'barista',
        ),
        'Restaurant A member must not update Restaurant B QR roles',
      )

      const hiringManagerUpdatedJob = await request<OwnerJobResponse>(
        `/owner/jobs/${recreatedHostJob.body.id}`,
        {
          method: 'PUT',
          headers: jsonHeaders(hiringManagerToken),
          body: JSON.stringify({
            role: 'host',
            description: 'Manager updated board job',
            requirements: '',
            shiftInfo: 'Evening',
            contactPhone: '',
            contactWhatsapp: '',
          }),
        },
      )
      assert.equal(hiringManagerUpdatedJob.status, 200)
      assert.equal(hiringManagerUpdatedJob.body.description, 'Manager updated board job')

      const hiringManagerDeactivatedJob = await request<OwnerJobResponse>(
        `/owner/jobs/${recreatedHostJob.body.id}/active`,
        {
          method: 'PATCH',
          headers: jsonHeaders(hiringManagerToken),
          body: JSON.stringify({
            isActive: false,
          }),
        },
      )
      assert.equal(hiringManagerDeactivatedJob.status, 200)
      assert.equal(hiringManagerDeactivatedJob.body.isActive, false)

      const hiringManagerDuplicateJob = await request('/owner/jobs', {
        method: 'POST',
        headers: jsonHeaders(hiringManagerToken),
        body: JSON.stringify({
          role: 'host',
          description: 'Duplicate manager job',
          requirements: '',
          shiftInfo: '',
          contactPhone: '',
          contactWhatsapp: '',
        }),
      })
      assert.equal(hiringManagerDuplicateJob.status, 409)

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

      const ownerBJobs = await request<OwnerJobResponse[]>(
        '/owner/jobs',
        {
          headers: jsonHeaders(ownerB.token),
        },
      )
      assert.equal(ownerBJobs.status, 200)
      const ownerBPrivateJob = ownerBJobs.body.find(
        (job) => job.role === 'waiter',
      )
      assert.ok(ownerBPrivateJob)

      const hiringManagerStolenOwnerBJob = await request(
        `/owner/jobs/${ownerBPrivateJob.id}`,
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

      const removableNewLead =
        await prisma.restaurantCandidateLead.create({
          data: {
            ownerProfileId: ownerA.profile.id,
            fullName: 'Removable New Lead',
            phoneNumber: '0504444444',
            wantedRoles: ['waiter'],
            source: 'security-test',
            status: 'new',
          },
        })
      const hiringManagerDeleteNewLead = await request(
        `/owner/leads/${removableNewLead.id}`,
        {
          method: 'DELETE',
          headers: jsonHeaders(hiringManagerToken),
        },
      )
      assert.equal(hiringManagerDeleteNewLead.status, 204)

      const ownerBLeadForDelete =
        await prisma.restaurantCandidateLead.create({
          data: {
            ownerProfileId: ownerB.profile.id,
            fullName: 'Owner B Delete Guard Lead',
            phoneNumber: '0504445555',
            wantedRoles: ['host'],
            source: 'security-test',
            status: 'new',
          },
        })
      const hiringManagerDeleteOtherRestaurantLead = await request(
        `/owner/leads/${ownerBLeadForDelete.id}`,
        {
          method: 'DELETE',
          headers: jsonHeaders(hiringManagerToken),
        },
      )
      assert.equal(hiringManagerDeleteOtherRestaurantLead.status, 404)

      const removableAppliedApplication =
        await prisma.restaurantApplication.create({
          data: {
            userId: hiringManagerAuth.body.user.id,
            restaurantJobId: ownerAWaiterJob.id,
            status: 'applied',
          },
        })
      const hiringManagerDeleteAppliedApplication = await request(
        `/owner/applications/${removableAppliedApplication.id}`,
        {
          method: 'DELETE',
          headers: jsonHeaders(hiringManagerToken),
        },
      )
      assert.equal(hiringManagerDeleteAppliedApplication.status, 204)

      const hiringManagerDeleteJob = await request(
        `/owner/jobs/${recreatedHostJob.body.id}`,
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

      const nonAdminCannotUpdateOtherRestaurantLocation = await request(
        `/admin/restaurants/${ownerB.profile.id}/location`,
        {
          method: 'PATCH',
          headers: jsonHeaders(ownerA.token),
          body: JSON.stringify({
            placeId: ownerAReplacementPlaceId,
          }),
        },
      )
      assert.equal(nonAdminCannotUpdateOtherRestaurantLocation.status, 403)

      const adminVerifiedLegacyLocation = await request(
        `/admin/restaurants/${legacyRestaurant.id}/location`,
        {
          method: 'PATCH',
          headers: jsonHeaders(adminToken),
          body: JSON.stringify({
            placeId: legacyPlaceId,
          }),
        },
      )
      assert.equal(adminVerifiedLegacyLocation.status, 200)
      assert.equal(
        (
          await prisma.restaurantOwnerProfile.findUniqueOrThrow({
            where: { id: legacyRestaurant.id },
          })
        ).locationStatus,
        'verified',
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
      assert.equal(ownerBAdminRestaurant?.newCandidateCount, 2)

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
      assert.equal(ownerBAfterOwnerASeen?.newCandidateCount, 2)

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
      assert.equal(adminCreatedRestaurant.body.ownerLoginPhone, null)
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

      assert.equal(adminCreatedRestaurant.body.claim.status, 'available')
      assert.match(adminCreatedRestaurant.body.claim.token ?? '', /^[A-Za-z0-9_-]{32,}$/)

      const storedAdminCreatedClaim =
        await prisma.restaurantClaim.findUniqueOrThrow({
          where: {
            restaurantOwnerProfileId: adminCreatedRestaurant.body.id,
          },
        })
      assert.notEqual(
        storedAdminCreatedClaim.tokenHash,
        adminCreatedRestaurant.body.claim.token,
      )
      assert.equal(storedAdminCreatedClaim.claimedAt, null)

      const validPublicClaim = await request<PublicRestaurantClaimResponse>(
        `/public/restaurants/${adminCreatedRestaurant.body.slug}/claim?token=${adminCreatedRestaurant.body.claim.token}`,
      )
      assert.equal(validPublicClaim.status, 200)
      assert.equal(
        validPublicClaim.body.restaurantName,
        adminCreatedRestaurant.body.restaurantName,
      )
      assert.equal(validPublicClaim.body.claimStatus, 'available')
      assert.equal(validPublicClaim.body.ownerLoginPhone, undefined)
      assert.equal(validPublicClaim.body.members, undefined)
      assert.equal(validPublicClaim.body.userId, undefined)
      assert.equal(validPublicClaim.body.candidates, undefined)

      const wrongPublicClaim = await request<Record<string, unknown>>(
        `/public/restaurants/${adminCreatedRestaurant.body.slug}/claim?token=${'x'.repeat(43)}`,
      )
      assert.equal(wrongPublicClaim.status, 410)

      const mismatchedRestaurantClaim =
        await request<Record<string, unknown>>(
          `/public/restaurants/${duplicateNameRestaurant.body.slug}/claim?token=${adminCreatedRestaurant.body.claim.token}`,
        )
      assert.equal(mismatchedRestaurantClaim.status, 410)

      const claimTarget = await request<AdminRestaurantResponse>(
        '/admin/restaurants',
        {
          method: 'POST',
          headers: jsonHeaders(adminToken),
          body: JSON.stringify({
            restaurantName: `Claim Target ${runId}`,
            city: 'Tel Aviv',
          }),
        },
      )
      assert.equal(claimTarget.status, 201)
      assert.equal(claimTarget.body.claim.status, 'available')
      assert.ok(claimTarget.body.claim.token)
      createdOwnerProfileIds.push(claimTarget.body.id)
      const claimTargetProfile =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: {
            id: claimTarget.body.id,
          },
          select: {
            userId: true,
            qrEnabledRoles: true,
            jobs: {
              select: {
                id: true,
              },
            },
          },
        })
      createdUserIds.push(claimTargetProfile.userId)

      const unauthenticatedClaimCompletion =
        await request<Record<string, unknown>>(
          `/owner/claims/${claimTarget.body.slug}/complete`,
          {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({
              token: claimTarget.body.claim.token,
            }),
          },
        )
      assert.equal(unauthenticatedClaimCompletion.status, 401)

      const claimOwnerPhone = '0531112222'
      const claimOwnerCodeRequest = await requestPhoneCode(
        claimOwnerPhone,
        'register',
      )
      assert.equal(claimOwnerCodeRequest.status, 200)
      const claimOwnerCode = getCapturedOtpCodeForTest(
        '+972531112222',
        'register',
      )
      assert.match(claimOwnerCode ?? '', /^\d{4}$/)
      const claimOwnerAuth = await verifyPhoneCode({
        phoneNumber: claimOwnerPhone,
        code: claimOwnerCode,
        purpose: 'register',
        fullName: 'Claim Owner',
        track: 'restaurantOwner',
      })
      assert.equal(claimOwnerAuth.status, 200)
      assert.ok(claimOwnerAuth.body.user?.id)
      createdUserIds.push(claimOwnerAuth.body.user?.id ?? '')

      const crossRestaurantClaim = await request<Record<string, unknown>>(
        `/owner/claims/${adminCreatedRestaurant.body.slug}/complete`,
        {
          method: 'POST',
          headers: jsonHeaders(claimOwnerAuth.body.token),
          body: JSON.stringify({
            token: claimTarget.body.claim.token,
          }),
        },
      )
      assert.equal(crossRestaurantClaim.status, 410)

      const completedClaim =
        await request<RestaurantClaimCompletionResponse>(
          `/owner/claims/${claimTarget.body.slug}/complete`,
          {
            method: 'POST',
            headers: jsonHeaders(claimOwnerAuth.body.token),
            body: JSON.stringify({
              token: claimTarget.body.claim.token,
            }),
          },
        )
      assert.equal(completedClaim.status, 200)
      assert.equal(completedClaim.body.alreadyOwned, false)
      assert.equal(completedClaim.body.profileComplete, true)
      assert.equal(completedClaim.body.restaurant.id, claimTarget.body.id)
      assert.equal(
        await prisma.restaurantOwnerProfile.count({
          where: {
            id: claimTarget.body.id,
          },
        }),
        1,
      )
      assert.equal(
        await prisma.restaurantMember.count({
          where: {
            restaurantId: claimTarget.body.id,
            userId: claimOwnerAuth.body.user?.id,
            role: 'owner',
            status: 'active',
          },
        }),
        1,
      )
      const consumedClaim = await prisma.restaurantClaim.findUniqueOrThrow({
        where: {
          restaurantOwnerProfileId: claimTarget.body.id,
        },
      })
      assert.ok(consumedClaim.claimedAt)

      const idempotentSameOwnerClaim =
        await request<RestaurantClaimCompletionResponse>(
          `/owner/claims/${claimTarget.body.slug}/complete`,
          {
            method: 'POST',
            headers: jsonHeaders(claimOwnerAuth.body.token),
            body: JSON.stringify({
              token: claimTarget.body.claim.token,
            }),
          },
        )
      assert.equal(idempotentSameOwnerClaim.status, 200)
      assert.equal(idempotentSameOwnerClaim.body.alreadyOwned, true)
      assert.equal(
        await prisma.restaurantMember.count({
          where: {
            restaurantId: claimTarget.body.id,
            role: 'owner',
            status: 'active',
          },
        }),
        1,
      )

      const secondClaimUserPhone = '0542223333'
      const secondClaimUserCodeRequest = await requestPhoneCode(
        secondClaimUserPhone,
        'register',
      )
      assert.equal(secondClaimUserCodeRequest.status, 200)
      const secondClaimUserCode = getCapturedOtpCodeForTest(
        '+972542223333',
        'register',
      )
      const secondClaimUserAuth = await verifyPhoneCode({
        phoneNumber: secondClaimUserPhone,
        code: secondClaimUserCode,
        purpose: 'register',
        fullName: 'Other Claim User',
        track: 'restaurantOwner',
      })
      assert.equal(secondClaimUserAuth.status, 200)
      assert.ok(secondClaimUserAuth.body.user?.id)
      createdUserIds.push(secondClaimUserAuth.body.user?.id ?? '')

      const otherUserClaimAttempt = await request<Record<string, unknown>>(
        `/owner/claims/${claimTarget.body.slug}/complete`,
        {
          method: 'POST',
          headers: jsonHeaders(secondClaimUserAuth.body.token),
          body: JSON.stringify({
            token: claimTarget.body.claim.token,
          }),
        },
      )
      assert.equal(otherUserClaimAttempt.status, 409)

      const replaceClaimedOwnerAttempt =
        await request<Record<string, unknown>>(
          `/admin/restaurants/${claimTarget.body.id}`,
          {
            method: 'PATCH',
            headers: jsonHeaders(adminToken),
            body: JSON.stringify({
              ownerLoginPhone: '0508881234',
            }),
          },
        )
      assert.equal(replaceClaimedOwnerAttempt.status, 409)
      assert.equal(
        await prisma.restaurantMember.count({
          where: {
            restaurantId: claimTarget.body.id,
            userId: claimOwnerAuth.body.user?.id,
            role: 'owner',
            status: 'active',
          },
        }),
        1,
      )

      const claimTargetAfterClaim =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: {
            id: claimTarget.body.id,
          },
          select: {
            qrEnabledRoles: true,
            jobs: {
              select: {
                id: true,
              },
            },
          },
        })
      assert.deepEqual(
        claimTargetAfterClaim.qrEnabledRoles,
        claimTargetProfile.qrEnabledRoles,
      )
      assert.deepEqual(claimTargetAfterClaim.jobs, claimTargetProfile.jobs)

      const regenerationTarget = await request<AdminRestaurantResponse>(
        '/admin/restaurants',
        {
          method: 'POST',
          headers: jsonHeaders(adminToken),
          body: JSON.stringify({
            restaurantName: `Regenerate Claim ${runId}`,
            city: 'Tel Aviv',
          }),
        },
      )
      assert.equal(regenerationTarget.status, 201)
      createdOwnerProfileIds.push(regenerationTarget.body.id)
      const regenerationTargetProfile =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: {
            id: regenerationTarget.body.id,
          },
          select: {
            userId: true,
          },
        })
      createdUserIds.push(regenerationTargetProfile.userId)
      const oldRegenerationToken = regenerationTarget.body.claim.token

      const regeneratedClaim = await request<{
        status: 'available'
        token: string
      }>(
        `/admin/restaurants/${regenerationTarget.body.id}/claim/regenerate`,
        {
          method: 'POST',
          headers: jsonHeaders(adminToken),
        },
      )
      assert.equal(regeneratedClaim.status, 200)
      assert.ok(regeneratedClaim.body.token)
      assert.notEqual(regeneratedClaim.body.token, oldRegenerationToken)

      const oldRegeneratedLink = await request<Record<string, unknown>>(
        `/public/restaurants/${regenerationTarget.body.slug}/claim?token=${oldRegenerationToken}`,
      )
      assert.equal(oldRegeneratedLink.status, 410)
      const newRegeneratedLink = await request<PublicRestaurantClaimResponse>(
        `/public/restaurants/${regenerationTarget.body.slug}/claim?token=${regeneratedClaim.body.token}`,
      )
      assert.equal(newRegeneratedLink.status, 200)

      const regeneratedClaimCompletion =
        await request<RestaurantClaimCompletionResponse>(
          `/owner/claims/${regenerationTarget.body.slug}/complete`,
          {
            method: 'POST',
            headers: jsonHeaders(secondClaimUserAuth.body.token),
            body: JSON.stringify({
              token: regeneratedClaim.body.token,
            }),
          },
        )
      assert.equal(regeneratedClaimCompletion.status, 200)
      assert.equal(regeneratedClaimCompletion.body.alreadyOwned, false)

      const regenerateAfterClaim = await request<Record<string, unknown>>(
        `/admin/restaurants/${regenerationTarget.body.id}/claim/regenerate`,
        {
          method: 'POST',
          headers: jsonHeaders(adminToken),
        },
      )
      assert.equal(regenerateAfterClaim.status, 409)

      const deletableRestaurant = await request<AdminRestaurantResponse>(
        '/admin/restaurants',
        {
          method: 'POST',
          headers: jsonHeaders(adminToken),
          body: JSON.stringify({
            restaurantName: `Admin Delete ${runId}`,
          }),
        },
      )
      assert.equal(deletableRestaurant.status, 201)
      assert.ok(deletableRestaurant.body.slug)
      const deletableProfile =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: {
            id: deletableRestaurant.body.id,
          },
          select: {
            userId: true,
          },
        })
      createdUserIds.push(deletableProfile.userId)

      const nonAdminDeleteRestaurant = await request(
        `/admin/restaurants/${deletableRestaurant.body.id}`,
        {
          method: 'DELETE',
          headers: jsonHeaders(nonAdminToken),
        },
      )
      assert.equal(nonAdminDeleteRestaurant.status, 403)

      const adminDeleteRestaurant = await request(
        `/admin/restaurants/${deletableRestaurant.body.id}`,
        {
          method: 'DELETE',
          headers: jsonHeaders(adminToken),
        },
      )
      assert.equal(adminDeleteRestaurant.status, 204)

      const adminRestaurantsAfterDelete = await request<
        AdminRestaurantResponse[]
      >('/admin/restaurants', {
        headers: jsonHeaders(adminToken),
      })
      assert.equal(adminRestaurantsAfterDelete.status, 200)
      assert.ok(
        adminRestaurantsAfterDelete.body.every(
          (restaurant) => restaurant.id !== deletableRestaurant.body.id,
        ),
      )

      const publicDeletedRestaurant =
        await request<Record<string, unknown>>(
          `/public/restaurants/${deletableRestaurant.body.slug}`,
        )
      assert.equal(publicDeletedRestaurant.status, 404)

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
      assert.equal(editedAdminRestaurant.body.ownerLoginPhone, null)

      const restaurantContactPhone = '0504445555'
      const restaurantContactPhoneUpdate =
        await request<AdminRestaurantResponse>(
          `/admin/restaurants/${adminCreatedRestaurant.body.id}`,
          {
            method: 'PATCH',
            headers: jsonHeaders(adminToken),
            body: JSON.stringify({
              phoneNumber: restaurantContactPhone,
            }),
          },
        )
      assert.equal(restaurantContactPhoneUpdate.status, 200)
      assert.equal(
        restaurantContactPhoneUpdate.body.phoneNumber,
        restaurantContactPhone,
      )
      assert.equal(restaurantContactPhoneUpdate.body.ownerLoginPhone, null)

      const requestedContactPhoneCode = await requestPhoneCode(
        restaurantContactPhone,
        'register',
      )
      assert.equal(requestedContactPhoneCode.status, 200)
      const capturedContactPhoneCode = getCapturedOtpCodeForTest(
        '+972504445555',
        'register',
      )
      assert.match(capturedContactPhoneCode ?? '', /^\d{4}$/)
      const contactPhoneAuth = await verifyPhoneCode({
        phoneNumber: restaurantContactPhone,
        code: capturedContactPhoneCode,
        purpose: 'register',
        fullName: 'Restaurant Contact Only',
        track: 'restaurantOwner',
      })
      assert.equal(contactPhoneAuth.status, 200)
      assert.ok(contactPhoneAuth.body.user?.id)
      createdUserIds.push(contactPhoneAuth.body.user.id)
      const contactPhoneProfile = await request<OwnerProfileResponse | null>(
        '/owner/profile',
        {
          headers: jsonHeaders(contactPhoneAuth.body.token),
        },
      )
      assert.equal(contactPhoneProfile.status, 200)
      assert.equal(contactPhoneProfile.body, null)
      assert.equal(
        await prisma.restaurantMember.count({
          where: {
            restaurantId: adminCreatedRestaurant.body.id,
            phoneNumber: '+972504445555',
            status: 'active',
          },
        }),
        0,
      )

      const ownerLoginPhone = '0503334444'
      const ownerLoginPhoneUpdate = await request<AdminRestaurantResponse>(
        `/admin/restaurants/${adminCreatedRestaurant.body.id}`,
        {
          method: 'PATCH',
          headers: jsonHeaders(adminToken),
          body: JSON.stringify({
            ownerLoginPhone,
          }),
        },
      )
      assert.equal(ownerLoginPhoneUpdate.status, 200)
      assert.equal(
        ownerLoginPhoneUpdate.body.ownerLoginPhone,
        '+972503334444',
      )
      assert.equal(
        await prisma.restaurantMember.count({
          where: {
            restaurantId: adminCreatedRestaurant.body.id,
            phoneNumber: '+972503334444',
            role: 'owner',
            status: 'pending',
            userId: null,
          },
        }),
        1,
      )

      const requestedOwnerLoginPhoneCode = await requestPhoneCode(
        ownerLoginPhone,
        'register',
      )
      assert.equal(requestedOwnerLoginPhoneCode.status, 200)
      const capturedOwnerLoginPhoneCode = getCapturedOtpCodeForTest(
        '+972503334444',
        'register',
      )
      assert.match(capturedOwnerLoginPhoneCode ?? '', /^\d{4}$/)
      const linkedOwnerAuth = await verifyPhoneCode({
        phoneNumber: ownerLoginPhone,
        code: capturedOwnerLoginPhoneCode,
        purpose: 'register',
        fullName: 'Linked Admin Owner',
        track: 'restaurantOwner',
      })
      assert.equal(linkedOwnerAuth.status, 200)
      assert.equal(linkedOwnerAuth.body.user?.restaurantMemberRole, 'owner')
      assert.ok(linkedOwnerAuth.body.user?.id)
      createdUserIds.push(linkedOwnerAuth.body.user.id)

      const linkedOwnerProfile = await request<OwnerProfileResponse>(
        '/owner/profile',
        {
          headers: jsonHeaders(linkedOwnerAuth.body.token),
        },
      )
      assert.equal(linkedOwnerProfile.status, 200)
      assert.equal(linkedOwnerProfile.body.id, adminCreatedRestaurant.body.id)
      assert.ok(linkedOwnerProfile.body.slug)

      const adminCreatedPlaceId = `admin-created-place-${runId}`
      registerTestRestaurantPlace(
        adminCreatedPlaceId,
        'Nahalat Binyamin Street',
        '40',
      )
      const linkedOwnerCannotVerifyAdminRestaurant = await request<{
        message?: string
      }>('/owner/profile', {
        method: 'PUT',
        headers: jsonHeaders(linkedOwnerAuth.body.token),
        body: JSON.stringify({
          restaurantName: adminCreatedRestaurant.body.restaurantName,
          contactPerson: 'Linked Admin Owner',
          phoneNumber: '0503334444',
          whatsappNumber: '0503334444',
          city: 'Tel Aviv',
          street: 'Admin-created legacy address',
          description: 'Admin-created restaurant',
          locationPlaceId: adminCreatedPlaceId,
        }),
      })
      assert.equal(linkedOwnerCannotVerifyAdminRestaurant.status, 403)
      assert.equal(
        (
          await prisma.restaurantOwnerProfile.findUniqueOrThrow({
            where: { id: adminCreatedRestaurant.body.id },
          })
        ).locationStatus,
        'unverified',
      )

      const adminVerifiedAdminCreatedLocation = await request(
        `/admin/restaurants/${adminCreatedRestaurant.body.id}/location`,
        {
          method: 'PATCH',
          headers: jsonHeaders(adminToken),
          body: JSON.stringify({
            placeId: adminCreatedPlaceId,
          }),
        },
      )
      assert.equal(adminVerifiedAdminCreatedLocation.status, 200)
      assert.equal(
        (
          await prisma.restaurantOwnerProfile.findUniqueOrThrow({
            where: { id: adminCreatedRestaurant.body.id },
          })
        ).locationStatus,
        'verified',
      )

      const linkedOwnerJobs = await request<OwnerJobResponse[]>(
        '/owner/jobs',
        {
          headers: jsonHeaders(linkedOwnerAuth.body.token),
        },
      )
      assert.equal(linkedOwnerJobs.status, 200)

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
        'isHiringForQr',
        'qrEnabledRoles',
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

      const workerQrRolesUpdate = await request('/owner/qr-roles', {
        method: 'PATCH',
        headers: jsonHeaders(workerToken),
        body: JSON.stringify({
          qrEnabledRoles: ['waiter'],
        }),
      })
      assert.equal(workerQrRolesUpdate.status, 403)

      const workerDeleteGuardLead =
        await prisma.restaurantCandidateLead.create({
          data: {
            ownerProfileId: ownerA.profile.id,
            fullName: 'Worker Delete Guard Lead',
            phoneNumber: '0501313131',
            wantedRoles: ['waiter'],
            source: 'security-test',
          },
        })
      const workerDeleteLead = await request(
        `/owner/leads/${workerDeleteGuardLead.id}`,
        {
          method: 'DELETE',
          headers: jsonHeaders(workerToken),
        },
      )
      assert.equal(workerDeleteLead.status, 403)

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

      const disabledAllQrRoles = await request<OwnerProfileResponse>(
        '/owner/qr-roles',
        {
          method: 'PATCH',
          headers: jsonHeaders(ownerA.token),
          body: JSON.stringify({
            qrEnabledRoles: [],
          }),
        },
      )
      assert.equal(disabledAllQrRoles.status, 200)
      assert.deepEqual(disabledAllQrRoles.body.qrEnabledRoles, [])

      const publicWhenAllQrRolesDisabled = await request<{
        qrEnabledRoles: string[]
        isHiringForQr: boolean
      }>(`/public/restaurants/${ownerA.profile.slug}`)
      assert.equal(publicWhenAllQrRolesDisabled.status, 200)
      assert.deepEqual(publicWhenAllQrRolesDisabled.body.qrEnabledRoles, [])
      assert.equal(publicWhenAllQrRolesDisabled.body.isHiringForQr, false)

      const disabledQrRoleSubmit = await request<{ message?: string }>(
        `/public/restaurants/${ownerA.profile.slug}/verified-leads`,
        {
          method: 'POST',
          headers: jsonHeaders(workerToken),
          body: JSON.stringify({
            wantedRoles: ['waiter'],
            experienceText: 'Should be rejected',
            availability: 'Evenings',
            age: 25,
          }),
        },
      )
      assert.equal(disabledQrRoleSubmit.status, 400)
      assert.equal(
        disabledQrRoleSubmit.body.message,
        'This role is no longer open for QR applications.',
      )

      await request<OwnerProfileResponse>('/owner/qr-roles', {
        method: 'PATCH',
        headers: jsonHeaders(ownerA.token),
        body: JSON.stringify({
          qrEnabledRoles: ['counterWorker'],
        }),
      })

      const disabledSpecificQrRoleSubmit = await request<{
        message?: string
      }>(`/public/restaurants/${ownerA.profile.slug}/verified-leads`, {
        method: 'POST',
        headers: jsonHeaders(workerToken),
        body: JSON.stringify({
          wantedRoles: ['waiter'],
          experienceText: 'Should be rejected',
          availability: 'Evenings',
          age: 25,
        }),
      })
      assert.equal(disabledSpecificQrRoleSubmit.status, 400)
      assert.equal(
        disabledSpecificQrRoleSubmit.body.message,
        'This role is no longer open for QR applications.',
      )
      assert.equal(
        await prisma.restaurantCandidateLead.count({
          where: {
            ownerProfileId: ownerA.profile.id,
            phoneNumber: '+972509999999',
          },
        }),
        0,
      )

      const publicAfterCounterWorkerOnlyQrRoles = await request<{
        qrEnabledRoles: string[]
      }>(`/public/restaurants/${ownerA.profile.slug}`)
      assert.equal(publicAfterCounterWorkerOnlyQrRoles.status, 200)
      assert.deepEqual(
        publicAfterCounterWorkerOnlyQrRoles.body.qrEnabledRoles,
        ['counterWorker'],
      )

      const counterWorkerToken = await registerAndLogin(
        `counter-worker-${runId}@example.test`,
        'restaurant',
      )
      await request('/restaurant/profile', {
        method: 'PUT',
        headers: jsonHeaders(counterWorkerToken),
        body: JSON.stringify({
          fullName: 'Counter Worker',
          phoneNumber: '0508888888',
          location: 'Tel Aviv',
          wantedRoles: ['counterWorker'],
          experienceText: 'No experience',
          availability: 'Flexible',
          age: 22,
        }),
      })
      const counterWorkerUser = await prisma.user.update({
        where: {
          email: `counter-worker-${runId}@example.test`,
        },
        data: {
          phoneNumber: '+972508888888',
          phoneVerifiedAt: new Date(),
          fullName: 'Counter Worker',
        },
      })

      const counterWorkerVerifiedLead = await request<{ ok: boolean }>(
        `/public/restaurants/${ownerA.profile.slug}/verified-leads`,
        {
          method: 'POST',
          headers: jsonHeaders(counterWorkerToken),
          body: JSON.stringify({
            wantedRoles: ['counterWorker'],
            experienceText: 'Counter experience',
            availability: 'Flexible',
            age: 22,
          }),
        },
      )
      assert.equal(counterWorkerVerifiedLead.status, 201)
      const counterWorkerLead =
        await prisma.restaurantCandidateLead.findFirstOrThrow({
          where: {
            ownerProfileId: ownerA.profile.id,
            phoneNumber: '+972508888888',
          },
        })
      assert.deepEqual(counterWorkerLead.wantedRoles, ['counterWorker'])
      await prisma.restaurantCandidateLead.delete({
        where: {
          id: counterWorkerLead.id,
        },
      })
      await prisma.restaurantWorkerProfile.delete({
        where: {
          userId: counterWorkerUser.id,
        },
      })

      const restoredQrRoles = await request<OwnerProfileResponse>(
        '/owner/qr-roles',
        {
          method: 'PATCH',
          headers: jsonHeaders(ownerA.token),
          body: JSON.stringify({
            qrEnabledRoles: ['waiter', 'host', 'barista', 'counterWorker'],
          }),
        },
      )
      assert.equal(restoredQrRoles.status, 200)
      assert.deepEqual(restoredQrRoles.body.qrEnabledRoles, [
        'waiter',
        'host',
        'barista',
        'counterWorker',
      ])
      const publicAfterRestoredQrRoles = await request<{
        qrEnabledRoles: string[]
      }>(`/public/restaurants/${ownerA.profile.slug}`)
      assert.equal(publicAfterRestoredQrRoles.status, 200)
      assert.ok(publicAfterRestoredQrRoles.body.qrEnabledRoles.includes('barista'))

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
      assert.equal(verifiedLead.ownerViewedAt, null)

      const ownerLeadsView = await request('/owner/leads', {
        headers: jsonHeaders(ownerA.token),
      })
      assert.equal(ownerLeadsView.status, 200)
      const verifiedLeadAfterOwnerView =
        await prisma.restaurantCandidateLead.findUniqueOrThrow({
          where: {
            id: verifiedLead.id,
          },
        })
      assert.equal(verifiedLeadAfterOwnerView.status, 'new')
      assert.ok(verifiedLeadAfterOwnerView.ownerViewedAt)

      const adminQrFunnelAfterVerifiedLead = await request<
        AdminRestaurantResponse[]
      >('/admin/restaurants', {
        headers: jsonHeaders(adminToken),
      })
      assert.equal(adminQrFunnelAfterVerifiedLead.status, 200)
      const ownerAQrFunnel = adminQrFunnelAfterVerifiedLead.body.find(
        (restaurant) => restaurant.id === ownerA.profile.id,
      )?.funnelMetrics
      assert.ok(ownerAQrFunnel)
      assert.equal(ownerAQrFunnel.qrScans, 1)
      assert.equal(ownerAQrFunnel.uniqueQrVisitors, 1)
      assert.equal(ownerAQrFunnel.startedForms, 1)
      assert.equal(ownerAQrFunnel.completedForms, 1)
      assert.equal(ownerAQrFunnel.ownerViewedCompletedForms, 1)
      assert.ok(ownerAQrFunnel.lastScanAt)
      assert.ok(ownerAQrFunnel.lastCompletedAt)
      assert.ok(ownerAQrFunnel.lastOwnerViewAt)

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

      await prisma.restaurantWorkerProfile.update({
        where: {
          userId: workerUser.id,
        },
        data: {
          fullName: 'Worker',
          phoneNumber: '+972509999999',
          wantedRoles: ['waiter', 'host'],
          experienceText: '2 years\n\nVerified QR experience',
          availability: 'Evening, Weekends',
          age: 25,
        },
      })

      const workerMe = await request<{
        workerLocationRequired: boolean
      }>('/auth/me', {
        headers: jsonHeaders(workerToken),
      })
      assert.equal(workerMe.status, 200)
      assert.equal(workerMe.body.workerLocationRequired, true)

      const newWorkerExploreWithoutStreet =
        await request<RestaurantExploreResponse>('/restaurant/explore', {
          method: 'POST',
          headers: jsonHeaders(workerToken),
          body: JSON.stringify({
            limit: 10,
            excludeJobIds: [],
          }),
        })
      assert.equal(newWorkerExploreWithoutStreet.status, 400)

      const newWorkerMapWithoutStreet =
        await request<RestaurantMapResponse>('/restaurant/jobs/map', {
          headers: jsonHeaders(workerToken),
        })
      assert.equal(newWorkerMapWithoutStreet.status, 400)

      const coordinateBypassAttempt = await request<{ message?: string }>(
        '/restaurant/profile',
        {
          method: 'PUT',
          headers: jsonHeaders(workerToken),
          body: JSON.stringify({
            fullName: 'Worker',
            phoneNumber: '+972509999999',
            location: 'Tel Aviv',
            wantedRoles: ['waiter', 'host'],
            experienceText: '2 years\n\nVerified QR experience',
            availability: 'Evening, Weekends',
            age: 25,
            homeLatitude: 32.08,
            homeLongitude: 34.77,
          }),
        },
      )
      assert.equal(coordinateBypassAttempt.status, 400)
      assert.equal(
        (
          await prisma.restaurantWorkerProfile.findUniqueOrThrow({
            where: { userId: workerUser.id },
          })
        ).homeGooglePlaceId,
        null,
      )

      const workerStreetPlaceId = `worker-street-${runId}`
      registerTestWorkerStreet(workerStreetPlaceId)
      const completedNewWorkerProfile = await request<{
        homeGooglePlaceId: string | null
        locationRequired: boolean
      }>('/restaurant/profile', {
        method: 'PUT',
        headers: jsonHeaders(workerToken),
        body: JSON.stringify({
          fullName: 'Worker',
          phoneNumber: '+972509999999',
          location: 'Tel Aviv',
          wantedRoles: ['waiter', 'host'],
          experienceText: '2 years\n\nVerified QR experience',
          availability: 'Evening, Weekends',
          age: 25,
          homePlaceId: workerStreetPlaceId,
        }),
      })
      assert.equal(completedNewWorkerProfile.status, 200)
      assert.equal(
        completedNewWorkerProfile.body.homeGooglePlaceId,
        workerStreetPlaceId,
      )
      assert.equal(completedNewWorkerProfile.body.locationRequired, true)

      const legacyWorkerEmail = `legacy-worker-${runId}@example.test`
      const legacyWorkerToken = await registerAndLogin(
        legacyWorkerEmail,
        'restaurant',
      )
      const legacyWorkerUser = await prisma.user.update({
        where: {
          email: legacyWorkerEmail,
        },
        data: {
          workerLocationRequired: false,
          phoneNumber: '+972505556666',
          phoneVerifiedAt: new Date(),
          fullName: 'Legacy Worker',
        },
      })
      await prisma.restaurantWorkerProfile.create({
        data: {
          userId: legacyWorkerUser.id,
          fullName: 'Legacy Worker',
          phoneNumber: '+972505556666',
          location: 'Tel Aviv',
          wantedRoles: ['waiter'],
          experienceText: '1 year',
          availability: 'Morning',
          age: 24,
        },
      })

      const legacyWorkerLogin = await request<AuthResponse>('/auth/login', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          email: legacyWorkerEmail,
          password: 'password123',
        }),
      })
      assert.equal(legacyWorkerLogin.status, 200)
      assert.equal(
        legacyWorkerLogin.body.user?.workerLocationRequired,
        false,
      )

      const legacyWorkerProfile = await request<{
        homeGooglePlaceId: string | null
        locationRequired: boolean
      }>('/restaurant/profile', {
        headers: jsonHeaders(legacyWorkerToken),
      })
      assert.equal(legacyWorkerProfile.status, 200)
      assert.equal(legacyWorkerProfile.body.homeGooglePlaceId, null)
      assert.equal(legacyWorkerProfile.body.locationRequired, false)

      const legacyWorkerExplore =
        await request<RestaurantExploreResponse>('/restaurant/explore', {
          method: 'POST',
          headers: jsonHeaders(legacyWorkerToken),
          body: JSON.stringify({
            limit: 10,
            excludeJobIds: [],
          }),
        })
      assert.equal(legacyWorkerExplore.status, 200)

      const legacyWorkerMap = await request<RestaurantMapResponse>(
        '/restaurant/jobs/map',
        {
          headers: jsonHeaders(legacyWorkerToken),
        },
      )
      assert.equal(legacyWorkerMap.status, 200)

      const activePostedJob = await prisma.restaurantJob.update({
        where: {
          id: ownerAWaiterJob.id,
        },
        data: {
          restaurantName: `${runId} Active Job`,
          kind: 'posted',
          isActive: true,
        },
      })
      await prisma.restaurantJob.create({
        data: {
          restaurantName: `${runId} Inactive Job`,
          role: 'waiter',
          location: 'Tel Aviv',
          area: 'Test',
          kind: 'posted',
          isActive: false,
        },
      })

      await prisma.restaurantOwnerProfile.update({
        where: {
          id: ownerA.profile.id,
        },
        data: {
          locationStatus: 'verified',
          locationCity: 'Tel Aviv–Yafo',
          locationStreetName: 'Dizengoff',
          locationStreetNumber: '100',
          formattedAddress: 'Dizengoff St 100, Tel Aviv–Yafo, Israel',
          googlePlaceId: `security-place-${runId}`,
          latitude: 32.0809,
          longitude: 34.7732,
          locationVerifiedAt: new Date(),
        },
      })

      const unauthenticatedMap = await request('/restaurant/jobs/map')
      assert.equal(unauthenticatedMap.status, 401)

      const restaurantMap = await request<RestaurantMapResponse>(
        '/restaurant/jobs/map',
        {
          headers: jsonHeaders(workerToken),
        },
      )
      assert.equal(restaurantMap.status, 200)
      const ownerAMapEntry = restaurantMap.body.find(
        (entry) => entry.restaurantId === ownerA.profile.id,
      )
      assert.ok(ownerAMapEntry)
      assert.equal(
        restaurantMap.body.filter(
          (entry) => entry.restaurantId === ownerA.profile.id,
        ).length,
        1,
      )
      assert.ok(
        ownerAMapEntry.jobs.some((job) => job.id === activePostedJob.id),
      )
      assert.ok(
        ownerAMapEntry.jobs.every((job) => job.id !== undefined),
      )

      const ownerCannotReplaceVerifiedLocation = await request<{
        message?: string
      }>('/owner/profile', {
        method: 'PUT',
        headers: jsonHeaders(ownerA.token),
        body: JSON.stringify({
          restaurantName: `Owner A ${runId}`,
          contactPerson: 'Owner A',
          phoneNumber: '0500000000',
          whatsappNumber: '0500000000',
          city: 'Tel Aviv',
          street: 'Changed street',
          description: 'Existing restaurant',
          locationPlaceId: 'must-not-be-used',
        }),
      })
      assert.equal(ownerCannotReplaceVerifiedLocation.status, 403)

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
            !job.restaurantName.includes(`${runId} Inactive Job`),
        ),
      )

      const workerApplication = await request<{ id: string }>(
        '/restaurant/applications',
        {
          method: 'POST',
          headers: jsonHeaders(workerToken),
          body: JSON.stringify({
            restaurantJobId: activePostedJob.id,
          }),
        },
      )
      assert.equal(workerApplication.status, 201)

      const ownerApplications = await request<
        Array<{ worker: Record<string, unknown> }>
      >('/owner/applications', {
        headers: jsonHeaders(ownerA.token),
      })
      assert.equal(ownerApplications.status, 200)
      const ownerVisibleWorker = ownerApplications.body.find(
        (application) => application.worker.id === workerUser.id,
      )?.worker
      assert.ok(ownerVisibleWorker)
      assert.equal(ownerVisibleWorker.homeStreetName, undefined)
      assert.equal(ownerVisibleWorker.homeAreaFormatted, undefined)
      assert.equal(ownerVisibleWorker.homeLatitude, undefined)
      assert.equal(ownerVisibleWorker.homeLongitude, undefined)
    } finally {
      clearGooglePlaceDetailsForTest()
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
