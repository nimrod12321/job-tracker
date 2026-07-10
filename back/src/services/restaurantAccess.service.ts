import type { RestaurantOwnerProfile } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'

export type RestaurantAccessRole = 'owner' | 'hiringManager'

export type RestaurantAccess = {
  restaurant: RestaurantOwnerProfile
  role: RestaurantAccessRole
  membershipId: string | null
  isLegacyOwner: boolean
}

export async function ensureOwnerMembershipForUser(
  restaurant: RestaurantOwnerProfile,
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      phoneNumber: true,
      fullName: true,
    },
  })

  if (!user?.phoneNumber) {
    return
  }

  await prisma.restaurantMember.upsert({
    where: {
      restaurantId_phoneNumber: {
        restaurantId: restaurant.id,
        phoneNumber: user.phoneNumber,
      },
    },
    update: {
      userId,
      role: 'owner',
      status: 'active',
      displayName:
        restaurant.contactPerson || user.fullName,
    },
    create: {
      restaurantId: restaurant.id,
      userId,
      phoneNumber: user.phoneNumber,
      displayName:
        restaurant.contactPerson || user.fullName,
      role: 'owner',
      status: 'active',
    },
  })
}

export async function linkPendingRestaurantMemberships(
  userId: string,
  phoneNumber: string | null,
) {
  if (!phoneNumber) {
    return
  }

  const memberships = await prisma.restaurantMember.findMany({
    where: {
      phoneNumber,
      userId: null,
      status: 'pending',
    },
  })

  for (const membership of memberships) {
    await prisma.restaurantMember.update({
      where: {
        id: membership.id,
      },
      data: {
        userId,
        status: 'active',
      },
    })
  }
}

export async function getPrimaryRestaurantMembershipRole(userId: string) {
  const memberships = await prisma.restaurantMember.findMany({
    where: {
      userId,
      status: 'active',
    },
    select: {
      role: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  if (memberships.some((membership) => membership.role === 'owner')) {
    return 'owner'
  }

  if (
    memberships.some((membership) => membership.role === 'hiringManager')
  ) {
    return 'hiringManager'
  }

  return null
}

export async function getRestaurantAccessForUser(
  userId: string,
): Promise<RestaurantAccess | null> {
  const memberships = await prisma.restaurantMember.findMany({
    where: {
      userId,
      status: 'active',
    },
    include: {
      restaurant: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })
  const preferredMembership =
    memberships.find((membership) => membership.role === 'owner') ??
    memberships[0]

  if (preferredMembership) {
    return {
      restaurant: preferredMembership.restaurant,
      role: preferredMembership.role,
      membershipId: preferredMembership.id,
      isLegacyOwner: false,
    }
  }

  const legacyRestaurant = await prisma.restaurantOwnerProfile.findUnique({
    where: {
      userId,
    },
  })

  if (!legacyRestaurant) {
    return null
  }

  await ensureOwnerMembershipForUser(legacyRestaurant, userId)

  return {
    restaurant: legacyRestaurant,
    role: 'owner',
    membershipId: null,
    isLegacyOwner: true,
  }
}
