import type {
  Job,
  JobAnalysis,
  JobDetail,
  JobImportInput,
  JobListItem,
  JobStatus,
  ImportedJobDraft,
} from '../../../types/job'
import {
  clearAuthToken,
  getAuthToken,
  notifyAuthSessionExpired,
} from '../../auth/utils/authStorage'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

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
async function handleApiError(
  response: Response,
  fallbackMessage: string,
): Promise<never> {
  if (response.status === 401) {
    clearAuthToken()
    notifyAuthSessionExpired()
    throw new Error('Session expired. Please login again.')
  }

  let message = fallbackMessage

  try {
    const error = (await response.json()) as { message?: string }

    if (error.message) {
      message = error.message
    }
  } catch {
    // Keep the fallback when the response body is not valid JSON.
  }

  throw new Error(message)
}

export async function getJobs(): Promise<JobListItem[]> {
  const response = await fetch(`${API_BASE_URL}/jobs`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to fetch jobs')
  }

  return response.json()
}

export async function getJobById(jobId: string): Promise<JobDetail> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to fetch job')
  }

  return response.json()
}

export async function importJob(
  input: JobImportInput,
): Promise<ImportedJobDraft> {
  const response = await fetch(`${API_BASE_URL}/jobs/import`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to import job')
  }

  return response.json()
}

export async function analyzeJob(jobId: string): Promise<JobAnalysis> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/analyze`, {
    method: 'POST',
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to analyze job')
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
    await handleApiError(response, 'Failed to create job')
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
    await handleApiError(response, 'Failed to update job')
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
    await handleApiError(response, 'Failed to update job status')
  }

  return response.json()
}

export async function deleteJob(jobId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to delete job')
  }
}
