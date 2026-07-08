import type { Request, Response } from 'express'
import type {
  RestaurantJob,
  RestaurantOwnerProfile,
} from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  candidateLeadStatusBodySchema,
  leadIdSchema,
} from '../validations/publicRestaurant.validation.js'
import {
  ownerApplicationIdSchema,
  ownerApplicationStatusSchema,
  ownerJobActiveSchema,
  ownerJobIdSchema,
  ownerJobSchema,
  ownerProfileSchema,
} from '../validations/owner.validation.js'

const PROFILE_REQUIRED_MESSAGE =
  'Complete your restaurant profile before posting jobs.'

const DEFAULT_OWNER_JOB_DRAFTS: Array<
  Pick<RestaurantJob, 'role' | 'shiftInfo' | 'requirements' | 'description'>
> = [
  {
    role: 'waiter',
    shiftInfo:
      '3–4 shifts per week, including at least one weekend shift.',
    requirements:
      'Service mindset, responsibility, good communication. Previous restaurant experience is a plus.',
    description:
      'Join the floor team for regular restaurant service. Serve guests, work with the team, and keep service smooth and friendly.',
  },
  {
    role: 'bartender',
    shiftInfo:
      'Mostly evening shifts, 3–4 shifts per week, including at least one weekend shift.',
    requirements:
      'Bar experience is a plus, ability to work fast, responsibility, and good service attitude.',
    description:
      'Bar shift in a restaurant/bar environment. Prepare drinks, serve guests, and work closely with the floor team.',
  },
  {
    role: 'host',
    shiftInfo: 'Evening and weekend shifts, 3–4 shifts per week.',
    requirements:
      'Good communication, organized work, welcoming attitude, and responsibility.',
    description:
      'Welcome guests, manage seating flow, answer basic questions, and help the restaurant service run smoothly.',
  },
  {
    role: 'cook',
    shiftInfo:
      '3–4 shifts per week, morning/evening depending on restaurant needs, including at least one weekend shift.',
    requirements:
      'Kitchen experience is a plus, clean work, reliability, and ability to work under pressure.',
    description:
      'Kitchen shift including prep, service support, and clean organized work with the kitchen team.',
  },
  {
    role: 'floorManager',
    shiftInfo:
      '3–4 shifts per week, including evening and weekend availability.',
    requirements:
      'Restaurant experience, responsibility, team management ability, and strong communication.',
    description:
      'Manage the shift, support the floor team, solve service issues, and help keep the restaurant running smoothly.',
  },
]

function getUserId(req: Request) {
  return (req as AuthenticatedRequest).userId
}

function mapOwnerProfile(profile: RestaurantOwnerProfile) {
  return {
    id: profile.id,
    restaurantName: profile.restaurantName,
    contactPerson: profile.contactPerson,
    phoneNumber: profile.phoneNumber,
    whatsappNumber: profile.whatsappNumber,
    city: profile.city,
    street: profile.street,
    description: profile.description,
    slug: profile.slug,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }
}

function mapOwnerJob(job: RestaurantJob) {
  return {
    id: job.id,
    restaurantName: job.restaurantName,
    role: job.role,
    city: job.location,
    street: job.area,
    description: job.description,
    requirements: job.requirements,
    shiftInfo: job.shiftInfo,
    contactPhone: job.contactPhone,
    contactWhatsapp: job.contactWhatsapp,
    kind: job.kind,
    isActive: job.isActive,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  }
}

async function findOwnerProfile(userId: string) {
  return prisma.restaurantOwnerProfile.findUnique({
    where: {
      userId,
    },
  })
}

