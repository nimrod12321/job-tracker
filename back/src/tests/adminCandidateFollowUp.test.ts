import assert from 'node:assert/strict'
import { randomInt, randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
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

  if (!testDatabaseUrl || !testDatabaseUrl.toLowerCase().includes('test')) {
    throw new Error(
      'Admin follow-up tests require a dedicated TEST_DATABASE_URL containing test.',
    )
  }

  if (databaseUrl && databaseUrl === testDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL for Admin follow-up tests.',
    )
  }
}

assertSafeTestDatabaseUrl()

type FollowUpListResponse = {
  items: Array<{
    key: string
    candidate: {
      source: 'qr' | 'jobBoard' | 'followUp'
      id: string
    }
    fullName: string
    phoneNumber: string
    restaurantContactState: 'recorded' | 'notRecorded' | 'notTracked'
    relatedApplications: Array<{
      source: 'qr' | 'jobBoard'
      restaurantContactState: 'recorded' | 'notRecorded' | 'notTracked'
    }>
    followUp: {
      id: string | null
      status: string
      privateNote: string
      lastAdminContactAt: string | null
      opportunityConsent: string
      opportunityConsentAt: string | null
      opportunityConsentMethod: string | null
    }
  }>
  pagination: {
    total: number
  }
  counts: {
    notContacted: number
    inProgress: number
    closed: number
    all: number
  }
}

async function readJson<T>(response: Response) {
  const text = await response.text()
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as T) : ({} as T),
  }
}

