import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { prisma } from '../lib/prisma.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  adminRestaurantCreateSchema,
  adminRestaurantIdSchema,
  adminRestaurantUpdateSchema,
} from '../validations/admin.validation.js'
import {
  candidateLeadStatusBodySchema,
  leadIdSchema,
} from '../validations/publicRestaurant.validation.js'

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'restaurant'
}

async function generateUniqueRestaurantSlug(
  value: string,
  excludeRestaurantId?: string,
) {
  const baseSlug = slugify(value)
  let candidateSlug = baseSlug
  let suffix = 2

  while (
    await prisma.restaurantOwnerProfile.findFirst({
      where: {
        slug: candidateSlug,
        ...(excludeRestaurantId
          ? {
              id: {
                not: excludeRestaurantId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    })
  ) {
    candidateSlug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return candidateSlug
}

function mapAdminRestaurantSummary(restaurant: {
  id: string
  restaurantName: string
  contactPerson: string
  phoneNumber: string
  whatsappNumber: string
  city: string
  street: string
  description: string
  slug: string | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    email: string | null
    phoneNumber: string | null
    fullName: string
  }
  _count: {
    leads: number
  }
  leads?: Array<{
    createdAt: Date
  }>
  adminReadStates?: Array<{
    lastViewedCandidatesAt: Date
  }>
  jobs?: Array<{
    isActive: boolean
    kind: 'draft' | 'posted'
    _count?: {
      applications: number
    }
    applications?: Array<{
      createdAt: Date
    }>
  }>
}) {
  const activeJobsCount =
    restaurant.jobs?.filter((job) => job.kind === 'posted' && job.isActive)
      .length ?? 0
  const applicationsCount =
    restaurant.jobs?.reduce(
      (total, job) => total + (job._count?.applications ?? 0),
      0,
    ) ?? 0
  const lastViewedCandidatesAt =
    restaurant.adminReadStates?.[0]?.lastViewedCandidatesAt ?? null
  const candidateActivityDates = [
    ...(restaurant.leads?.map((lead) => lead.createdAt) ?? []),
    ...(restaurant.jobs?.flatMap((job) =>
      job.applications?.map((application) => application.createdAt) ?? [],
    ) ?? []),
  ]
  const newCandidateCount = lastViewedCandidatesAt
    ? candidateActivityDates.filter(
        (createdAt) => createdAt > lastViewedCandidatesAt,
      ).length
    : candidateActivityDates.length
  const ownerUser =
    restaurant.user.email ||
    restaurant.user.phoneNumber ||
    restaurant.user.fullName
      ? {
          id: restaurant.user.id,
          email: restaurant.user.email,
          phoneNumber: restaurant.user.phoneNumber,
          fullName: restaurant.user.fullName,
        }
      : null

  return {
    id: restaurant.id,
    restaurantName: restaurant.restaurantName,
    contactPerson: restaurant.contactPerson,
    phoneNumber: restaurant.phoneNumber,
    whatsappNumber: restaurant.whatsappNumber,
    city: restaurant.city,
    street: restaurant.street,
    description: restaurant.description,
    slug: restaurant.slug,
    ownerUser,
    activeJobsCount,
    qrLeadsCount: restaurant._count.leads,
    applicationsCount,
    hasNewCandidate: newCandidateCount > 0,
    newCandidateCount,
    createdAt: restaurant.createdAt.toISOString(),
    updatedAt: restaurant.updatedAt.toISOString(),
  }
}

function getAdminUserId(req: Request) {
  return (req as AuthenticatedRequest).userId ?? null
}

function mapAdminRestaurantJob(job: {
  id: string
  restaurantName: string
  role: 'waiter' | 'bartender' | 'host' | 'floorManager' | 'cook'
  location: string
  area: string
  description: string
  requirements: string
  shiftInfo: string
  kind: 'draft' | 'posted'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  _count: {
    applications: number
  }
}) {
  return {
    id: job.id,
    restaurantName: job.restaurantName,
    role: job.role,
    city: job.location,
    street: job.area,
    description: job.description,
    requirements: job.requirements,
    shiftInfo: job.shiftInfo,
    kind: job.kind,
    isActive: job.isActive,
    applicationsCount: job._count.applications,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  }
}

function mapAdminRestaurantApplication(application: {
  id: string
  status: 'applied' | 'selected' | 'rejected'
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    fullName: string
    phoneNumber: string | null
    restaurantWorkerProfile: {
      fullName: string
      phoneNumber: string
    } | null
  }
  restaurantJob: {
    id: string
    role: 'waiter' | 'bartender' | 'host' | 'floorManager' | 'cook'
    restaurantName: string
  }
}) {
  return {
    id: application.id,
    status: application.status,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    worker: {
      id: application.user.id,
      fullName:
        application.user.restaurantWorkerProfile?.fullName ||
        application.user.fullName,
      phoneNumber:
        application.user.restaurantWorkerProfile?.phoneNumber ||
        application.user.phoneNumber ||
        '',
    },
    job: {
      id: application.restaurantJob.id,
      role: application.restaurantJob.role,
      restaurantName: application.restaurantJob.restaurantName,
    },
  }
}

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

export async function getAdminRestaurants(req: Request, res: Response) {
  try {
    const adminUserId = getAdminUserId(req)

    if (!adminUserId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const restaurants = await prisma.restaurantOwnerProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            fullName: true,
          },
        },
        jobs: {
          select: {
            isActive: true,
            kind: true,
            applications: {
              select: {
                createdAt: true,
              },
            },
            _count: {
              select: {
                applications: true,
              },
            },
          },
        },
        leads: {
          select: {
            createdAt: true,
          },
        },
        adminReadStates: {
          where: {
            adminUserId,
          },
          select: {
            lastViewedCandidatesAt: true,
          },
        },
        _count: {
          select: {
            leads: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return res.json(restaurants.map(mapAdminRestaurantSummary))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch restaurants',
    })
  }
}

export async function createAdminRestaurant(req: Request, res: Response) {
  try {
    const adminUserId = getAdminUserId(req)

    if (!adminUserId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const result = adminRestaurantCreateSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const slug = await generateUniqueRestaurantSlug(
      result.data.slug || result.data.restaurantName,
    )

    const restaurant = await prisma.$transaction(async (tx) => {
      const placeholderUser = await tx.user.create({
        data: {
          track: 'restaurantOwner',
          fullName: result.data.contactPerson,
        },
      })

      return tx.restaurantOwnerProfile.create({
        data: {
          ...result.data,
          slug,
          userId: placeholderUser.id,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phoneNumber: true,
              fullName: true,
            },
          },
          jobs: {
            select: {
              isActive: true,
              kind: true,
              applications: {
                select: {
                  createdAt: true,
                },
              },
              _count: {
                select: {
                  applications: true,
                },
              },
            },
          },
          leads: {
            select: {
              createdAt: true,
            },
          },
          adminReadStates: {
            where: {
              adminUserId,
            },
            select: {
              lastViewedCandidatesAt: true,
            },
          },
          _count: {
            select: {
              leads: true,
            },
          },
        },
      })
    })

    return res.status(201).json(mapAdminRestaurantSummary(restaurant))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to create restaurant',
    })
  }
}

