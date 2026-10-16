import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import 'dotenv/config'
import type { Express } from 'express'

const shouldRunSecurityTests = process.env.RUN_SECURITY_TESTS === 'true'

function assertSafeTestDatabaseUrl() {
  if (!shouldRunSecurityTests) return

  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim()
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!testDatabaseUrl) {
    throw new Error(
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL for Admin role tests.',
    )
  }
  if (databaseUrl && databaseUrl === testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL.')
  }
  if (!testDatabaseUrl.toLowerCase().includes('test')) {
    throw new Error('Admin role tests require a database with test in its URL.')
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
  'Admin manages QR and Job Board roles independently and securely',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run Admin role tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'admin-restaurant-roles-test-secret'

    const runId = randomUUID()
    const adminEmail = `admin-roles-${runId}@example.test`
    process.env.ADMIN_EMAILS = adminEmail

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
    const createdUserIds: string[] = []
    let restaurantId = ''

    try {
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          fullName: 'Admin Roles Test',
        },
      })
      const nonAdmin = await prisma.user.create({
        data: {
          email: `not-admin-${runId}@example.test`,
          fullName: 'Non Admin',
        },
      })
      const restaurantUser = await prisma.user.create({
        data: {
          fullName: 'Restaurant Placeholder',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(admin.id, nonAdmin.id, restaurantUser.id)

      const restaurant = await prisma.restaurantOwnerProfile.create({
        data: {
          userId: restaurantUser.id,
          restaurantName: `Admin Roles ${runId}`,
          city: 'Tel Aviv',
          street: 'Dizengoff',
          slug: `admin-roles-${runId}`,
          qrEnabledRoles: ['waiter'],
        },
      })
      restaurantId = restaurant.id
      const untouchedDraft = await prisma.restaurantJob.create({
        data: {
          ownerProfileId: restaurant.id,
          restaurantName: restaurant.restaurantName,
          role: 'floorManager',
          location: restaurant.city,
          area: restaurant.street,
          kind: 'draft',
          isActive: true,
        },
      })

      const adminToken = signAuthToken(admin.id)
      const nonAdminToken = signAuthToken(nonAdmin.id)
      const patchRoles = async <T>(
        path: string,
        body: Record<string, unknown>,
        token = adminToken,
      ) =>
        readJson<T>(
          await fetch(`${baseUrl}${path}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          }),
        )

      const qrActivated = await patchRoles<{ qrEnabledRoles: string[] }>(
        `/admin/restaurants/${restaurant.id}/qr-roles`,
        { qrEnabledRoles: ['waiter', 'barista', 'barista'] },
      )
      assert.equal(qrActivated.status, 200)
      assert.deepEqual(qrActivated.body.qrEnabledRoles, ['waiter', 'barista'])

      const qrDeactivated = await patchRoles<{ qrEnabledRoles: string[] }>(
        `/admin/restaurants/${restaurant.id}/qr-roles`,
        { qrEnabledRoles: ['barista'] },
      )
      assert.equal(qrDeactivated.status, 200)
      assert.deepEqual(qrDeactivated.body.qrEnabledRoles, ['barista'])
      const publicRestaurant = await readJson<{ qrEnabledRoles: string[] }>(
        await fetch(`${baseUrl}/public/restaurants/${restaurant.slug}`),
      )
      assert.equal(publicRestaurant.status, 200)
      assert.deepEqual(publicRestaurant.body.qrEnabledRoles, ['barista'])

      const deniedQrUpdate = await patchRoles(
        `/admin/restaurants/${restaurant.id}/qr-roles`,
        { qrEnabledRoles: ['host'] },
        nonAdminToken,
      )
      assert.equal(deniedQrUpdate.status, 403)

      const jobBoardActivated = await patchRoles<{
        jobBoardRoles: string[]
      }>(`/admin/restaurants/${restaurant.id}/job-board-roles`, {
        jobBoardRoles: ['host', 'cook'],
      })
      assert.equal(jobBoardActivated.status, 200)
      assert.deepEqual(
        [...jobBoardActivated.body.jobBoardRoles].sort(),
        ['cook', 'host'],
      )

      const profileAfterJobBoard =
        await prisma.restaurantOwnerProfile.findUniqueOrThrow({
          where: { id: restaurant.id },
        })
      assert.deepEqual(profileAfterJobBoard.qrEnabledRoles, ['barista'])

      const jobCountBeforeRepeat = await prisma.restaurantJob.count({
        where: { ownerProfileId: restaurant.id },
      })
      const repeatedJobBoardActivation = await patchRoles<{
        jobBoardRoles: string[]
      }>(`/admin/restaurants/${restaurant.id}/job-board-roles`, {
        jobBoardRoles: ['host', 'cook', 'host'],
      })
      assert.equal(repeatedJobBoardActivation.status, 200)
      assert.equal(
        await prisma.restaurantJob.count({
          where: { ownerProfileId: restaurant.id },
        }),
        jobCountBeforeRepeat,
      )

      const jobBoardDeactivated = await patchRoles<{
        jobBoardRoles: string[]
      }>(`/admin/restaurants/${restaurant.id}/job-board-roles`, {
        jobBoardRoles: ['cook'],
      })
      assert.equal(jobBoardDeactivated.status, 200)
      assert.deepEqual(jobBoardDeactivated.body.jobBoardRoles, ['cook'])

      await patchRoles(`/admin/restaurants/${restaurant.id}/qr-roles`, {
        qrEnabledRoles: ['waiter'],
      })
      const activeJobsAfterQrUpdate = await prisma.restaurantJob.findMany({
        where: {
          ownerProfileId: restaurant.id,
          isActive: true,
        },
        select: { role: true },
      })
      assert.deepEqual(
        activeJobsAfterQrUpdate.map(({ role }) => role).sort(),
        ['cook', 'floorManager'],
      )
      const draftAfterAdminRoleUpdates =
        await prisma.restaurantJob.findUniqueOrThrow({
          where: { id: untouchedDraft.id },
        })
      assert.equal(draftAfterAdminRoleUpdates.kind, 'draft')
      assert.equal(draftAfterAdminRoleUpdates.isActive, true)

      const invalidRole = await patchRoles(
        `/admin/restaurants/${restaurant.id}/job-board-roles`,
        { jobBoardRoles: ['not-a-role'] },
      )
      assert.equal(invalidRole.status, 400)
    } finally {
      if (restaurantId) {
        await prisma.restaurantJob.deleteMany({
          where: { ownerProfileId: restaurantId },
        })
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        })
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
      await prisma.$disconnect()
    }
  },
)
