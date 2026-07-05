import { API_BASE_URL } from '../../../config/env'
import {
  clearAuthToken,
  getAuthToken,
  notifyAuthSessionExpired,
} from '../../auth/utils/authStorage'
import type {
  DiscoveryDecision,
  DiscoveryDecisionInput,
  DiscoveryFeedInput,
  DiscoveryJob,
} from '../types/discovery'

function getHeaders(): HeadersInit {
  const headers = new Headers({
    'Content-Type': 'application/json',
  })
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
    const error = (await response.json()) as { message?: unknown }

    if (typeof error.message === 'string' && error.message.trim()) {
      message = error.message
    }
  } catch {
    // Keep the fallback when the response body is not valid JSON.
  }

  throw new Error(message)
}

export async function recordDiscoveryDecision(
  input: DiscoveryDecisionInput,
): Promise<DiscoveryDecision> {
  const response = await fetch(`${API_BASE_URL}/discover/decisions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    await handleApiError(
      response,
      'Failed to record discovery decision',
    )
  }

  return response.json()
}

export async function getLikedDiscoveryJobs(): Promise<
  DiscoveryDecision[]
> {
  const response = await fetch(`${API_BASE_URL}/discover/liked`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(
      response,
      'Failed to load liked discovery jobs',
    )
  }

  return response.json()
}

export async function getDiscoveryJobs(
  input: DiscoveryFeedInput = {},
): Promise<DiscoveryJob[]> {
  const response = await fetch(`${API_BASE_URL}/discover/jobs`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load discovery jobs')
  }

  const result = (await response.json()) as {
    jobs: DiscoveryJob[]
  }

  return result.jobs
}
