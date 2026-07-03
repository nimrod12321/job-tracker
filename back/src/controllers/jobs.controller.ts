import type { Request, Response } from 'express'
import {prisma} from '../lib/prisma.js'
import type { Job, JobStatus } from '../types/job.js'

const jobs: Job[] = [
  {
    id: '1',
    company: 'MongoDB',
    position: 'Technical Services Engineer',
    status: 'applied',
    wantedSalary: 20000,
    location: 'Tel Aviv',
    notes: 'Backend fake data from Express server.',
    createdAt: '2026-07-01',
    updatedAt: '2026-07-01',
  },
]
function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}
const validStatuses: JobStatus[] = [
  'applied',
  'HR',
  'technical',
  'rejected',
  'offer',
]

export async function getJobs(req: Request, res: Response) {
  try {
    const dbJobs = await prisma.job.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    const jobs: Job[] = dbJobs.map((job) => ({
      id: job.id,
      company: job.company,
      position: job.position,
      status: job.status,
      wantedSalary: job.wantedSalary,
      location: job.location,
      notes: job.notes,
      createdAt: formatDate(job.createdAt),
      updatedAt: formatDate(job.updatedAt),
    }))

    return res.json(jobs)
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch jobs',
    })
  }
}

export async function createJob(req: Request, res: Response) {
  try {
    const { company, position, status, wantedSalary, location, notes } = req.body

    if (!company || !position || !location) {
      return res.status(400).json({
        message: 'company, position, and location are required',
      })
    }

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'invalid job status',
      })
    }

    const newJob = await prisma.job.create({
      data: {
        company,
        position,
        status: status ?? 'applied',
        wantedSalary: Number(wantedSalary) || 0,
        location,
        notes: notes ?? '',
      },
    })

    return res.status(201).json({
      id: newJob.id,
      company: newJob.company,
      position: newJob.position,
      status: newJob.status,
      wantedSalary: newJob.wantedSalary,
      location: newJob.location,
      notes: newJob.notes,
      createdAt: formatDate(newJob.createdAt),
      updatedAt: formatDate(newJob.updatedAt),
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to create job',
    })
  }
}
export async function deleteJob(req: Request, res: Response) {
  try {
    const id = req.params.id

    if (typeof id !== 'string') {
      return res.status(400).json({
        message: 'job id is required',
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

    return res.status(404).json({
      message: 'job not found',
    })
  }
}
export async function updateJobStatus(req: Request, res: Response) {
  try {
    const id = req.params.id
    const { status } = req.body as { status?: unknown }

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

    const updatedJob = await prisma.job.update({
      where: {
        id,
      },
      data: {
        status: status as JobStatus,
      },
    })

    return res.json({
      id: updatedJob.id,
      company: updatedJob.company,
      position: updatedJob.position,
      status: updatedJob.status,
      wantedSalary: updatedJob.wantedSalary,
      location: updatedJob.location,
      notes: updatedJob.notes,
      createdAt: formatDate(updatedJob.createdAt),
      updatedAt: formatDate(updatedJob.updatedAt),
    })
  } catch (error) {
    console.error(error)

    return res.status(404).json({
      message: 'job not found',
    })
  }
}
export async function updateJob(req: Request, res: Response) {
  try {
    const id = req.params.id
    const { company, position, status, wantedSalary, location, notes } = req.body as {
      company?: unknown
      position?: unknown
      status?: unknown
      wantedSalary?: unknown
      location?: unknown
      notes?: unknown
    }

    if (typeof id !== 'string') {
      return res.status(400).json({
        message: 'job id is required',
      })
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

    return res.json({
      id: updatedJob.id,
      company: updatedJob.company,
      position: updatedJob.position,
      status: updatedJob.status,
      wantedSalary: updatedJob.wantedSalary,
      location: updatedJob.location,
      notes: updatedJob.notes,
      createdAt: formatDate(updatedJob.createdAt),
      updatedAt: formatDate(updatedJob.updatedAt),
    })
  } catch (error) {
    console.error(error)

    return res.status(404).json({
      message: 'job not found',
    })
  }
}