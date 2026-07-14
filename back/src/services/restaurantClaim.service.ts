import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'
import type { Prisma } from '../generated/prisma/client.js'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'

type ClaimDatabaseClient = Prisma.TransactionClient | typeof prisma

export type RestaurantClaimFailureCode =
  | 'ALREADY_ACTIVATED'
  | 'CLAIM_UNAVAILABLE'
  | 'RESTAURANT_NOT_FOUND'
  | 'USER_PHONE_REQUIRED'

export class RestaurantClaimError extends Error {
  constructor(
    public readonly code: RestaurantClaimFailureCode,
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'RestaurantClaimError'
  }
}

export function hashRestaurantClaimToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

// The claim id is generated with Node's cryptographically secure random UUID.
// HMAC turns that entropy into an opaque token that can be reconstructed only
// by this server. The database stores only the token hash, never the raw token.
export function deriveRestaurantClaimToken(
  claimId: string,
  restaurantOwnerProfileId: string,
) {
  return createHmac('sha256', env.jwtSecret)
    .update(`restaurant-claim:${claimId}:${restaurantOwnerProfileId}`)
    .digest('base64url')
}

export function verifyRestaurantClaimToken(
  token: string,
  tokenHash: string,
) {
  const submittedHash = Buffer.from(hashRestaurantClaimToken(token), 'hex')
  const expectedHash = Buffer.from(tokenHash, 'hex')

  return (
    submittedHash.length === expectedHash.length &&
    timingSafeEqual(submittedHash, expectedHash)
  )
}

export async function createRestaurantClaim(
  db: ClaimDatabaseClient,
  restaurantOwnerProfileId: string,
) {
  const id = randomUUID()
  const token = deriveRestaurantClaimToken(id, restaurantOwnerProfileId)

  const claim = await db.restaurantClaim.create({
    data: {
      id,
      restaurantOwnerProfileId,
      tokenHash: hashRestaurantClaimToken(token),
    },
  })

  return {
    claim,
    token,
  }
}

export async function regenerateRestaurantClaim(
  db: Prisma.TransactionClient,
  restaurantOwnerProfileId: string,
) {
  await db.restaurantClaim.deleteMany({
    where: {
      restaurantOwnerProfileId,
    },
  })

  return createRestaurantClaim(db, restaurantOwnerProfileId)
}

export function getRestaurantClaimToken(claim: {
  id: string
  restaurantOwnerProfileId: string
}) {
  return deriveRestaurantClaimToken(
    claim.id,
    claim.restaurantOwnerProfileId,
  )
}

export function isRestaurantProfileComplete(profile: {
  restaurantName: string
  slug: string | null
  city: string
  street: string
}) {
  return Boolean(
    profile.restaurantName.trim() &&
      profile.slug?.trim() &&
      (profile.city.trim() || profile.street.trim()),
  )
}

export async function completeRestaurantClaim(input: {
  restaurantSlug: string
  token: string
  userId: string
}) {
  return prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurantOwnerProfile.findUnique({
      where: {
        slug: input.restaurantSlug,
      },
      include: {
        claim: true,
        members: {
          where: {
            role: 'owner',
            status: 'active',
            userId: {
              not: null,
            },
          },
          select: {
            userId: true,
          },
        },
      },
    })

    if (!restaurant) {
      throw new RestaurantClaimError(
        'RESTAURANT_NOT_FOUND',
        404,
        'restaurant not found',
      )
    }

    const claim = restaurant.claim

    if (
      !claim ||
      !verifyRestaurantClaimToken(input.token, claim.tokenHash)
    ) {
      throw new RestaurantClaimError(
        'CLAIM_UNAVAILABLE',
        410,
        'activation link is no longer available',
      )
    }

    const existingOwner = restaurant.members[0]

    if (existingOwner) {
      if (existingOwner.userId !== input.userId) {
        throw new RestaurantClaimError(
          'ALREADY_ACTIVATED',
          409,
          'restaurant has already been activated',
        )
      }

      if (!claim.claimedAt) {
        await tx.restaurantClaim.update({
          where: {
            id: claim.id,
          },
          data: {
            claimedAt: new Date(),
          },
        })
      }

      return {
        alreadyOwned: true,
        profileComplete: isRestaurantProfileComplete(restaurant),
        restaurant: {
          id: restaurant.id,
          restaurantName: restaurant.restaurantName,
          slug: restaurant.slug,
        },
      }
    }

    if (claim.claimedAt) {
      throw new RestaurantClaimError(
        'CLAIM_UNAVAILABLE',
        410,
        'activation link is no longer available',
      )
    }

    const user = await tx.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        phoneNumber: true,
        fullName: true,
      },
    })

    if (!user?.phoneNumber) {
      throw new RestaurantClaimError(
        'USER_PHONE_REQUIRED',
        403,
        'verified phone is required to activate a restaurant',
      )
    }

    // This conditional update locks/consumes the claim row. If another user
    // wins the race, their transaction commits first and this update affects 0.
    const consumed = await tx.restaurantClaim.updateMany({
      where: {
        id: claim.id,
        claimedAt: null,
      },
      data: {
        claimedAt: new Date(),
      },
    })

    if (consumed.count !== 1) {
      throw new RestaurantClaimError(
        'CLAIM_UNAVAILABLE',
        410,
        'activation link is no longer available',
      )
    }

    const existingMembership = await tx.restaurantMember.findFirst({
      where: {
        restaurantId: restaurant.id,
        OR: [
          {
            userId: input.userId,
          },
          {
            phoneNumber: user.phoneNumber,
          },
        ],
      },
    })

    if (
      existingMembership?.userId &&
      existingMembership.userId !== input.userId
    ) {
      throw new RestaurantClaimError(
        'ALREADY_ACTIVATED',
        409,
        'restaurant has already been activated',
      )
    }

    if (existingMembership) {
      await tx.restaurantMember.update({
        where: {
          id: existingMembership.id,
        },
        data: {
          displayName:
            existingMembership.displayName ||
            restaurant.contactPerson ||
            user.fullName,
          phoneNumber: user.phoneNumber,
          role: 'owner',
          status: 'active',
          userId: input.userId,
        },
      })
    } else {
      await tx.restaurantMember.create({
        data: {
          restaurantId: restaurant.id,
          userId: input.userId,
          phoneNumber: user.phoneNumber,
          displayName: restaurant.contactPerson || user.fullName,
          role: 'owner',
          status: 'active',
        },
      })
    }

    await tx.user.update({
      where: {
        id: input.userId,
      },
      data: {
        track: 'restaurantOwner',
      },
    })

    return {
      alreadyOwned: false,
      profileComplete: isRestaurantProfileComplete(restaurant),
      restaurant: {
        id: restaurant.id,
        restaurantName: restaurant.restaurantName,
        slug: restaurant.slug,
      },
    }
  })
}
