import type { RestaurantOwnerProfile } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'

export type RestaurantAccessRole = 'owner' | 'hiringManager'

export type RestaurantAccess = {
  restaurant: RestaurantOwnerProfile
  role: RestaurantAccessRole
  membershipId: string | null
  isLegacyOwner: boolean
}

export type RestaurantAccessResolution =
  | {
      status: 'resolved'
      access: RestaurantAccess
    }
  | {
      status: 'selectionRequired'
    }
  | {
      status: 'accessDenied'
    }

export async function getAccessibleRestaurantsForUser(
  userId: string,
): Promise<RestaurantAccess[]> {
  const memberships = await prisma.restaurantMember.findMany({
    where: {
      userId,
    },
    include: {
      restaurant: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })
  const accesses: RestaurantAccess[] = memberships
    .filter((membership) => membership.status === 'active')
    .map((membership) => ({
      restaurant: membership.restaurant,
      role: membership.role,
      membershipId: membership.id,
      isLegacyOwner: false,
    }))
  const restaurantIds = new Set(
    memberships.map((membership) => membership.restaurantId),
  )
  const legacyRestaurant =
    await prisma.restaurantOwnerProfile.findUnique({
      where: {
        userId,
      },
    })

  // The direct profile relation predates RestaurantMember. It remains a
  // legitimate owner access path only when no membership record has ever
  // superseded it. A removed/pending membership must not be reactivated by
  // the legacy fallback.
  if (legacyRestaurant && !restaurantIds.has(legacyRestaurant.id)) {
    accesses.push({
      restaurant: legacyRestaurant,
      role: 'owner',
      membershipId: null,
      isLegacyOwner: true,
    })
  }

  return accesses
}

export async function resolveRestaurantAccessForUser(
  userId: string,
  requestedRestaurantId?: string | null,
): Promise<RestaurantAccessResolution> {
  const accesses = await getAccessibleRestaurantsForUser(userId)
  const normalizedRestaurantId = requestedRestaurantId?.trim()

  if (normalizedRestaurantId) {
    const access = accesses.find(
      (candidate) => candidate.restaurant.id === normalizedRestaurantId,
    )

    return access
      ? { status: 'resolved', access }
      : { status: 'accessDenied' }
  }

  if (accesses.length === 1) {
    return {
      status: 'resolved',
      access: accesses[0]!,
    }
  }

  return accesses.length > 1
    ? { status: 'selectionRequired' }
    : { status: 'accessDenied' }
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
  // Stage 1 compatibility path for controllers that have not yet adopted
  // X-Restaurant-Id. Stage 2 must move the restaurant-scoped controller set
  // to resolveRestaurantAccessForUser together rather than mixing modes.
  const accesses = await getAccessibleRestaurantsForUser(userId)
  const preferredAccess =
    accesses.find((access) => access.role === 'owner') ?? accesses[0]

  if (!preferredAccess) {
    return null
  }

  if (preferredAccess.isLegacyOwner) {
    await ensureOwnerMembershipForUser(
      preferredAccess.restaurant,
      userId,
    )
  }

  return preferredAccess
}
