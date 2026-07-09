import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  restaurantSlugSchema,
  verifiedPublicRestaurantLeadSchema,
} from '../validations/publicRestaurant.validation.js'

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000

function mapPublicRestaurant(
  profile: {
    restaurantName: string
    city: string
    street: string
    description: string
    slug: string | null
  },
) {
  return {
    restaurantName: profile.restaurantName,
    city: profile.city,
    street: profile.street,
    description: profile.description,
    slug: profile.slug,
  }
}

export async function getPublicRestaurant(req: Request, res: Response) {
  try {
    const slugResult = restaurantSlugSchema.safeParse(req.params.slug)

    if (!slugResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(slugResult.error),
      })
    }

    const profile = await prisma.restaurantOwnerProfile.findUnique({
      where: {
        slug: slugResult.data,
      },
      select: {
        restaurantName: true,
        city: true,
        street: true,
        description: true,
        slug: true,
      },
    })

    if (!profile) {
      return res.status(404).json({
        message: 'restaurant not found',
      })
    }

    return res.json(mapPublicRestaurant(profile))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch restaurant',
    })
  }
}

export async function createPublicRestaurantLead(
  req: Request,
  res: Response,
) {
  return res.status(410).json({
    message: 'Phone verification is required before applying.',
  })
}

export async function createVerifiedPublicRestaurantLead(
  req: Request,
  res: Response,
) {
  try {
    const userId = (req as AuthenticatedRequest).userId
    const slugResult = restaurantSlugSchema.safeParse(req.params.slug)
    const bodyResult = verifiedPublicRestaurantLeadSchema.safeParse(req.body)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    if (!slugResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(slugResult.error),
      })
    }

    if (!bodyResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(bodyResult.error),
      })
    }

    const [profile, user] = await Promise.all([
      prisma.restaurantOwnerProfile.findUnique({
        where: {
          slug: slugResult.data,
        },
        select: {
          id: true,
        },
      }),
      prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          fullName: true,
          phoneNumber: true,
          track: true,
        },
      }),
    ])

    if (!profile) {
      return res.status(404).json({
        message: 'restaurant not found',
      })
    }

    if (!user?.phoneNumber || user.track !== 'restaurant') {
      return res.status(403).json({
        message: 'verified restaurant worker account required',
      })
    }

    const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_MS)
    const existingLead = await prisma.restaurantCandidateLead.findFirst({
      where: {
        ownerProfileId: profile.id,
        phoneNumber: user.phoneNumber,
        createdAt: {
          gte: duplicateSince,
        },
      },
      select: {
        id: true,
      },
    })

    await prisma.restaurantWorkerProfile.upsert({
      where: {
        userId,
      },
      update: {
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        wantedRoles: bodyResult.data.wantedRoles,
        experienceText: bodyResult.data.experienceText,
        availability: bodyResult.data.availability,
        age: bodyResult.data.age,
      },
      create: {
        userId,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        wantedRoles: bodyResult.data.wantedRoles,
        experienceText: bodyResult.data.experienceText,
        availability: bodyResult.data.availability,
        age: bodyResult.data.age,
      },
    })

    if (existingLead) {
      return res.json({
        ok: true,
        message: 'application already received',
      })
    }

    await prisma.restaurantCandidateLead.create({
      data: {
        ownerProfileId: profile.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        wantedRoles: bodyResult.data.wantedRoles,
        experienceText: bodyResult.data.experienceText,
        availability: bodyResult.data.availability,
        age: bodyResult.data.age,
        source: 'qr',
      },
    })

    return res.status(201).json({
      ok: true,
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to submit application',
    })
  }
}
