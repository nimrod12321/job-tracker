import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import {
  getDiscoveryFeed,
  hasUsefulDiscoveryProfile,
} from '../services/discoveryFeed.service.js'
import { JobFetchError } from '../services/jobFetch.service.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  discoveryDecisionSchema,
  discoveryFeedRequestSchema,
} from '../validations/discovery.validation.js'

function getUserId(req: Request) {
  return (req as AuthenticatedRequest).userId
}

export async function recordDiscoveryDecision(
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

    const result = discoveryDecisionSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const decision = await prisma.jobDiscoveryDecision.upsert({
      where: {
        userId_source_externalId: {
          userId,
          source: result.data.source,
          externalId: result.data.externalId,
        },
      },
      create: {
        ...result.data,
        userId,
      },
      update: result.data,
    })

    return res.json(decision)
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to record discovery decision',
    })
  }
}

export async function getLikedDiscoveryJobs(
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

    const likedJobs = await prisma.jobDiscoveryDecision.findMany({
      where: {
        userId,
        decision: 'liked',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return res.json(likedJobs)
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch liked discovery jobs',
    })
  }
}

export async function getDiscoveryJobs(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const result = discoveryFeedRequestSchema.safeParse(req.body ?? {})

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const profile = await prisma.resumeProfile.findUnique({
      where: {
        userId,
      },
    })

    if (!hasUsefulDiscoveryProfile(profile)) {
      return res.status(400).json({
        message:
          'Upload your resume or complete your profile before using Discover.',
      })
    }

    const jobs = await getDiscoveryFeed({
      userId,
      profile,
      limit: result.data.limit,
      excludeExternalIds: result.data.excludeExternalIds,
    })

    return res.json({
      jobs,
    })
  } catch (error) {
    console.error(error)

    return res
      .status(error instanceof JobFetchError ? 502 : 500)
      .json({
        message:
          error instanceof JobFetchError
            ? error.message
            : 'failed to load discovery jobs',
      })
  }
}
