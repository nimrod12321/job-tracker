import type { Request, Response } from 'express'
import type { Job as PrismaJob } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import type { Job as ApiJob, JobStatus } from '../types/job.js'

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
    createdAt: formatDate(job.createdAt),
    updatedAt: formatDate(job.updatedAt),
  }
}

const validStatuses: JobStatus[] = [
  'applied',
  'HR',
  'technical',
  'rejected',
  'offer',
]

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

export async function createJob(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const { company, position, status, wantedSalary, location, notes } = req.body as {
      company?: unknown
      position?: unknown
      status?: unknown
      wantedSalary?: unknown
      location?: unknown
      notes?: unknown
    }

    if (
      typeof company !== 'string' ||
      typeof position !== 'string' ||
      typeof location !== 'string'
    ) {
      return res.status(400).json({
        message: 'company, position, and location are required',
      })
    }

    if (status !== undefined && (!validStatuses.includes(status as JobStatus))) {
      return res.status(400).json({
        message: 'invalid job status',
      })
    }

    const newJob = await prisma.job.create({
      data: {
        company,
        position,
        status: typeof status === 'string' ? (status as JobStatus) : 'applied',
        wantedSalary: Number(wantedSalary) || 0,
        location,
        notes: typeof notes === 'string' ? notes : '',
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

    const { company, position, status, wantedSalary, location, notes } = req.body as {
      company?: unknown
      position?: unknown
      status?: unknown
      wantedSalary?: unknown
      location?: unknown
      notes?: unknown
    }

    if (
      typeof company !== 'string' ||
      typeof position !== 'string' ||
      typeof location !== 'string'
    ) {
      return res.status(400).json({
        message: 'company, position, and location are required',
      })
    }

    if (typeof status !== 'string' || !validStatuses.includes(status as JobStatus)) {
      return res.status(400).json({
        message: 'invalid job status',
      })
    }

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
        company,
        position,
        status: status as JobStatus,
        wantedSalary: Number(wantedSalary) || 0,
        location,
        notes: typeof notes === 'string' ? notes : '',
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
    const { status } = req.body as { status?: unknown }

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

    if (typeof status !== 'string' || !validStatuses.includes(status as JobStatus)) {
      return res.status(400).json({
        message: 'invalid job status',
      })
    }

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
        status: status as JobStatus,
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