import type {
  RestaurantOwnerProfile,
  RestaurantRole,
} from '../generated/prisma/client.js'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'
import { restaurantRoles } from '../validations/restaurant.validation.js'
import { getDefaultRestaurantJobBoardJob } from './restaurantJobTemplates.js'

type UserInsightSource = {
  phoneNumber: string | null
  restaurantWorkerProfile: {
    wantedRoles: RestaurantRole[]
  } | null
}

function normalizePhoneForComparison(phoneNumber: string | null) {
  if (!phoneNumber) return null

  try {
    return normalizeIsraeliPhoneNumber(phoneNumber)
  } catch {
    return phoneNumber.trim()
  }
}

export function isAnalyticsExcludedPhone(
  phoneNumber: string | null,
  excludedPhones: readonly string[] = env.analyticsExcludedPhones,
) {
  const normalizedPhoneNumber = normalizePhoneForComparison(phoneNumber)
  if (!normalizedPhoneNumber) return false

  return excludedPhones.some(
    (excludedPhone) =>
      normalizePhoneForComparison(excludedPhone) === normalizedPhoneNumber,
  )
}

export function buildAdminUserInsights(
  users: readonly UserInsightSource[],
  excludedPhones: readonly string[],
) {
  const includedUsers = users.filter(
    (user) => !isAnalyticsExcludedPhone(user.phoneNumber, excludedPhones),
  )
  const wantedRoleCounts = Object.fromEntries(
    restaurantRoles.map((role) => [role, 0]),
  ) as Record<RestaurantRole, number>

  for (const user of includedUsers) {
    const uniqueWantedRoles = new Set(
      user.restaurantWorkerProfile?.wantedRoles ?? [],
    )

    for (const role of uniqueWantedRoles) {
      wantedRoleCounts[role] += 1
    }
  }

  return {
    totalUsers: includedUsers.length,
    wantedRoles: restaurantRoles.map((role) => ({
      role,
      count: wantedRoleCounts[role],
    })),
  }
}

export async function getAdminUserInsights() {
  const users = await prisma.user.findMany({
    select: {
      phoneNumber: true,
      restaurantWorkerProfile: {
        select: {
          wantedRoles: true,
        },
      },
    },
  })

  return buildAdminUserInsights(users, env.analyticsExcludedPhones)
}

export async function setRestaurantJobBoardRoles(
  restaurant: Pick<
    RestaurantOwnerProfile,
    | 'id'
    | 'restaurantName'
    | 'city'
    | 'street'
    | 'phoneNumber'
    | 'whatsappNumber'
  >,
  activeRoles: readonly RestaurantRole[],
) {
  const uniqueActiveRoles = [...new Set(activeRoles)]

  return prisma.$transaction(async (tx) => {
    const existingJobs = await tx.restaurantJob.findMany({
      where: {
        ownerProfileId: restaurant.id,
      },
      select: {
        role: true,
      },
    })
    const existingRoles = new Set(existingJobs.map((job) => job.role))
    const missingRoles = uniqueActiveRoles.filter(
      (role) => !existingRoles.has(role),
    )

    if (missingRoles.length > 0) {
      await tx.restaurantJob.createMany({
        data: missingRoles.map((role) => ({
          ...getDefaultRestaurantJobBoardJob(role),
          restaurantName: restaurant.restaurantName,
          location: restaurant.city,
          area: restaurant.street,
          contactPhone: restaurant.phoneNumber,
          contactWhatsapp: restaurant.whatsappNumber,
          ownerProfileId: restaurant.id,
          kind: 'posted' as const,
          isActive: true,
        })),
        skipDuplicates: true,
      })
    }

    await tx.restaurantJob.updateMany({
      where: {
        ownerProfileId: restaurant.id,
        kind: 'posted',
      },
      data: {
        isActive: false,
      },
    })

    if (uniqueActiveRoles.length > 0) {
      await tx.restaurantJob.updateMany({
        where: {
          ownerProfileId: restaurant.id,
          role: {
            in: uniqueActiveRoles,
          },
        },
        data: {
          kind: 'posted',
          isActive: true,
          publishedFromDraftId: null,
        },
      })
    }

    return tx.restaurantJob.findMany({
      where: {
        ownerProfileId: restaurant.id,
        kind: 'posted',
      },
      include: {
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  })
}
