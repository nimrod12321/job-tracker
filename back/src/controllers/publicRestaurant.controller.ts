import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { normalizePhoneNumber } from '../utils/phone.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  publicRestaurantLeadSchema,
  restaurantSlugSchema,
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
  try {
    const slugResult = restaurantSlugSchema.safeParse(req.params.slug)
    const bodyResult = publicRestaurantLeadSchema.safeParse(req.body)

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

    const profile = await prisma.restaurantOwnerProfile.findUnique({
      where: {
        slug: slugResult.data,
      },
      select: {
        id: true,
      },
    })

    if (!profile) {
      return res.status(404).json({
        message: 'restaurant not found',
      })
    }

    const normalizedPhoneNumber = normalizePhoneNumber(
      bodyResult.data.phoneNumber,
    )
    const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_MS)
    const existingLead = await prisma.restaurantCandidateLead.findFirst({
      where: {
        ownerProfileId: profile.id,
        phoneNumber: normalizedPhoneNumber,
        createdAt: {
          gte: duplicateSince,
        },
      },
      select: {
        id: true,
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
        fullName: bodyResult.data.fullName,
        phoneNumber: normalizedPhoneNumber,
        wantedRoles: bodyResult.data.wantedRoles,
        experienceText: bodyResult.data.experienceText,
        availability: bodyResult.data.availability,
        age: bodyResult.data.age ?? null,
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
