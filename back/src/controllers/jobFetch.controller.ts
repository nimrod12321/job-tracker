import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import {
  fetchExternalJobs,
  JobFetchError,
} from '../services/jobFetch.service.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import { jobFetchRequestSchema } from '../validations/jobFetch.validation.js'

export async function fetchJobs(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).userId

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const result = jobFetchRequestSchema.safeParse(req.body)

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

    if (
      !result.data.query &&
      (!profile ||
        (!profile.targetRole.trim() && !profile.skills.trim()))
    ) {
      return res.status(400).json({
        message:
          'Complete your profile or enter a search query before fetching jobs.',
      })
    }

    const jobs = await fetchExternalJobs({
      ...result.data,
      profile,
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
            : 'failed to fetch external jobs',
      })
  }
}
