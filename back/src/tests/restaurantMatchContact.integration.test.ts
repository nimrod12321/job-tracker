import assert from 'node:assert/strict'
import { randomInt, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import 'dotenv/config'
import type { Express } from 'express'

const shouldRunSecurityTests = process.env.RUN_SECURITY_TESTS === 'true'

function assertSafeTestDatabaseUrl() {
  if (!shouldRunSecurityTests) return

  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim()
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (!testDatabaseUrl || !testDatabaseUrl.toLowerCase().includes('test')) {
    throw new Error('Match contact integration tests require a dedicated TEST_DATABASE_URL.')
  }

  if (testDatabaseUrl === databaseUrl) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.')
  }
}

assertSafeTestDatabaseUrl()

test(
  'Match contact is restaurant-scoped, selected-only, and resolved from active verified team membership',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run Match contact integration tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'match-contact-test-secret'

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

    const phone = () =>
      `+9725${randomInt(0, 100_000_000).toString().padStart(8, '0')}`

    async function createUser(
      track: 'restaurant' | 'restaurantOwner',
      fullName: string,
    ) {
      const user = await prisma.user.create({
        data: {
          track,
          fullName: `${fullName} ${runId}`,
          phoneNumber: phone(),
          phoneVerifiedAt: new Date(),
          registrationCompletedAt: new Date(),
        },
      })
      createdUserIds.push(user.id)
      return user
    }

    async function createWorker(fullName: string) {
      const user = await createUser('restaurant', fullName)
      await prisma.restaurantWorkerProfile.create({
        data: {
          userId: user.id,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber!,
          wantedRoles: ['waiter'],
          experienceText: '1 year',
          availability: 'Morning',
          age: 24,
        },
      })
      return user
    }

    async function get<T = unknown>(path: string, userId: string) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${signAuthToken(userId)}` },
      })
      const body = (await response.json()) as T
      return { status: response.status, body }
    }

    type MatchResponse = Array<{
      job: {
        contactPhone: string
        contactWhatsapp: string
      }
    }>

    try {
      const owner = await createUser('restaurantOwner', 'Owner')
      const manager = await createUser('restaurantOwner', 'Manager')
      const worker = await createWorker('Worker')
      const otherWorker = await createWorker('Other Worker')
      const profile = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: owner.id,
          restaurantName: `Cafe ${runId}`,
          city: 'Tel Aviv–Yafo',
          street: 'Dizengoff 1',
          slug: `match-contact-${runId}`,
          ownerMatchContactConfirmedAt: new Date(),
        },
      })
      await prisma.restaurantMember.create({
        data: {
          restaurantId: profile.id,
          userId: owner.id,
          phoneNumber: owner.phoneNumber!,
          role: 'owner',
          status: 'active',
        },
      })
      const managerMember = await prisma.restaurantMember.create({
        data: {
          restaurantId: profile.id,
          userId: manager.id,
          phoneNumber: manager.phoneNumber!,
          role: 'hiringManager',
          status: 'active',
        },
      })
      await prisma.restaurantOwnerProfile.update({
        where: { id: profile.id },
        data: { primaryHiringManagerMemberId: managerMember.id },
      })
      const job = await prisma.restaurantJob.create({
        data: {
          restaurantName: profile.restaurantName,
          role: 'waiter',
          location: profile.city,
          area: profile.street,
          contactPhone: '+972509999999',
          contactWhatsapp: '+972508888888',
          kind: 'posted',
          isActive: true,
          ownerProfileId: profile.id,
        },
      })
      await prisma.restaurantApplication.create({
        data: {
          userId: worker.id,
          restaurantJobId: job.id,
          status: 'selected',
        },
      })

      const managerMatch = await get<MatchResponse>(
        '/restaurant/matches',
        worker.id,
      )
      assert.equal(managerMatch.status, 200)
      assert.equal(managerMatch.body.length, 1)
      assert.equal(
        managerMatch.body[0]!.job.contactPhone,
        manager.phoneNumber,
      )

      const otherWorkersMatches = await get<MatchResponse>(
        '/restaurant/matches',
        otherWorker.id,
      )
      assert.equal(otherWorkersMatches.status, 200)
      assert.deepEqual(otherWorkersMatches.body, [])

      await prisma.restaurantMember.update({
        where: { id: managerMember.id },
        data: { status: 'removed' },
      })
      const ownerFallback = await get<MatchResponse>(
        '/restaurant/matches',
        worker.id,
      )
      assert.equal(ownerFallback.status, 200)
      assert.equal(
        ownerFallback.body[0]!.job.contactPhone,
        owner.phoneNumber,
      )

      await prisma.restaurantOwnerProfile.update({
        where: { id: profile.id },
        data: {
          ownerMatchContactConfirmedAt: null,
          primaryHiringManagerMemberId: null,
        },
      })
      const legacyContact = await get<MatchResponse>(
        '/restaurant/matches',
        worker.id,
      )
      assert.equal(legacyContact.status, 200)
      assert.equal(
        legacyContact.body[0]!.job.contactPhone,
        '+972509999999',
      )
      assert.equal(
        legacyContact.body[0]!.job.contactWhatsapp,
        '+972508888888',
      )

      const ownerCannotReadWorkerMatches = await get(
        '/restaurant/matches',
        owner.id,
      )
      assert.equal(ownerCannotReadWorkerMatches.status, 403)
    } finally {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      })
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
      await prisma.$disconnect()
    }
  },
)