export async function getAdminRestaurantDetail(req: Request, res: Response) {
  try {
    const adminUserId = getAdminUserId(req)

    if (!adminUserId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const idResult = adminRestaurantIdSchema.safeParse(req.params.id)

    if (!idResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(idResult.error),
      })
    }

    const restaurant = await prisma.restaurantOwnerProfile.findUnique({
      where: {
        id: idResult.data,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            fullName: true,
          },
        },
        jobs: {
          where: {
            kind: 'posted',
          },
          include: {
            applications: {
              select: {
                createdAt: true,
              },
            },
            _count: {
              select: {
                applications: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        leads: {
          include: {
            ownerProfile: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            leads: true,
          },
        },
        adminReadStates: {
          where: {
            adminUserId,
          },
          select: {
            lastViewedCandidatesAt: true,
          },
        },
      },
    })

    if (!restaurant) {
      return res.status(404).json({
        message: 'restaurant not found',
      })
    }

    const applications = await prisma.restaurantApplication.findMany({
      where: {
        restaurantJob: {
          ownerProfileId: restaurant.id,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            restaurantWorkerProfile: {
              select: {
                fullName: true,
                phoneNumber: true,
              },
            },
          },
        },
        restaurantJob: {
          select: {
            id: true,
            role: true,
            restaurantName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return res.json({
      restaurant: mapAdminRestaurantSummary(restaurant),
      ownerUser:
        restaurant.user.email ||
        restaurant.user.phoneNumber ||
        restaurant.user.fullName
          ? {
              id: restaurant.user.id,
              email: restaurant.user.email,
              phoneNumber: restaurant.user.phoneNumber,
              fullName: restaurant.user.fullName,
            }
          : null,
      ownerAccountPhone: restaurant.user.phoneNumber,
      restaurantContactPhone: restaurant.phoneNumber,
      jobs: restaurant.jobs.map(mapAdminRestaurantJob),
      qrLeads: restaurant.leads.map(mapAdminLead),
      applications: applications.map(mapAdminRestaurantApplication),
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch restaurant',
    })
  }
}

export async function updateAdminRestaurant(req: Request, res: Response) {
  try {
    const adminUserId = getAdminUserId(req)

    if (!adminUserId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const idResult = adminRestaurantIdSchema.safeParse(req.params.id)
    const bodyResult = adminRestaurantUpdateSchema.safeParse(req.body)

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

    const restaurant = await prisma.restaurantOwnerProfile.findUnique({
      where: {
        id: idResult.data,
      },
    })

    if (!restaurant) {
      return res.status(404).json({
        message: 'restaurant not found',
      })
    }

    const requestedSlug = bodyResult.data.slug
    const slug =
      typeof requestedSlug === 'string' && requestedSlug.trim()
        ? await generateUniqueRestaurantSlug(requestedSlug, restaurant.id)
        : requestedSlug === ''
          ? null
          : undefined

    const data: {
      restaurantName?: string
      contactPerson?: string
      phoneNumber?: string
      whatsappNumber?: string
      city?: string
      street?: string
      description?: string
      slug?: string | null
    } = {}

    for (const field of [
      'restaurantName',
      'contactPerson',
      'phoneNumber',
      'whatsappNumber',
      'city',
      'street',
      'description',
    ] as const) {
      if (bodyResult.data[field] !== undefined) {
        data[field] = bodyResult.data[field]
      }
    }

    if (slug !== undefined) {
      data.slug = slug
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.restaurantOwnerProfile.update({
        where: {
          id: restaurant.id,
        },
        data,
      })

      await tx.restaurantJob.updateMany({
        where: {
          ownerProfileId: updated.id,
        },
        data: {
          restaurantName: updated.restaurantName,
          location: updated.city,
          area: updated.street,
        },
      })

      return updated
    })

    const updatedRestaurant =
      await prisma.restaurantOwnerProfile.findUniqueOrThrow({
        where: {
          id: restaurant.id,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phoneNumber: true,
              fullName: true,
            },
          },
          jobs: {
            select: {
              isActive: true,
              kind: true,
              applications: {
                select: {
                  createdAt: true,
                },
              },
              _count: {
                select: {
                  applications: true,
                },
              },
            },
          },
          leads: {
            select: {
              createdAt: true,
            },
          },
          adminReadStates: {
            where: {
              adminUserId,
            },
            select: {
              lastViewedCandidatesAt: true,
            },
          },
          _count: {
            select: {
              leads: true,
            },
          },
        },
      })

    return res.json(mapAdminRestaurantSummary(updatedRestaurant))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to update restaurant',
    })
  }
}

export async function markAdminRestaurantSeen(req: Request, res: Response) {
  try {
    const adminUserId = getAdminUserId(req)

    if (!adminUserId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const idResult = adminRestaurantIdSchema.safeParse(req.params.id)

    if (!idResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(idResult.error),
      })
    }

    const restaurant = await prisma.restaurantOwnerProfile.findUnique({
      where: {
        id: idResult.data,
      },
      select: {
        id: true,
      },
    })

    if (!restaurant) {
      return res.status(404).json({
        message: 'restaurant not found',
      })
    }

    const now = new Date()
    const readState = await prisma.adminRestaurantReadState.upsert({
      where: {
        adminUserId_restaurantId: {
          adminUserId,
          restaurantId: restaurant.id,
        },
      },
      update: {
        lastViewedCandidatesAt: now,
      },
      create: {
        adminUserId,
        restaurantId: restaurant.id,
        lastViewedCandidatesAt: now,
      },
    })

    return res.json({
      ok: true,
      lastViewedCandidatesAt:
        readState.lastViewedCandidatesAt.toISOString(),
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to mark restaurant seen',
    })
  }
}

export async function deleteAdminRestaurant(req: Request, res: Response) {
  try {
    const idResult = adminRestaurantIdSchema.safeParse(req.params.id)

    if (!idResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(idResult.error),
      })
    }

    const restaurant = await prisma.restaurantOwnerProfile.findUnique({
      where: {
        id: idResult.data,
      },
      select: {
        id: true,
      },
    })

    if (!restaurant) {
      return res.status(404).json({
        message: 'restaurant not found',
      })
    }

    await prisma.$transaction(async (tx) => {
      const jobs = await tx.restaurantJob.findMany({
        where: {
          ownerProfileId: restaurant.id,
        },
        select: {
          id: true,
        },
      })
      const jobIds = jobs.map((job) => job.id)

      if (jobIds.length > 0) {
        await tx.restaurantApplication.deleteMany({
          where: {
            restaurantJobId: {
              in: jobIds,
            },
          },
        })

        await tx.restaurantJob.deleteMany({
          where: {
            id: {
              in: jobIds,
            },
          },
        })
      }

      await tx.restaurantOwnerProfile.delete({
        where: {
          id: restaurant.id,
        },
      })
    })

    return res.status(204).send()
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to delete restaurant',
    })
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
