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

type PrismaModule = typeof import('../lib/prisma.js')

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

    process.env.ADMIN_EMAILS = adminEmail

    const [{ app }, { prisma }] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js') as Promise<PrismaModule>,
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

      const nonAdminToken = ownerA.token
      const nonAdminAdminRequest = await request(
        '/admin/restaurant-leads',
        {
          headers: jsonHeaders(nonAdminToken),
        },
      )
      assert.equal(nonAdminAdminRequest.status, 403)

      const adminToken = await registerAndLogin(adminEmail, 'restaurantOwner')
      const adminRequest = await request('/admin/restaurant-leads', {
        headers: jsonHeaders(adminToken),
      })
      assert.equal(adminRequest.status, 200)

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
          email: {
            in: createdEmails,
          },
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
