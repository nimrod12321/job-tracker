import type { Job, JobStatus } from '../../../types/job'

const API_BASE_URL = 'http://localhost:4000/api'

export async function getJobs(): Promise<Job[]> {
  const response = await fetch(`${API_BASE_URL}/jobs`)

  if (!response.ok) {
    throw new Error('Failed to fetch jobs')
  }

  return response.json()
}

export async function createJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
  const response = await fetch(`${API_BASE_URL}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(job),
  })

  if (!response.ok) {
    throw new Error('Failed to create job')
  }

  return response.json()
}

export async function updateJob(job: Job): Promise<Job> {
  const response = await fetch(`${API_BASE_URL}/jobs/${job.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(job),
  })

  if (!response.ok) {
    throw new Error('Failed to update job')
  }

  return response.json()
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
): Promise<Job> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  })

  if (!response.ok) {
    throw new Error('Failed to update job status')
  }

  return response.json()
}

export async function deleteJob(jobId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error('Failed to delete job')
  }
}