import type {
  RestaurantOwnerProfile,
  RestaurantRole,
} from '../generated/prisma/client.js'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { restaurantRoles } from '../validations/restaurant.validation.js'
import { isAnalyticsExcludedUser } from './analyticsExclusion.service.js'
import { getDefaultRestaurantJobBoardJob } from './restaurantJobTemplates.js'

type UserInsightSource = {
  phoneNumber: string | null
  restaurantWorkerProfile: {
    phoneNumber?: string
    wantedRoles: RestaurantRole[]
  } | null
}

export function buildAdminUserInsights(
  users: readonly UserInsightSource[],
  excludedPhones: readonly string[],
) {
  const includedUsers = users.filter(
    (user) => !isAnalyticsExcludedUser(user, excludedPhones),
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
          phoneNumber: true,
          wantedRoles: true,
        },
      },
    },
  })

  return buildAdminUserInsights(users, env.analyticsExcludedPhones)
}

export async function getAdminWantedRoleUsers(role: RestaurantRole) {
  const profiles = await prisma.restaurantWorkerProfile.findMany({
    where: {
      wantedRoles: {
        has: role,
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      location: true,
      wantedRoles: true,
      experienceText: true,
      availability: true,
      age: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
        },
      },
    },
  })

  return profiles
    .filter(
      (profile) =>
        !isAnalyticsExcludedUser(
          {
            phoneNumber: profile.user.phoneNumber,
            restaurantWorkerProfile: {
              phoneNumber: profile.phoneNumber,
            },
          },
          env.analyticsExcludedPhones,
        ),
    )
    .map((profile) => ({
      userId: profile.user.id,
      profileId: profile.id,
      fullName: profile.fullName.trim() || profile.user.fullName.trim(),
      phoneNumber: profile.user.phoneNumber ?? profile.phoneNumber,
      wantedRoles: [...new Set(profile.wantedRoles)],
      experienceText: profile.experienceText,
      availability: profile.availability,
      age: profile.age,
      location: profile.location,
      profileUpdatedAt: profile.updatedAt.toISOString(),
    }))
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
