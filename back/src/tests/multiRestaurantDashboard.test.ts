import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
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
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run multi-restaurant dashboard tests against DATABASE_URL.',
    )
  }

  if (databaseUrl && databaseUrl === testDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run multi-restaurant dashboard tests against the normal app database.',
    )
  }

  if (!testDatabaseUrl.toLowerCase().includes('test')) {
    throw new Error(
      'Multi-restaurant dashboard tests require a dedicated database with test in its URL.',
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
  'multi-restaurant dashboard data and mutations remain explicitly restaurant-scoped',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run multi-restaurant dashboard tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'multi-restaurant-dashboard-test-secret'

    const [{ app }, { prisma }, { signAuthToken }] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js'),
      import('../lib/jwt.js'),
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

    async function createRestaurant(label: string) {
      const profileUser = await createUser(`${label} Profile`)
      const restaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: profileUser.id,
          restaurantName: `${label} ${runId}`,
          contactPerson: `${label} Contact`,
          phoneNumber: '+972501111111',
          whatsappNumber: '+972501111111',
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
    ) {
      return prisma.restaurantMember.create({
        data: {
          restaurantId,
          userId,
          phoneNumber: `test-${runId}-${restaurantId}-${userId}`,
          role,
          status: 'active',
        },
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
      userId: string,
      options: {
        method?: string
        restaurantId?: string
        body?: unknown
      } = {},
    ) {
      return readJson<T>(
        await fetch(`${baseUrl}${path}`, {
          method: options.method ?? 'GET',
          headers: authHeaders(userId, options.restaurantId),
          ...(options.body === undefined
            ? {}
            : { body: JSON.stringify(options.body) }),
        }),
      )
    }

    try {
      const restaurants = await Promise.all([
        createRestaurant('Cafe One'),
        createRestaurant('Cafe Two'),
        createRestaurant('Cafe Three'),
      ])
      const unrelatedRestaurant = await createRestaurant('Unrelated Cafe')
      const owner = await createUser('Three Restaurant Owner')
      const manager = await createUser(
        'Three Restaurant Manager',
        'restaurant',
      )
      const mixedRoleUser = await createUser('Mixed Role User')
      const singleOwner = await createUser('Single Restaurant Owner')
      const revokedManager = await createUser(
        'Revoked Manager',
        'restaurant',
      )

      for (const restaurant of restaurants) {
        await addMember(restaurant.id, owner.id, 'owner')
        await addMember(restaurant.id, manager.id, 'hiringManager')
      }
      await addMember(restaurants[0]!.id, mixedRoleUser.id, 'owner')
      await addMember(
        restaurants[1]!.id,
        mixedRoleUser.id,
        'hiringManager',
      )
      await addMember(restaurants[0]!.id, singleOwner.id, 'owner')
      const revokedMembership = await addMember(
        restaurants[2]!.id,
        revokedManager.id,
        'hiringManager',
      )

      const jobs = await Promise.all(
        restaurants.map((restaurant, index) =>
          prisma.restaurantJob.create({
            data: {
              restaurantName: restaurant.restaurantName,
              role: ['waiter', 'bartender', 'cook'][index] as
                | 'waiter'
                | 'bartender'
                | 'cook',
              location: restaurant.city,
              area: restaurant.street,
              description: `Job ${index + 1}`,
              ownerProfileId: restaurant.id,
              kind: 'posted',
              isActive: true,
            },
          }),
        ),
      )
      const unrelatedJob = await prisma.restaurantJob.create({
        data: {
          restaurantName: unrelatedRestaurant.restaurantName,
          role: 'host',
          location: unrelatedRestaurant.city,
          area: unrelatedRestaurant.street,
          ownerProfileId: unrelatedRestaurant.id,
          kind: 'posted',
          isActive: true,
        },
      })

      const leads = await Promise.all(
        restaurants.map((restaurant, index) =>
          prisma.restaurantCandidateLead.create({
            data: {
              ownerProfileId: restaurant.id,
              fullName: `QR Candidate ${index + 1}`,
              phoneNumber: `+97252000000${index}`,
              wantedRoles: [['waiter'], ['bartender'], ['cook']][
                index
              ] as Array<'waiter' | 'bartender' | 'cook'>,
              status: index === 1 ? 'relevant' : 'new',
            },
          }),
        ),
      )
      const unrelatedLead = await prisma.restaurantCandidateLead.create({
        data: {
          ownerProfileId: unrelatedRestaurant.id,
          fullName: 'Unrelated Candidate',
          phoneNumber: '+972529999999',
          wantedRoles: ['host'],
        },
      })

      const workerUsers = await Promise.all(
        restaurants.map((_, index) =>
          createUser(`Worker ${index + 1}`, 'restaurant'),
        ),
      )
      await Promise.all(
        workerUsers.map((worker, index) =>
          prisma.restaurantWorkerProfile.create({
            data: {
              userId: worker.id,
              fullName: `Worker ${index + 1}`,
              phoneNumber: `+97253000000${index}`,
              location: 'Tel Aviv',
              wantedRoles: [['waiter'], ['bartender'], ['cook']][
                index
              ] as Array<'waiter' | 'bartender' | 'cook'>,
              experienceText: `${index + 1} years`,
              availability: 'Flexible',
              age: 24 + index,
            },
          }),
        ),
      )
      const applications = await Promise.all(
        workerUsers.map((worker, index) =>
          prisma.restaurantApplication.create({
            data: {
              userId: worker.id,
              restaurantJobId: jobs[index]!.id,
            },
          }),
        ),
      )

      const missingSelection = await request<{
        code?: string
      }>('/owner/jobs', owner.id)
      assert.equal(missingSelection.status, 409)
      assert.equal(
        missingSelection.body.code,
        'restaurant_selection_required',
      )

      const singleImplicit = await request<Array<{ id: string }>>(
        '/owner/jobs',
        singleOwner.id,
      )
      assert.equal(singleImplicit.status, 200)
      assert.deepEqual(
        singleImplicit.body.map((job) => job.id),
        [jobs[0]!.id],
      )

      for (const user of [owner, manager]) {
        for (const [index, restaurant] of restaurants.entries()) {
          const selectedJobs = await request<Array<{ id: string }>>(
            '/owner/jobs',
            user.id,
            { restaurantId: restaurant.id },
          )
          assert.equal(selectedJobs.status, 200)
          assert.deepEqual(
            selectedJobs.body.map((job) => job.id),
            [jobs[index]!.id],
          )
        }
      }

      const unauthorizedSelection = await request(
        '/owner/jobs',
        owner.id,
        { restaurantId: unrelatedRestaurant.id },
      )
      assert.equal(unauthorizedSelection.status, 403)

      const firstProfile = await request<{ id: string }>(
        '/owner/profile',
        owner.id,
        { restaurantId: restaurants[0]!.id },
      )
      const secondProfile = await request<{ id: string }>(
        '/owner/profile',
        owner.id,
        { restaurantId: restaurants[1]!.id },
      )
      assert.equal(firstProfile.body.id, restaurants[0]!.id)
      assert.equal(secondProfile.body.id, restaurants[1]!.id)

      const ownerTeam = await request<{
        currentRole: string
        members: Array<{ user: { id: string } | null }>
      }>('/owner/team', mixedRoleUser.id, {
        restaurantId: restaurants[0]!.id,
      })
      assert.equal(ownerTeam.status, 200)
      assert.equal(ownerTeam.body.currentRole, 'owner')
      assert.ok(
        ownerTeam.body.members.some(
          (member) => member.user?.id === mixedRoleUser.id,
        ),
      )
      const managerTeam = await request('/owner/team', mixedRoleUser.id, {
        restaurantId: restaurants[1]!.id,
      })
      assert.equal(managerTeam.status, 403)

      const managerProfileUpdate = await request(
        '/owner/profile',
        manager.id,
        {
          method: 'PUT',
          restaurantId: restaurants[0]!.id,
          body: {
            restaurantName: 'Not allowed',
            contactPerson: '',
            phoneNumber: '',
            whatsappNumber: '',
            city: 'Tel Aviv',
            street: 'Dizengoff',
            description: '',
          },
        },
      )
      assert.equal(managerProfileUpdate.status, 403)

      const qrRoleUpdate = await request<{ qrEnabledRoles: string[] }>(
        '/owner/qr-roles',
        manager.id,
        {
          method: 'PATCH',
          restaurantId: restaurants[1]!.id,
          body: { qrEnabledRoles: ['barista'] },
        },
      )
      assert.equal(qrRoleUpdate.status, 200)
      assert.deepEqual(qrRoleUpdate.body.qrEnabledRoles, ['barista'])
      const persistedQrRoles =
        await prisma.restaurantOwnerProfile.findMany({
          where: { id: { in: restaurants.map(({ id }) => id) } },
          select: { id: true, qrEnabledRoles: true },
        })
      assert.deepEqual(
        persistedQrRoles.find(
          (restaurant) => restaurant.id === restaurants[1]!.id,
        )?.qrEnabledRoles,
        ['barista'],
      )
      assert.notDeepEqual(
        persistedQrRoles.find(
          (restaurant) => restaurant.id === restaurants[0]!.id,
        )?.qrEnabledRoles,
        ['barista'],
      )

      const selectedLeads = await request<
        Array<{
          id: string
          restaurantId: string
          restaurantName: string
        }>
      >('/owner/leads', owner.id, {
        restaurantId: restaurants[0]!.id,
      })
      assert.equal(selectedLeads.status, 200)
      assert.deepEqual(
        selectedLeads.body.map((lead) => lead.id),
        [leads[0]!.id],
      )
      assert.equal(
        selectedLeads.body[0]!.restaurantName,
        restaurants[0]!.restaurantName,
      )
      const viewedAfterSelected =
        await prisma.restaurantCandidateLead.findMany({
          where: { id: { in: leads.map(({ id }) => id) } },
          select: { id: true, ownerViewedAt: true },
        })
      assert.ok(
        viewedAfterSelected.find((lead) => lead.id === leads[0]!.id)
          ?.ownerViewedAt,
      )
      assert.equal(
        viewedAfterSelected.find((lead) => lead.id === leads[1]!.id)
          ?.ownerViewedAt,
        null,
      )

      const allLeads = await request<
        Array<{ id: string; restaurantId: string; restaurantName: string }>
      >('/owner/leads/all', owner.id)
      assert.equal(allLeads.status, 200)
      assert.deepEqual(
        new Set(allLeads.body.map((lead) => lead.id)),
        new Set(leads.map((lead) => lead.id)),
      )
      assert.ok(
        allLeads.body.every(
          (lead) =>
            lead.restaurantName ===
            restaurants.find(
              (restaurant) => restaurant.id === lead.restaurantId,
            )?.restaurantName,
        ),
      )
      assert.ok(
        !allLeads.body.some((lead) => lead.id === unrelatedLead.id),
      )

      const selectedApplications = await request<
        Array<{ id: string; restaurantId: string }>
      >('/owner/applications', owner.id, {
        restaurantId: restaurants[1]!.id,
      })
      assert.equal(selectedApplications.status, 200)
      assert.deepEqual(
        selectedApplications.body.map((application) => application.id),
        [applications[1]!.id],
      )
      const allApplications = await request<
        Array<{ id: string; restaurantId: string; restaurantName: string }>
      >('/owner/applications/all', owner.id)
      assert.equal(allApplications.status, 200)
      assert.deepEqual(
        new Set(allApplications.body.map((application) => application.id)),
        new Set(applications.map((application) => application.id)),
      )
      assert.ok(
        allApplications.body.every(
          (application) =>
            Boolean(application.restaurantId) &&
            Boolean(application.restaurantName),
        ),
      )

      const updateApplication = await request<{ status: string }>(
        `/owner/applications/${applications[2]!.id}/status`,
        owner.id,
        {
          method: 'PATCH',
          restaurantId: restaurants[2]!.id,
          body: { status: 'selected' },
        },
      )
      assert.equal(updateApplication.status, 200)
      assert.equal(updateApplication.body.status, 'selected')
      const crossRestaurantApplication = await request(
        `/owner/applications/${applications[2]!.id}/status`,
        owner.id,
        {
          method: 'PATCH',
          restaurantId: restaurants[0]!.id,
          body: { status: 'rejected' },
        },
      )
      assert.equal(crossRestaurantApplication.status, 404)

      const crossRestaurantJob = await request(
        `/owner/jobs/${jobs[0]!.id}/active`,
        owner.id,
        {
          method: 'PATCH',
          restaurantId: restaurants[1]!.id,
          body: { isActive: false },
        },
      )
      assert.equal(crossRestaurantJob.status, 404)
      const unrelatedJobMutation = await request(
        `/owner/jobs/${unrelatedJob.id}/active`,
        owner.id,
        {
          method: 'PATCH',
          restaurantId: restaurants[0]!.id,
          body: { isActive: false },
        },
      )
      assert.equal(unrelatedJobMutation.status, 404)

      const firstContact = await request<{
        status: string
        firstContactInitiatedAt: string | null
      }>(`/owner/leads/${leads[0]!.id}/status`, owner.id, {
        method: 'PATCH',
        restaurantId: restaurants[0]!.id,
        body: { status: 'new', contactChannel: 'phone' },
      })
      assert.equal(firstContact.status, 200)
      assert.equal(firstContact.body.status, 'contacted')
      assert.ok(firstContact.body.firstContactInitiatedAt)
      const originalContactTimestamp =
        firstContact.body.firstContactInitiatedAt
      const repeatedContact = await request<{
        firstContactInitiatedAt: string | null
      }>(`/owner/leads/${leads[0]!.id}/status`, owner.id, {
        method: 'PATCH',
        restaurantId: restaurants[0]!.id,
        body: { status: 'contacted', contactChannel: 'whatsapp' },
      })
      assert.equal(repeatedContact.status, 200)
      assert.equal(
        repeatedContact.body.firstContactInitiatedAt,
        originalContactTimestamp,
      )
      const relevantContact = await request<{ status: string }>(
        `/owner/leads/${leads[1]!.id}/status`,
        owner.id,
        {
          method: 'PATCH',
          restaurantId: restaurants[1]!.id,
          body: { status: 'relevant', contactChannel: 'phone' },
        },
      )
      assert.equal(relevantContact.status, 200)
      assert.equal(relevantContact.body.status, 'relevant')
      const crossRestaurantLead = await request(
        `/owner/leads/${leads[0]!.id}/status`,
        owner.id,
        {
          method: 'PATCH',
          restaurantId: restaurants[1]!.id,
          body: { status: 'rejected' },
        },
      )
      assert.equal(crossRestaurantLead.status, 404)

      const acquisition = await prisma.analyticsAcquisition.create({
        data: {
          anonymousAcquisitionId: `multi-${runId}`,
          firstSource: 'test',
          firstMedium: 'test',
          direct: false,
          firstLandingPath: '/owner/applications',
          firstTouchedAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          userId: owner.id,
        },
      })
      const candidateEvent = await request(
        '/analytics/owner-events',
        owner.id,
        {
          method: 'POST',
          restaurantId: restaurants[0]!.id,
          body: {
            clientEventId: randomUUID(),
            eventName: 'candidate_card_opened',
            occurredAt: new Date().toISOString(),
            route: '/owner/applications',
            candidateReference: {
              kind: 'externalLead',
              id: leads[0]!.id,
            },
            properties: {},
          },
        },
      )
      assert.equal(candidateEvent.status, 201)
      const mismatchedCandidateEvent = await request(
        '/analytics/owner-events',
        owner.id,
        {
          method: 'POST',
          restaurantId: restaurants[1]!.id,
          body: {
            clientEventId: randomUUID(),
            eventName: 'candidate_card_opened',
            occurredAt: new Date().toISOString(),
            route: '/owner/applications',
            candidateReference: {
              kind: 'externalLead',
              id: leads[0]!.id,
            },
            properties: {},
          },
        },
      )
      assert.equal(mismatchedCandidateEvent.status, 404)
      const unauthorizedAnalyticsTarget = await request(
        '/analytics/owner-events',
        owner.id,
        {
          method: 'POST',
          restaurantId: unrelatedRestaurant.id,
          body: {
            clientEventId: randomUUID(),
            eventName: 'recruitment_kit_opened',
            occurredAt: new Date().toISOString(),
            route: '/owner/jobs',
            properties: {},
          },
        },
      )
      assert.equal(unauthorizedAnalyticsTarget.status, 403)
      assert.ok(acquisition.id)

      await prisma.restaurantMember.update({
        where: { id: revokedMembership.id },
        data: { status: 'removed' },
      })
      const revokedAccess = await request(
        '/owner/jobs',
        revokedManager.id,
        { restaurantId: restaurants[2]!.id },
      )
      assert.equal(revokedAccess.status, 403)
      const revokedProfileFallback = await request(
        '/owner/profile',
        revokedManager.id,
      )
      assert.equal(revokedProfileFallback.status, 403)
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
