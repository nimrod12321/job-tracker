import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  candidateLeadStatusBodySchema,
  leadIdSchema,
} from '../validations/publicRestaurant.validation.js'

function mapAdminLead(lead: {
  id: string
  fullName: string
  phoneNumber: string
  wantedRoles: Array<'waiter' | 'bartender' | 'host' | 'floorManager' | 'cook'>
  experienceText: string
  availability: string
  age: number | null
  source: string
  status: 'new' | 'contacted' | 'relevant' | 'rejected'
  createdAt: Date
  updatedAt: Date
  ownerProfile: {
    id: string
    restaurantName: string
    city: string
    street: string
    slug: string | null
  }
}) {
  return {
    id: lead.id,
    fullName: lead.fullName,
    phoneNumber: lead.phoneNumber,
    wantedRoles: lead.wantedRoles,
    experienceText: lead.experienceText,
    availability: lead.availability,
    age: lead.age,
    source: lead.source,
    status: lead.status,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    restaurant: {
      id: lead.ownerProfile.id,
      restaurantName: lead.ownerProfile.restaurantName,
      city: lead.ownerProfile.city,
      street: lead.ownerProfile.street,
      slug: lead.ownerProfile.slug,
    },
  }
}

export async function getAdminRestaurantLeads(
  _req: Request,
  res: Response,
) {
  try {
    const leads = await prisma.restaurantCandidateLead.findMany({
      include: {
        ownerProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return res.json(leads.map(mapAdminLead))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch restaurant leads',
    })
  }
}

export async function updateAdminRestaurantLeadStatus(
  req: Request,
  res: Response,
) {
  try {
    const idResult = leadIdSchema.safeParse(req.params.id)
    const bodyResult = candidateLeadStatusBodySchema.safeParse(req.body)

    if (!idResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(idResult.error),
      })
    }

    if (!bodyResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(bodyResult.error),
      })
    }

    const lead = await prisma.restaurantCandidateLead.findUnique({
      where: {
        id: idResult.data,
      },
    })

    if (!lead) {
      return res.status(404).json({
        message: 'candidate lead not found',
      })
    }

    const updatedLead = await prisma.restaurantCandidateLead.update({
      where: {
        id: lead.id,
      },
      data: {
        status: bodyResult.data.status,
      },
      include: {
        ownerProfile: true,
      },
    })

    return res.json(mapAdminLead(updatedLead))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to update restaurant lead',
    })
  }
}