function hasCompleteOwnerProfile(
  profile: RestaurantOwnerProfile | null,
): profile is RestaurantOwnerProfile {
  return Boolean(
    profile?.restaurantName.trim() &&
      profile.city.trim() &&
      profile.street.trim(),
  )
}

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
  restaurantName: string,
  city: string,
) {
  const baseSlug = slugify(`${restaurantName} ${city}`)
  let candidateSlug = baseSlug
  let suffix = 2

  while (
    await prisma.restaurantOwnerProfile.findUnique({
      where: {
        slug: candidateSlug,
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

function mapCandidateLead(
  lead: {
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
  },
) {
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
  }
}

async function findOwnedJob(
  jobId: string,
  ownerProfileId: string,
) {
  return prisma.restaurantJob.findFirst({
    where: {
      id: jobId,
      ownerProfileId,
    },
  })
}

async function createDefaultRestaurantJobsIfNeeded(
  profile: RestaurantOwnerProfile,
) {
  const existingJobsCount = await prisma.restaurantJob.count({
    where: {
      ownerProfileId: profile.id,
    },
  })

  if (existingJobsCount > 0) {
    return
  }

  await prisma.restaurantJob.createMany({
    data: DEFAULT_OWNER_JOB_DRAFTS.map((draft) => ({
      ...draft,
      restaurantName: profile.restaurantName,
      location: profile.city,
      area: profile.street,
      contactPhone: profile.phoneNumber,
      contactWhatsapp: profile.whatsappNumber,
      ownerProfileId: profile.id,
      kind: 'draft',
      isActive: false,
    })),
  })
}

export async function getOwnerProfile(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const profile = await findOwnerProfile(userId)

    return res.json(profile ? mapOwnerProfile(profile) : null)
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch restaurant owner profile',
    })
  }
}

export async function updateOwnerProfile(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const result = ownerProfileSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const existingProfile = await findOwnerProfile(userId)
    const shouldGenerateSlug =
      !existingProfile?.slug &&
      result.data.restaurantName.trim() &&
      result.data.city.trim()
    const slug = shouldGenerateSlug
      ? await generateUniqueRestaurantSlug(
          result.data.restaurantName,
          result.data.city,
        )
      : undefined

    const profile = await prisma.restaurantOwnerProfile.upsert({
      where: {
        userId,
      },
      update: {
        ...result.data,
        ...(slug ? { slug } : {}),
      },
      create: {
        ...result.data,
        userId,
        ...(slug ? { slug } : {}),
      },
    })

    if (hasCompleteOwnerProfile(profile)) {
      await prisma.restaurantJob.updateMany({
        where: {
          ownerProfileId: profile.id,
        },
        data: {
          restaurantName: profile.restaurantName,
          location: profile.city,
          area: profile.street,
        },
      })
      await createDefaultRestaurantJobsIfNeeded(profile)
    }

    return res.json(mapOwnerProfile(profile))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to save restaurant owner profile',
    })
  }
}

export async function getOwnerJobs(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const profile = await findOwnerProfile(userId)

    if (!profile) {
      return res.json([])
    }

    const jobs = await prisma.restaurantJob.findMany({
      where: {
        ownerProfileId: profile.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return res.json(jobs.map(mapOwnerJob))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch owner jobs',
    })
  }
}

export async function createOwnerJob(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const result = ownerJobSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const profile = await findOwnerProfile(userId)

    if (!hasCompleteOwnerProfile(profile)) {
      return res.status(400).json({
        message: PROFILE_REQUIRED_MESSAGE,
      })
    }

    const job = await prisma.restaurantJob.create({
      data: {
        ...result.data,
        restaurantName: profile.restaurantName,
        location: profile.city,
        area: profile.street,
        contactPhone: result.data.contactPhone || profile.phoneNumber,
        contactWhatsapp:
          result.data.contactWhatsapp || profile.whatsappNumber,
        ownerProfileId: profile.id,
        kind: 'draft',
        isActive: false,
      },
    })

    return res.status(201).json(mapOwnerJob(job))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to create restaurant job',
    })
  }
}

export async function publishOwnerJob(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const idResult = ownerJobIdSchema.safeParse(req.params.id)

    if (!idResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(idResult.error),
      })
    }

    const profile = await findOwnerProfile(userId)

    if (!hasCompleteOwnerProfile(profile)) {
      return res.status(400).json({
        message: PROFILE_REQUIRED_MESSAGE,
      })
    }

    const draftJob = await findOwnedJob(idResult.data, profile.id)

    if (!draftJob) {
      return res.status(404).json({
        message: 'restaurant job not found',
      })
    }

    if (draftJob.kind !== 'draft') {
      return res.status(400).json({
        message: 'only draft jobs can be published',
      })
    }

    const postedJob = await prisma.restaurantJob.create({
      data: {
        restaurantName: profile.restaurantName,
        role: draftJob.role,
        location: profile.city,
        area: profile.street,
        description: draftJob.description,
        requirements: draftJob.requirements,
        shiftInfo: draftJob.shiftInfo,
        contactPhone: draftJob.contactPhone || profile.phoneNumber,
        contactWhatsapp:
          draftJob.contactWhatsapp || profile.whatsappNumber,
        ownerProfileId: profile.id,
        kind: 'posted',
        isActive: true,
      },
    })

    return res.status(201).json(mapOwnerJob(postedJob))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to publish restaurant job',
    })
  }
}

