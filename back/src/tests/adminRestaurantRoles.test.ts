import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import 'dotenv/config'
import type { Express } from 'express'
import { getDefaultRestaurantJobBoardJob } from '../services/restaurantJobTemplates.js'
import { restaurantRoles } from '../validations/restaurant.validation.js'

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
    const createdRestaurantIds: string[] = []

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
      const templateRestaurantUser = await prisma.user.create({
        data: {
          fullName: 'Template Restaurant Placeholder',
          track: 'restaurantOwner',
        },
      })
      createdUserIds.push(
        admin.id,
        nonAdmin.id,
        restaurantUser.id,
        templateRestaurantUser.id,
      )

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
      const templateRestaurant =
        await prisma.restaurantOwnerProfile.create({
          data: {
            userId: templateRestaurantUser.id,
            restaurantName: `Template Restaurant ${runId}`,
            city: 'Tel Aviv',
            street: 'Allenby',
            slug: `template-restaurant-${runId}`,
            qrEnabledRoles: ['waiter'],
          },
        })
      createdRestaurantIds.push(restaurant.id, templateRestaurant.id)
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

      const legacyWaiterJob = await prisma.restaurantJob.create({
        data: {
          ownerProfileId: restaurant.id,
          restaurantName: restaurant.restaurantName,
          role: 'waiter',
          location: restaurant.city,
          area: restaurant.street,
          kind: 'posted',
          isActive: false,
          shiftInfo:
            '3–4 shifts per week, including at least one weekend shift.',
          requirements:
            'Service mindset, responsibility, good communication. Previous restaurant experience is a plus.',
          description:
            'Join the floor team for regular restaurant service. Serve guests, work with the team, and keep service smooth and friendly.',
        },
      })
      await patchRoles(
        `/admin/restaurants/${restaurant.id}/job-board-roles`,
        { jobBoardRoles: ['waiter', 'cook'] },
      )
      const refreshedWaiterJob =
        await prisma.restaurantJob.findUniqueOrThrow({
          where: {
            id: legacyWaiterJob.id,
          },
        })
      const waiterTemplate = getDefaultRestaurantJobBoardJob('waiter')
      assert.equal(refreshedWaiterJob.description, waiterTemplate.description)
      assert.equal(refreshedWaiterJob.requirements, waiterTemplate.requirements)
      assert.equal(refreshedWaiterJob.shiftInfo, waiterTemplate.shiftInfo)

      const allRolesActivated = await patchRoles<{
        jobBoardRoles: string[]
      }>(
        `/admin/restaurants/${templateRestaurant.id}/job-board-roles`,
        { jobBoardRoles: restaurantRoles },
      )
      assert.equal(allRolesActivated.status, 200)
      assert.deepEqual(
        [...allRolesActivated.body.jobBoardRoles].sort(),
        [...restaurantRoles].sort(),
      )

      const generatedJobs = await prisma.restaurantJob.findMany({
        where: {
          ownerProfileId: templateRestaurant.id,
        },
        orderBy: {
          role: 'asc',
        },
      })
      assert.equal(generatedJobs.length, restaurantRoles.length)

      for (const job of generatedJobs) {
        const template = getDefaultRestaurantJobBoardJob(job.role)

        assert.equal(job.kind, 'posted')
        assert.equal(job.isActive, true)
        assert.equal(job.description, template.description)
        assert.equal(job.requirements, template.requirements)
        assert.equal(job.shiftInfo, template.shiftInfo)
      }

      const customHostContent = {
        description: 'תיאור מותאם שנכתב על ידי המסעדה.',
        requirements: 'פרטים מותאמים למסעדה.',
        shiftInfo: 'הפרטים יסוכמו בשיחה.',
      }
      const hostJob = generatedJobs.find((job) => job.role === 'host')
      assert.ok(hostJob)
      const templateOwnerToken = signAuthToken(templateRestaurantUser.id)
      const ownerEditResponse = await readJson<{
        description: string
        requirements: string
        shiftInfo: string
      }>(
        await fetch(`${baseUrl}/owner/jobs/${hostJob.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${templateOwnerToken}`,
            'Content-Type': 'application/json',
            'X-Restaurant-Id': templateRestaurant.id,
          },
          body: JSON.stringify({
            role: 'host',
            ...customHostContent,
            contactPhone: '',
            contactWhatsapp: '',
          }),
        }),
      )
      assert.equal(ownerEditResponse.status, 200)
      assert.equal(
        ownerEditResponse.body.description,
        customHostContent.description,
      )
      assert.equal(
        ownerEditResponse.body.requirements,
        customHostContent.requirements,
      )
      assert.equal(
        ownerEditResponse.body.shiftInfo,
        customHostContent.shiftInfo,
      )

      const rolesWithoutHost = restaurantRoles.filter(
        (role) => role !== 'host',
      )
      await patchRoles(
        `/admin/restaurants/${templateRestaurant.id}/job-board-roles`,
        { jobBoardRoles: rolesWithoutHost },
      )
      await patchRoles(
        `/admin/restaurants/${templateRestaurant.id}/job-board-roles`,
        { jobBoardRoles: restaurantRoles },
      )

      const editedHostAfterRetoggle =
        await prisma.restaurantJob.findUniqueOrThrow({
          where: {
            id: hostJob.id,
          },
        })
      assert.equal(editedHostAfterRetoggle.isActive, true)
      assert.equal(
        editedHostAfterRetoggle.description,
        customHostContent.description,
      )
      assert.equal(
        editedHostAfterRetoggle.requirements,
        customHostContent.requirements,
      )
      assert.equal(
        editedHostAfterRetoggle.shiftInfo,
        customHostContent.shiftInfo,
      )
      assert.equal(
        await prisma.restaurantJob.count({
          where: {
            ownerProfileId: templateRestaurant.id,
          },
        }),
        restaurantRoles.length,
      )

      const invalidRole = await patchRoles(
        `/admin/restaurants/${restaurant.id}/job-board-roles`,
        { jobBoardRoles: ['not-a-role'] },
      )
      assert.equal(invalidRole.status, 400)
    } finally {
      if (createdRestaurantIds.length > 0) {
        await prisma.restaurantJob.deleteMany({
          where: { ownerProfileId: { in: createdRestaurantIds } },
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
