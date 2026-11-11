import type {
  Prisma,
  RestaurantMember,
} from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'

type RestaurantTeamTransaction = Prisma.TransactionClient

export type RestaurantTeamFailureCode =
  | 'RESTAURANT_NOT_FOUND'
  | 'MEMBER_NOT_FOUND'
  | 'OWNER_STATE_CONFLICT'
  | 'MEMBERSHIP_CONFLICT'
  | 'OWNER_ROLE_PROTECTED'
  | 'HIRING_MANAGER_REQUIRED'
  | 'INVALID_PHONE'

export class RestaurantTeamError extends Error {
  constructor(
    public readonly code: RestaurantTeamFailureCode,
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'RestaurantTeamError'
  }
}

export async function lockRestaurantMembershipState(
  tx: RestaurantTeamTransaction,
  restaurantId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "RestaurantOwnerProfile"
    WHERE "id" = ${restaurantId}
    FOR UPDATE
  `

  if (rows.length === 0) {
    throw new RestaurantTeamError(
      'RESTAURANT_NOT_FOUND',
      404,
      'restaurant not found',
    )
  }
}

function normalizeTeamPhone(phoneNumber: string) {
  try {
    return normalizeIsraeliPhoneNumber(phoneNumber)
  } catch {
    throw new RestaurantTeamError(
      'INVALID_PHONE',
      400,
      'phone number is invalid',
    )
  }
}

async function findMembershipIdentity(
  tx: RestaurantTeamTransaction,
  input: {
    restaurantId: string
    phoneNumber: string
    userId?: string
  },
) {
  const [byPhone, byUser] = await Promise.all([
    tx.restaurantMember.findUnique({
      where: {
        restaurantId_phoneNumber: {
          restaurantId: input.restaurantId,
          phoneNumber: input.phoneNumber,
        },
      },
    }),
    input.userId
      ? tx.restaurantMember.findUnique({
          where: {
            restaurantId_userId: {
              restaurantId: input.restaurantId,
              userId: input.userId,
            },
          },
        })
      : null,
  ])

  if (byPhone && byUser && byPhone.id !== byUser.id) {
    throw new RestaurantTeamError(
      'MEMBERSHIP_CONFLICT',
      409,
      'phone and user are already connected through different memberships',
    )
  }

  return byPhone ?? byUser
}

export async function getRestaurantTeam(restaurantId: string) {
  const restaurant = await prisma.restaurantOwnerProfile.findUnique({
    where: { id: restaurantId },
    select: { id: true },
  })

  if (!restaurant) {
    throw new RestaurantTeamError(
      'RESTAURANT_NOT_FOUND',
      404,
      'restaurant not found',
    )
  }

  return prisma.restaurantMember.findMany({
    where: {
      restaurantId,
      status: { not: 'removed' },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
        },
      },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function addRestaurantHiringManager(input: {
  restaurantId: string
  phoneNumber: string
  displayName?: string
  invitedByUserId: string
}) {
  const phoneNumber = normalizeTeamPhone(input.phoneNumber)

  return prisma.$transaction(async (tx) => {
    await lockRestaurantMembershipState(tx, input.restaurantId)

    const user = await tx.user.findUnique({
      where: { phoneNumber },
      select: {
        id: true,
        fullName: true,
      },
    })
    const existingMember = await findMembershipIdentity(tx, {
      restaurantId: input.restaurantId,
      phoneNumber,
      ...(user ? { userId: user.id } : {}),
    })

    if (existingMember?.role === 'owner') {
      throw new RestaurantTeamError(
        'OWNER_ROLE_PROTECTED',
        409,
        'owner membership cannot be changed to hiring manager',
      )
    }

    const data = {
      phoneNumber,
      userId: user?.id ?? null,
      displayName:
        input.displayName?.trim() || user?.fullName || '',
      role: 'hiringManager' as const,
      status: user ? ('active' as const) : ('pending' as const),
      invitedByUserId: input.invitedByUserId,
    }

    if (existingMember) {
      return {
        created: false,
        member: await tx.restaurantMember.update({
          where: { id: existingMember.id },
          data,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                phoneNumber: true,
              },
            },
          },
        }),
      }
    }

    return {
      created: true,
      member: await tx.restaurantMember.create({
        data: {
          restaurantId: input.restaurantId,
          ...data,
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
            },
          },
        },
      }),
    }
  })
}

export async function removeRestaurantHiringManager(input: {
  restaurantId: string
  memberId: string
}) {
  return prisma.$transaction(async (tx) => {
    await lockRestaurantMembershipState(tx, input.restaurantId)

    const member = await tx.restaurantMember.findFirst({
      where: {
        id: input.memberId,
        restaurantId: input.restaurantId,
      },
    })

    if (!member) {
      throw new RestaurantTeamError(
        'MEMBER_NOT_FOUND',
        404,
        'team member not found',
      )
    }

    if (member.role !== 'hiringManager') {
      throw new RestaurantTeamError(
        'HIRING_MANAGER_REQUIRED',
        409,
        'only hiring manager memberships can be removed here',
      )
    }

    if (member.status === 'removed') {
      return member
    }

    // Keep the linked user as a revocation tombstone. Access resolution checks
    // status on every request, and pending activation cannot revive this row.
    return tx.restaurantMember.update({
      where: { id: member.id },
      data: { status: 'removed' },
    })
  })
}

export async function replaceRestaurantOwner(input: {
  restaurantId: string
  selectedOwnerMemberId: string
  phoneNumber: string
  displayName?: string
  changedByUserId: string
}) {
  const phoneNumber = normalizeTeamPhone(input.phoneNumber)

  return prisma.$transaction(async (tx) => {
    await lockRestaurantMembershipState(tx, input.restaurantId)

    const ownerMemberships = await tx.restaurantMember.findMany({
      where: {
        restaurantId: input.restaurantId,
        role: 'owner',
        status: { not: 'removed' },
      },
      orderBy: { createdAt: 'asc' },
    })
    const selectedOwner = ownerMemberships.find(
      (member) => member.id === input.selectedOwnerMemberId,
    )

    if (!selectedOwner) {
      throw new RestaurantTeamError(
        'MEMBER_NOT_FOUND',
        404,
        'selected owner membership not found',
      )
    }

    if (ownerMemberships.length !== 1) {
      throw new RestaurantTeamError(
        'OWNER_STATE_CONFLICT',
        409,
        'restaurant ownership state is ambiguous',
      )
    }

    const replacementUser = await tx.user.findUnique({
      where: { phoneNumber },
      select: {
        id: true,
        fullName: true,
      },
    })
    const replacementMembership = await findMembershipIdentity(tx, {
      restaurantId: input.restaurantId,
      phoneNumber,
      ...(replacementUser ? { userId: replacementUser.id } : {}),
    })

    if (
      replacementMembership?.role === 'owner' &&
      replacementMembership.id !== selectedOwner.id &&
      replacementMembership.status !== 'removed'
    ) {
      throw new RestaurantTeamError(
        'OWNER_STATE_CONFLICT',
        409,
        'replacement phone is already connected to another owner membership',
      )
    }

    const displayName =
      input.displayName?.trim() || replacementUser?.fullName || ''
    let replacement: RestaurantMember

    if (replacementMembership?.id === selectedOwner.id) {
      replacement = await tx.restaurantMember.update({
        where: { id: selectedOwner.id },
        data: {
          phoneNumber,
          userId: replacementUser?.id ?? null,
          displayName: displayName || selectedOwner.displayName,
          role: 'owner',
          status: replacementUser ? 'active' : 'pending',
          invitedByUserId: input.changedByUserId,
        },
      })
    } else if (
      replacementUser &&
      selectedOwner.userId === replacementUser.id &&
      !replacementMembership
    ) {
      // The same verified owner changed phone number. Updating the existing row
      // preserves the unique restaurant/user membership and its audit history.
      replacement = await tx.restaurantMember.update({
        where: { id: selectedOwner.id },
        data: {
          phoneNumber,
          displayName: displayName || selectedOwner.displayName,
          status: 'active',
          invitedByUserId: input.changedByUserId,
        },
      })
    } else {
      // Preserve userId on the removed owner row. It is a deliberate tombstone
      // that prevents the legacy RestaurantOwnerProfile.userId fallback from
      // restoring access to the old owner.
      await tx.restaurantMember.update({
        where: { id: selectedOwner.id },
        data: { status: 'removed' },
      })

      if (replacementMembership) {
        replacement = await tx.restaurantMember.update({
          where: { id: replacementMembership.id },
          data: {
            phoneNumber,
            userId: replacementUser?.id ?? null,
            displayName:
              displayName || replacementMembership.displayName,
            role: 'owner',
            status: replacementUser ? 'active' : 'pending',
            invitedByUserId: input.changedByUserId,
          },
        })
      } else {
        replacement = await tx.restaurantMember.create({
          data: {
            restaurantId: input.restaurantId,
            phoneNumber,
            userId: replacementUser?.id ?? null,
            displayName,
            role: 'owner',
            status: replacementUser ? 'active' : 'pending',
            invitedByUserId: input.changedByUserId,
          },
        })
      }
    }

    const activeOwnerCount = await tx.restaurantMember.count({
      where: {
        restaurantId: input.restaurantId,
        role: 'owner',
        status: 'active',
      },
    })

    if (activeOwnerCount > 1) {
      throw new RestaurantTeamError(
        'OWNER_STATE_CONFLICT',
        409,
        'restaurant would have more than one active owner',
      )
    }

    // A replacement owner activates through the phone membership, not a stale
    // first-owner claim link. Consuming it closes a concurrent claim path.
    await tx.restaurantClaim.updateMany({
      where: {
        restaurantOwnerProfileId: input.restaurantId,
        claimedAt: null,
      },
      data: { claimedAt: new Date() },
    })

    return tx.restaurantMember.findUniqueOrThrow({
      where: { id: replacement.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
      },
    })
  })
}
