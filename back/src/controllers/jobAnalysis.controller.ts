import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import {
  AiServiceError,
  analyzeJobMatch,
} from '../services/ai.service.js'
import { mapJobAnalysisToResponse } from '../utils/jobAnalysis.js'

export async function analyzeJob(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).userId
    const id = req.params.id

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    if (typeof id !== 'string') {
      return res.status(400).json({
        message: 'job id is required',
      })
    }

    const job = await prisma.job.findFirst({
      where: {
        id,
        userId,
      },
    })

    if (!job) {
      return res.status(404).json({
        message: 'job not found',
      })
    }

    const profile = await prisma.resumeProfile.findUnique({
      where: {
        userId,
      },
    })

    if (!profile) {
      return res.status(400).json({
        message: 'resume profile is required before analyzing jobs',
      })
    }

    if (!job.jobDescription.trim()) {
      return res.status(400).json({
        message: 'job description is required before analysis',
      })
    }

    const result = await analyzeJobMatch(profile, job)
    const analysis = await prisma.jobAnalysis.upsert({
      where: {
        jobId: job.id,
      },
      create: {
        jobId: job.id,
        ...result,
      },
      update: result,
    })

    return res.json(mapJobAnalysisToResponse(analysis))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message:
        error instanceof AiServiceError
          ? error.message
          : 'failed to analyze job',
    })
  }
}
