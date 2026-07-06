import type { Request, Response } from 'express'
import type {
  RestaurantJob,
  RestaurantOwnerProfile,
} from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  ownerJobActiveSchema,
  ownerJobIdSchema,
  ownerJobSchema,
  ownerProfileSchema,
} from '../validations/owner.validation.js'

const PROFILE_REQUIRED_MESSAGE =
  'Complete your restaurant profile before posting jobs.'

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
    location: profile.location,
    area: profile.area,
    description: profile.description,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }
}

function mapOwnerJob(job: RestaurantJob) {
  return {
    id: job.id,
    restaurantName: job.restaurantName,
    role: job.role,
    location: job.location,
    area: job.area,
    description: job.description,
    requirements: job.requirements,
    shiftInfo: job.shiftInfo,
    contactPhone: job.contactPhone,
    contactWhatsapp: job.contactWhatsapp,
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

    const profile = await prisma.restaurantOwnerProfile.upsert({
      where: {
        userId,
      },
      update: result.data,
      create: {
        ...result.data,
        userId,
      },
    })

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

    if (!profile?.restaurantName.trim()) {
      return res.status(400).json({
        message: PROFILE_REQUIRED_MESSAGE,
      })
    }

    const job = await prisma.restaurantJob.create({
      data: {
        ...result.data,
        restaurantName: profile.restaurantName,
        ownerProfileId: profile.id,
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
      data: bodyResult.data,
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