export async function updateOwnerJob(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const idResult = ownerJobIdSchema.safeParse(req.params.id)
    const bodyResult = ownerJobSchema.safeParse(req.body)

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

    const profile = await findOwnerProfile(userId)

    if (!hasCompleteOwnerProfile(profile)) {
      return res.status(400).json({
        message: PROFILE_REQUIRED_MESSAGE,
      })
    }

    const existingJob = profile
      ? await findOwnedJob(idResult.data, profile.id)
      : null

    if (!existingJob) {
      return res.status(404).json({
        message: 'restaurant job not found',
      })
    }

    const job = await prisma.restaurantJob.update({
      where: {
        id: existingJob.id,
      },
      data: {
        ...bodyResult.data,
        location: profile?.city ?? existingJob.location,
        area: profile?.street ?? existingJob.area,
        contactPhone:
          bodyResult.data.contactPhone ||
          profile?.phoneNumber ||
          existingJob.contactPhone,
        contactWhatsapp:
          bodyResult.data.contactWhatsapp ||
          profile?.whatsappNumber ||
          existingJob.contactWhatsapp,
      },
    })

    return res.json(mapOwnerJob(job))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to update restaurant job',
    })
  }
}

export async function setOwnerJobActive(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const idResult = ownerJobIdSchema.safeParse(req.params.id)
    const bodyResult = ownerJobActiveSchema.safeParse(req.body)

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

    const profile = await findOwnerProfile(userId)

    if (
      bodyResult.data.isActive &&
      !hasCompleteOwnerProfile(profile)
    ) {
      return res.status(400).json({
        message: PROFILE_REQUIRED_MESSAGE,
      })
    }

    const existingJob = profile
      ? await findOwnedJob(idResult.data, profile.id)
      : null

    if (!existingJob) {
      return res.status(404).json({
        message: 'restaurant job not found',
      })
    }

    if (bodyResult.data.isActive && existingJob.kind !== 'posted') {
      return res.status(400).json({
        message: 'publish the draft before activating it',
      })
    }

    const job = await prisma.restaurantJob.update({
      where: {
        id: existingJob.id,
      },
      data: {
        isActive: bodyResult.data.isActive,
      },
    })

    return res.json(mapOwnerJob(job))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to update restaurant job visibility',
    })
  }
}

export async function deleteOwnerJob(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const idResult = ownerJobIdSchema.safeParse(req.params.id)

    if (!idResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(idResult.error),
      })
    }

    const profile = await findOwnerProfile(userId)
    const existingJob = profile
      ? await findOwnedJob(idResult.data, profile.id)
      : null

    if (!existingJob) {
      return res.status(404).json({
        message: 'restaurant job not found',
      })
    }

    await prisma.restaurantJob.delete({
      where: {
        id: existingJob.id,
      },
    })

    return res.status(204).send()
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to delete restaurant job',
    })
  }
}

