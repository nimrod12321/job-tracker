import { API_BASE_URL } from '../../../config/env'
import {
  clearAuthToken,
  getAuthToken,
  notifyAuthSessionExpired,
} from '../../auth/utils/authStorage'
import type {
  RestaurantApplication,
  RestaurantExploreJob,
  RestaurantMatch,
  RestaurantWorkerProfile,
  RestaurantWorkerProfileInput,
} from '../types/restaurant'

function getHeaders(): Headers {
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

export async function getRestaurantProfile(): Promise<RestaurantWorkerProfile | null> {
  const response = await fetch(`${API_BASE_URL}/restaurant/profile`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load worker profile')
  }

  return response.json()
}

export async function saveRestaurantProfile(
  input: RestaurantWorkerProfileInput,
): Promise<RestaurantWorkerProfile> {
  const response = await fetch(`${API_BASE_URL}/restaurant/profile`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to save worker profile')
  }

  return response.json()
}

export async function getRestaurantExploreJobs(input: {
  limit?: number
  excludeJobIds?: string[]
}): Promise<RestaurantExploreJob[]> {
  const response = await fetch(`${API_BASE_URL}/restaurant/explore`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load restaurant jobs')
  }

  const data = (await response.json()) as {
    jobs: RestaurantExploreJob[]
  }

  return data.jobs
}

export async function applyToRestaurantJob(
  restaurantJobId: string,
): Promise<RestaurantApplication> {
  const response = await fetch(`${API_BASE_URL}/restaurant/applications`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      restaurantJobId,
    }),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to apply to restaurant job')
  }

  const data = (await response.json()) as {
    application: RestaurantApplication
  }

  return data.application
}

export async function getRestaurantMatches(): Promise<RestaurantMatch[]> {
  const response = await fetch(`${API_BASE_URL}/restaurant/matches`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load restaurant matches')
  }

  return response.json()
}