test(
  'Admin My Follow-ups is private, deduplicated, and independent from restaurant state',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run Admin follow-up tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = normalizeDatabaseUrl(
      process.env.TEST_DATABASE_URL,
    )
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'admin-follow-up-test-secret'

    const runId = randomUUID()
    const adminEmail = `follow-up-admin-${runId}@example.test`
    const excludedPhone = `+97255${randomInt(1_000_000, 9_999_999)}`
    process.env.ADMIN_EMAILS = adminEmail
    process.env.ANALYTICS_EXCLUDED_PHONES = excludedPhone

    const [{ app }, { prisma }, { signAuthToken }] = await Promise.all([
      import('../server.js') as Promise<{ app: Express }>,
      import('../lib/prisma.js'),
      import('../lib/jwt.js'),
    ])
    const createdUserIds: string[] = []
    const createdRestaurantIds: string[] = []
    const candidatePhones: string[] = []
    let server: Server | null = null

    function createPhone() {
      const phone = `+97254${randomInt(1_000_000, 9_999_999)}`
      candidatePhones.push(phone)
      return phone
    }

    try {
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          fullName: 'Follow-up Admin',
          track: 'highTech',
        },
      })
      const nonAdmin = await prisma.user.create({
        data: {
          email: `not-admin-${runId}@example.test`,
          fullName: 'Not Admin',
          track: 'highTech',
        },
      })
      const restaurantProfileUser = await prisma.user.create({
        data: {
          fullName: 'Restaurant profile user',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(admin.id, nonAdmin.id, restaurantProfileUser.id)

      const restaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: restaurantProfileUser.id,
          restaurantName: `Follow-up Restaurant ${runId}`,
          city: 'Haifa',
          street: 'Hanassi 10',
          slug: `follow-up-${runId}`,
        },
      })
      createdRestaurantIds.push(restaurant.id)

      const candidatePhone = createPhone()
      const candidate = await prisma.user.create({
        data: {
          fullName: 'One Candidate',
          phoneNumber: candidatePhone,
          phoneVerifiedAt: new Date(),
          track: 'restaurant',
          restaurantWorkerProfile: {
            create: {
              fullName: 'One Candidate',
              phoneNumber: candidatePhone,
              wantedRoles: ['waiter'],
              experienceText: 'No experience',
              availability: 'Flexible',
              age: 24,
            },
          },
        },
      })
      const jobOnlyPhone = createPhone()
      const jobOnlyCandidate = await prisma.user.create({
        data: {
          fullName: 'Job Board Only',
          phoneNumber: jobOnlyPhone,
          phoneVerifiedAt: new Date(),
          track: 'restaurant',
          restaurantWorkerProfile: {
            create: {
              fullName: 'Job Board Only',
              phoneNumber: jobOnlyPhone,
              wantedRoles: ['cook'],
              experienceText: 'One year',
              availability: 'Morning',
              age: 26,
            },
          },
        },
      })
      createdUserIds.push(candidate.id, jobOnlyCandidate.id)

      const firstJob = await prisma.restaurantJob.create({
        data: {
          ownerProfileId: restaurant.id,
          restaurantName: restaurant.restaurantName,
          role: 'waiter',
          location: restaurant.city,
          kind: 'posted',
          isActive: true,
        },
      })
      const secondJob = await prisma.restaurantJob.create({
        data: {
          ownerProfileId: restaurant.id,
          restaurantName: restaurant.restaurantName,
          role: 'cook',
          location: restaurant.city,
          kind: 'posted',
          isActive: true,
        },
      })
      const application = await prisma.restaurantApplication.create({
        data: {
          userId: candidate.id,
          restaurantJobId: firstJob.id,
        },
      })
      await prisma.restaurantApplication.create({
        data: {
          userId: candidate.id,
          restaurantJobId: secondJob.id,
        },
      })
      await prisma.restaurantApplication.create({
        data: {
          userId: jobOnlyCandidate.id,
          restaurantJobId: secondJob.id,
        },
      })
      const lead = await prisma.restaurantCandidateLead.create({
        data: {
          ownerProfileId: restaurant.id,
          fullName: 'One Candidate',
          phoneNumber: candidatePhone,
          wantedRoles: ['waiter'],
          status: 'new',
        },
      })
      await prisma.restaurantCandidateLead.create({
        data: {
          ownerProfileId: restaurant.id,
          fullName: 'Excluded Candidate',
          phoneNumber: excludedPhone,
          wantedRoles: ['host'],
          status: 'new',
        },
      })
      await prisma.restaurantCandidateLead.create({
        data: {
          ownerProfileId: restaurant.id,
          fullName: 'Already Contacted',
          phoneNumber: createPhone(),
          wantedRoles: ['barista'],
          status: 'contacted',
        },
      })

      server = createServer(app)
      await new Promise<void>((resolve) => {
        server!.listen(0, '127.0.0.1', resolve)
      })
      const address = server.address() as AddressInfo
      const baseUrl = `http://127.0.0.1:${address.port}/api`
      const adminHeaders = {
        Authorization: `Bearer ${signAuthToken(admin.id)}`,
        'Content-Type': 'application/json',
      }
      const nonAdminHeaders = {
        Authorization: `Bearer ${signAuthToken(nonAdmin.id)}`,
      }

      const forbidden = await fetch(`${baseUrl}/admin/follow-ups`, {
        headers: nonAdminHeaders,
      })
      assert.equal(forbidden.status, 403)

      const defaultList = await readJson<FollowUpListResponse>(
        await fetch(
          `${baseUrl}/admin/follow-ups?search=${encodeURIComponent(candidatePhone)}`,
          { headers: adminHeaders },
        ),
      )
      assert.equal(defaultList.status, 200)
      assert.equal(defaultList.body.pagination.total, 1)
      assert.equal(defaultList.body.counts.notContacted, 1)
      assert.equal(defaultList.body.counts.inProgress, 0)
      assert.equal(defaultList.body.items[0]?.phoneNumber, candidatePhone)
      assert.equal(
        defaultList.body.items[0]?.relatedApplications.length,
        3,
        'QR and multiple Job Board applications must produce one candidate row',
      )
      assert.equal(
        defaultList.body.items[0]?.restaurantContactState,
        'notRecorded',
      )
      assert.ok(
        defaultList.body.items[0]?.relatedApplications.some(
          (related) =>
            related.source === 'jobBoard' &&
            related.restaurantContactState === 'notTracked',
        ),
      )

      const unknownContactDefault = await readJson<FollowUpListResponse>(
        await fetch(
          `${baseUrl}/admin/follow-ups?search=${encodeURIComponent(jobOnlyPhone)}`,
          { headers: adminHeaders },
        ),
      )
      assert.equal(unknownContactDefault.status, 200)
      assert.equal(
        unknownContactDefault.body.pagination.total,
        0,
        'Job Board applied status must not imply no restaurant contact',
      )

      const allList = await readJson<FollowUpListResponse>(
        await fetch(
          `${baseUrl}/admin/follow-ups?filter=all&search=${encodeURIComponent(jobOnlyPhone)}`,
          { headers: adminHeaders },
        ),
      )
      assert.equal(allList.status, 200)
      assert.ok(
        allList.body.items.some(
          (item) =>
            item.phoneNumber === jobOnlyPhone &&
            item.restaurantContactState === 'notTracked',
          ),
      )
      const jobOnlyReference = allList.body.items[0]!.candidate
      const trackedUnknownContact = await fetch(
        `${baseUrl}/admin/follow-ups`,
        {
          method: 'PATCH',
          headers: adminHeaders,
          body: JSON.stringify({
            candidate: jobOnlyReference,
            privateNote: 'Job Board contact state is still unknown.',
          }),
        },
      )
      assert.equal(trackedUnknownContact.status, 200)
      const trackedUnknownDefault = await readJson<FollowUpListResponse>(
        await fetch(
          `${baseUrl}/admin/follow-ups?search=${encodeURIComponent(jobOnlyPhone)}`,
          { headers: adminHeaders },
        ),
      )
      assert.equal(trackedUnknownDefault.status, 200)
      assert.equal(
        trackedUnknownDefault.body.pagination.total,
        0,
        'tracking a Job Board candidate must not invent restaurant non-contact',
      )
      const excludedList = await readJson<FollowUpListResponse>(
        await fetch(
          `${baseUrl}/admin/follow-ups?filter=all&search=${encodeURIComponent(excludedPhone)}`,
          { headers: adminHeaders },
        ),
      )
      assert.equal(excludedList.body.pagination.total, 0)

      const candidateReference = defaultList.body.items[0]!.candidate
      const noteUpdate = await readJson<{
        status: string
        privateNote: string
        lastAdminContactAt: string | null
        opportunityConsent: string
        opportunityConsentAt: string | null
      }>(
        await fetch(`${baseUrl}/admin/follow-ups`, {
          method: 'PATCH',
          headers: adminHeaders,
          body: JSON.stringify({
            candidate: candidateReference,
            status: 'notContacted',
            privateNote: 'Available for evening shifts in Haifa.',
            opportunityConsent: 'yes',
            opportunityConsentMethod: 'phone',
          }),
        }),
      )
      assert.equal(noteUpdate.status, 200)
      assert.equal(noteUpdate.body.status, 'notContacted')
      assert.equal(
        noteUpdate.body.privateNote,
        'Available for evening shifts in Haifa.',
      )
      assert.equal(noteUpdate.body.lastAdminContactAt, null)
      assert.equal(noteUpdate.body.opportunityConsent, 'yes')
      assert.ok(noteUpdate.body.opportunityConsentAt)

      const persisted = await readJson<FollowUpListResponse>(
        await fetch(
          `${baseUrl}/admin/follow-ups?filter=notContacted&search=${encodeURIComponent(candidatePhone)}`,
          { headers: adminHeaders },
        ),
      )
      assert.equal(persisted.status, 200)
      assert.equal(persisted.body.items.length, 1)
      assert.equal(
        persisted.body.items[0]?.followUp.privateNote,
        'Available for evening shifts in Haifa.',
      )

      const contactUpdate = await readJson<{
        status: string
        lastAdminContactAt: string | null
      }>(
        await fetch(`${baseUrl}/admin/follow-ups`, {
          method: 'PATCH',
          headers: adminHeaders,
          body: JSON.stringify({
            candidate: candidateReference,
            status: 'contacted',
            privateNote: 'Reached by phone.',
          }),
        }),
      )
      assert.equal(contactUpdate.status, 200)
      assert.equal(contactUpdate.body.status, 'contacted')
      assert.ok(contactUpdate.body.lastAdminContactAt)
      const firstAdminContactAt = contactUpdate.body.lastAdminContactAt

      const unrelatedSave = await readJson<{
        status: string
        lastAdminContactAt: string | null
      }>(
        await fetch(`${baseUrl}/admin/follow-ups`, {
          method: 'PATCH',
          headers: adminHeaders,
          body: JSON.stringify({
            candidate: candidateReference,
            status: 'contacted',
            privateNote: 'Updated note only.',
          }),
        }),
      )
      assert.equal(unrelatedSave.status, 200)
      assert.equal(unrelatedSave.body.lastAdminContactAt, firstAdminContactAt)

      const leadAfterAdminSaves =
        await prisma.restaurantCandidateLead.findUniqueOrThrow({
          where: { id: lead.id },
        })
      assert.equal(leadAfterAdminSaves.status, 'new')
      assert.equal(leadAfterAdminSaves.firstContactInitiatedAt, null)

      await prisma.restaurantCandidateLead.update({
        where: { id: lead.id },
        data: { firstContactInitiatedAt: new Date() },
      })
      const trackedAfterRestaurantContact =
        await readJson<FollowUpListResponse>(
          await fetch(
            `${baseUrl}/admin/follow-ups?filter=inProgress&search=${encodeURIComponent(candidatePhone)}`,
            { headers: adminHeaders },
          ),
        )
      assert.equal(trackedAfterRestaurantContact.status, 200)
      assert.equal(trackedAfterRestaurantContact.body.items.length, 1)
      assert.equal(
        trackedAfterRestaurantContact.body.items[0]?.restaurantContactState,
        'recorded',
      )
      assert.equal(trackedAfterRestaurantContact.body.counts.inProgress, 1)

      const closeUpdate = await readJson<{ status: string }>(
        await fetch(`${baseUrl}/admin/follow-ups`, {
          method: 'PATCH',
          headers: adminHeaders,
          body: JSON.stringify({
            candidate: candidateReference,
            status: 'foundJobElsewhere',
          }),
        }),
      )
      assert.equal(closeUpdate.status, 200)
      const closedList = await readJson<FollowUpListResponse>(
        await fetch(
          `${baseUrl}/admin/follow-ups?filter=closed&search=${encodeURIComponent(candidatePhone)}`,
          { headers: adminHeaders },
        ),
      )
      assert.equal(closedList.status, 200)
      assert.equal(closedList.body.items.length, 1)
      assert.equal(closedList.body.counts.closed, 1)

      const unchangedLead =
        await prisma.restaurantCandidateLead.findUniqueOrThrow({
          where: { id: lead.id },
        })
      const unchangedApplication =
        await prisma.restaurantApplication.findUniqueOrThrow({
          where: { id: application.id },
        })
      assert.equal(unchangedLead.status, 'new')
      assert.ok(unchangedLead.firstContactInitiatedAt)
      assert.equal(unchangedApplication.status, 'applied')
    } finally {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => (error ? reject(error) : resolve()))
        })
      }

      await prisma.adminCandidateFollowUp.deleteMany({
        where: { candidatePhone: { in: candidatePhones } },
      })
      await prisma.restaurantApplication.deleteMany({
        where: { userId: { in: createdUserIds } },
      })
      await prisma.restaurantCandidateLead.deleteMany({
        where: {
          OR: [
            { phoneNumber: { in: candidatePhones } },
            { phoneNumber: excludedPhone },
          ],
        },
      })
      await prisma.restaurantJob.deleteMany({
        where: { ownerProfileId: { in: createdRestaurantIds } },
      })
      await prisma.restaurantOwnerProfile.deleteMany({
        where: { id: { in: createdRestaurantIds } },
      })
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      })
      await prisma.$disconnect()
    }
  },
)
