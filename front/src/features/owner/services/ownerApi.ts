import { API_BASE_URL } from '../../../config/env'
import {
  clearAuthToken,
  getAuthToken,
  notifyAuthSessionExpired,
} from '../../auth/utils/authStorage'
import type {
  OwnerJob,
  OwnerJobInput,
  OwnerProfile,
  OwnerProfileInput,
} from '../types/owner'

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

export async function getOwnerProfile(): Promise<OwnerProfile | null> {
  const response = await fetch(`${API_BASE_URL}/owner/profile`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load restaurant profile')
  }

  return response.json()
}

export async function saveOwnerProfile(
  input: OwnerProfileInput,
): Promise<OwnerProfile> {
  const response = await fetch(`${API_BASE_URL}/owner/profile`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to save restaurant profile')
  }

  return response.json()
}

export async function getOwnerJobs(): Promise<OwnerJob[]> {
  const response = await fetch(`${API_BASE_URL}/owner/jobs`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load restaurant jobs')
  }

  return response.json()
}

export async function createOwnerJob(
  input: OwnerJobInput,
): Promise<OwnerJob> {
  const response = await fetch(`${API_BASE_URL}/owner/jobs`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to create restaurant job')
  }

  return response.json()
}

export async function updateOwnerJob(
  id: string,
  input: OwnerJobInput,
): Promise<OwnerJob> {
  const response = await fetch(`${API_BASE_URL}/owner/jobs/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to update restaurant job')
  }

  return response.json()
}

export async function setOwnerJobActive(
  id: string,
  isActive: boolean,
): Promise<OwnerJob> {
  const response = await fetch(`${API_BASE_URL}/owner/jobs/${id}/active`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      isActive,
    }),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to update job visibility')
  }

  return response.json()
}

export async function deleteOwnerJob(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/owner/jobs/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to delete restaurant job')
  }
}