export async function getOwnerApplications(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const profile = await findOwnerProfile(userId)

    if (!profile) {
      return res.json([])
    }

    const applications = await prisma.restaurantApplication.findMany({
      where: {
        restaurantJob: {
          ownerProfileId: profile.id,
        },
      },
      include: {
        restaurantJob: true,
        user: {
          include: {
            restaurantWorkerProfile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return res.json(
      applications.map((application) => {
        const workerProfile = application.user.restaurantWorkerProfile

        return {
          id: application.id,
          status: application.status,
          createdAt: application.createdAt.toISOString(),
          job: {
            id: application.restaurantJob.id,
            role: application.restaurantJob.role,
            description: application.restaurantJob.description,
            shiftInfo: application.restaurantJob.shiftInfo,
            isActive: application.restaurantJob.isActive,
          },
          worker: {
            id: application.user.id,
            fullName: workerProfile?.fullName ?? '',
            phoneNumber: workerProfile?.phoneNumber ?? '',
            location: workerProfile?.location ?? '',
            wantedRoles: workerProfile?.wantedRoles ?? [],
            experienceText: workerProfile?.experienceText ?? '',
            availability: workerProfile?.availability ?? '',
            age:
              workerProfile && workerProfile.age > 0
                ? workerProfile.age
                : null,
          },
        }
      }),
    )
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch restaurant applications',
    })
  }
}

export async function updateOwnerApplicationStatus(
  req: Request,
  res: Response,
) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const idResult = ownerApplicationIdSchema.safeParse(req.params.id)
    const bodyResult = ownerApplicationStatusSchema.safeParse(req.body)

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

    const profile = await findOwnerProfile(userId)
    const application = profile
      ? await prisma.restaurantApplication.findFirst({
          where: {
            id: idResult.data,
            restaurantJob: {
              ownerProfileId: profile.id,
            },
          },
        })
      : null

    if (!application) {
      return res.status(404).json({
        message: 'restaurant application not found',
      })
    }

    const updatedApplication = await prisma.restaurantApplication.update({
      where: {
        id: application.id,
      },
      data: {
        status: bodyResult.data.status,
      },
    })

    return res.json({
      id: updatedApplication.id,
      status: updatedApplication.status,
      createdAt: updatedApplication.createdAt.toISOString(),
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to update restaurant application',
    })
  }
}

export async function deleteOwnerApplication(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const idResult = ownerApplicationIdSchema.safeParse(req.params.id)

    if (!idResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(idResult.error),
      })
    }

    const profile = await findOwnerProfile(userId)
    const application = profile
      ? await prisma.restaurantApplication.findFirst({
          where: {
            id: idResult.data,
            restaurantJob: {
              ownerProfileId: profile.id,
            },
          },
        })
      : null

    if (!application) {
      return res.status(404).json({
        message: 'restaurant application not found',
      })
    }

    if (
      application.status !== 'selected' &&
      application.status !== 'rejected'
    ) {
      return res.status(400).json({
        message: 'Mark applicant as rejected or accepted before removing.',
      })
    }

    await prisma.restaurantApplication.delete({
      where: {
        id: application.id,
      },
    })

    return res.status(204).send()
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to remove restaurant application',
    })
  }
}

export async function getOwnerLeads(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const profile = await findOwnerProfile(userId)

    if (!profile) {
      return res.json([])
    }

    const leads = await prisma.restaurantCandidateLead.findMany({
      where: {
        ownerProfileId: profile.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return res.json(leads.map(mapCandidateLead))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch QR candidate leads',
    })
  }
}

export async function updateOwnerLeadStatus(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

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

    const profile = await findOwnerProfile(userId)
    const lead = profile
      ? await prisma.restaurantCandidateLead.findFirst({
          where: {
            id: idResult.data,
            ownerProfileId: profile.id,
          },
        })
      : null

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
    })

    return res.json(mapCandidateLead(updatedLead))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to update candidate lead',
    })
  }
}

export async function deleteOwnerLead(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const idResult = leadIdSchema.safeParse(req.params.id)

    if (!idResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(idResult.error),
      })
    }

    const profile = await findOwnerProfile(userId)
    const lead = profile
      ? await prisma.restaurantCandidateLead.findFirst({
          where: {
            id: idResult.data,
            ownerProfileId: profile.id,
          },
        })
      : null

    if (!lead) {
      return res.status(404).json({
        message: 'candidate lead not found',
      })
    }

    if (lead.status !== 'rejected' && lead.status !== 'relevant') {
      return res.status(400).json({
        message: 'Mark candidate as rejected or relevant before removing.',
      })
    }

    await prisma.restaurantCandidateLead.delete({
      where: {
        id: lead.id,
      },
    })

    return res.status(204).send()
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to remove QR candidate lead',
    })
  }
}
