import type { RestaurantOwnerProfile } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import { lockRestaurantMembershipState } from './restaurantTeam.service.js'

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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneNumber: true },
  })
  const memberships = await prisma.restaurantMember.findMany({
    where: {
      OR: [
        { userId },
        ...(user?.phoneNumber
          ? [{ phoneNumber: user.phoneNumber }]
          : []),
      ],
    },
    include: {
      restaurant: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })
  const accesses: RestaurantAccess[] = memberships
    .filter(
      (membership) =>
        membership.status === 'active' && membership.userId === userId,
    )
    .map((membership) => ({
      restaurant: membership.restaurant,
      role: membership.role,
      membershipId: membership.id,
      isLegacyOwner: false,
    }))
  const userMembershipRestaurantIds = new Set(
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
  const ownerMembershipSupersedesLegacy = legacyRestaurant
    ? Boolean(
        await prisma.restaurantMember.findFirst({
          where: {
            restaurantId: legacyRestaurant.id,
            role: 'owner',
          },
          select: { id: true },
        }),
      )
    : false

  if (
    legacyRestaurant &&
    !userMembershipRestaurantIds.has(legacyRestaurant.id) &&
    !ownerMembershipSupersedesLegacy
  ) {
    accesses.push({
      restaurant: legacyRestaurant,
      role: 'owner',
      membershipId: null,
      isLegacyOwner: true,
    })
  }

  return accesses
}

export async function hasExistingRestaurantAssociationForUser(
  userId: string,
) {
  const [ownedProfile, membership] = await Promise.all([
    prisma.restaurantOwnerProfile.findUnique({
      where: { userId },
      select: { id: true },
    }),
    prisma.restaurantMember.findFirst({
      where: { userId },
      select: { id: true },
    }),
  ])

  return Boolean(ownedProfile || membership)
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
  const verifiedPhoneNumber = user.phoneNumber

  await prisma.$transaction(async (tx) => {
    await lockRestaurantMembershipState(tx, restaurant.id)

    const currentProfile = await tx.restaurantOwnerProfile.findUnique({
      where: { id: restaurant.id },
      select: { userId: true },
    })

    if (currentProfile?.userId !== userId) {
      return
    }

    // Any owner membership means the legacy direct-profile relation has
    // already been superseded. Never use fallback repair to revive a removed
    // owner or overtake a pending/active replacement owner.
    const existingOwnerMembership = await tx.restaurantMember.findFirst({
      where: {
        restaurantId: restaurant.id,
        role: 'owner',
      },
      select: { id: true },
    })

    if (existingOwnerMembership) {
      return
    }

    await tx.restaurantMember.create({
      data: {
        restaurantId: restaurant.id,
        userId,
        phoneNumber: verifiedPhoneNumber,
        displayName: restaurant.contactPerson || user.fullName,
        role: 'owner',
        status: 'active',
      },
    })
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
    await prisma.$transaction(async (tx) => {
      await lockRestaurantMembershipState(tx, membership.restaurantId)

      const currentMembership = await tx.restaurantMember.findFirst({
        where: {
          id: membership.id,
          restaurantId: membership.restaurantId,
          phoneNumber,
          userId: null,
          status: 'pending',
        },
      })

      // The invitation may have been revoked or replaced while OTP was being
      // verified. Only a row that is still pending may become active.
      if (!currentMembership) {
        return
      }

      const existingUserMembership = await tx.restaurantMember.findFirst({
        where: {
          restaurantId: membership.restaurantId,
          userId,
          id: { not: membership.id },
        },
      })

      if (existingUserMembership) {
        return
      }

      if (currentMembership.role === 'owner') {
        const differentActiveOwner =
          await tx.restaurantMember.findFirst({
            where: {
              restaurantId: membership.restaurantId,
              role: 'owner',
              status: 'active',
              id: { not: membership.id },
            },
            select: { id: true },
          })

        if (differentActiveOwner) {
          await tx.restaurantMember.updateMany({
            where: {
              id: membership.id,
              status: 'pending',
              userId: null,
            },
            data: { status: 'removed' },
          })
          return
        }
      }

      await tx.restaurantMember.updateMany({
        where: {
          id: membership.id,
          phoneNumber,
          userId: null,
          status: 'pending',
        },
        data: {
          userId,
          status: 'active',
        },
      })
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
