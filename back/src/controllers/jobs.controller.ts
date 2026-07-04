import type { Request, Response } from 'express'
import type {
  Job as PrismaJob,
  JobAnalysis as PrismaJobAnalysis,
} from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import type {
  Job as ApiJob,
  JobDetail,
  JobPriority,
  JobStatus,
} from '../types/job.js'
import { mapJobAnalysisToResponse } from '../utils/jobAnalysis.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  createJobSchema,
  updateJobSchema,
  updateJobStatusSchema,
} from '../validations/job.validation.js'

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function mapJobToResponse(job: PrismaJob): ApiJob {
  return {
    id: job.id,
    company: job.company,
    position: job.position,
    status: job.status as JobStatus,
    wantedSalary: job.wantedSalary,
    location: job.location,
    notes: job.notes,
    jobDescription: job.jobDescription,
    jobUrl: job.jobUrl,
    companyUrl: job.companyUrl,
    source: job.source,
    priority: job.priority as JobPriority,
    dateApplied: job.dateApplied ? formatDate(job.dateApplied) : '',
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    createdAt: formatDate(job.createdAt),
    updatedAt: formatDate(job.updatedAt),
  }
}

function mapJobDetailToResponse(
  job: PrismaJob & { analysis: PrismaJobAnalysis | null },
): JobDetail {
  return {
    ...mapJobToResponse(job),
    analysis: job.analysis
      ? mapJobAnalysisToResponse(job.analysis)
      : null,
  }
}

function getUserId(req: Request) {
  return (req as AuthenticatedRequest).userId
}

async function findUserJob(id: string, userId: string) {
  return prisma.job.findFirst({
    where: {
      id,
      userId,
    },
  })
}

export async function getJobs(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const dbJobs = await prisma.job.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return res.json(dbJobs.map(mapJobToResponse))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch jobs',
    })
  }
}

export async function getJob(req: Request, res: Response) {
  try {
    const userId = getUserId(req)
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
      include: {
        analysis: true,
      },
    })

    if (!job) {
      return res.status(404).json({
        message: 'job not found',
      })
    }

    return res.json(mapJobDetailToResponse(job))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch job',
    })
  }
}

export async function createJob(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const result = createJobSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const { dateApplied, ...jobData } = result.data

    const newJob = await prisma.job.create({
      data: {
        ...jobData,
        dateApplied: dateApplied ? new Date(dateApplied) : null,
        userId,
      },
    })

    return res.status(201).json(mapJobToResponse(newJob))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to create job',
    })
  }
}

export async function updateJob(req: Request, res: Response) {
  try {
    const userId = getUserId(req)
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

    const result = updateJobSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const { dateApplied, ...jobData } = result.data

    const existingJob = await findUserJob(id, userId)

    if (!existingJob) {
      return res.status(404).json({
        message: 'job not found',
      })
    }

    const updatedJob = await prisma.job.update({
      where: {
        id,
      },
      data: {
        ...jobData,
        dateApplied: dateApplied ? new Date(dateApplied) : null,
      },
    })

    return res.json(mapJobToResponse(updatedJob))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to update job',
    })
  }
}

export async function updateJobStatus(req: Request, res: Response) {
  try {
    const userId = getUserId(req)
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

    const result = updateJobStatusSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const { status } = result.data

    const existingJob = await findUserJob(id, userId)

    if (!existingJob) {
      return res.status(404).json({
        message: 'job not found',
      })
    }

    const updatedJob = await prisma.job.update({
      where: {
        id,
      },
      data: {
        status,
      },
    })

    return res.json(mapJobToResponse(updatedJob))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to update job status',
    })
  }
}

export async function deleteJob(req: Request, res: Response) {
  try {
    const userId = getUserId(req)
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

    const existingJob = await findUserJob(id, userId)

    if (!existingJob) {
      return res.status(404).json({
        message: 'job not found',
      })
    }

    await prisma.job.delete({
      where: {
        id,
      },
    })

    return res.status(204).send()
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to delete job',
    })
  }
}
