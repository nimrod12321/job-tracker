import type { Job, JobStatus } from '../../../types/job'
import { getAuthToken } from '../../auth/utils/authStorage'

const API_BASE_URL = 'http://localhost:4000/api'

function getHeaders(includeJson = false): HeadersInit {
  const headers = new Headers()

  if (includeJson) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAuthToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

export async function getJobs(): Promise<Job[]> {
  const response = await fetch(`${API_BASE_URL}/jobs`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch jobs')
  }

  return response.json()
}

export async function createJob(
  job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Job> {
  const response = await fetch(`${API_BASE_URL}/jobs`, {
    method: 'POST',
    headers: getHeaders(true),
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
    headers: getHeaders(true),
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
    headers: getHeaders(true),
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
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to delete job')
  }
}