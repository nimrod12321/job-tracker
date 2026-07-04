import {
  clearAuthToken,
  getAuthToken,
  notifyAuthSessionExpired,
} from '../../auth/utils/authStorage'
import type {
  ResumeProfile,
  ResumeProfileInput,
} from '../types/profile'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

function getHeaders(includeJson = true): HeadersInit {
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
    const error = (await response.json()) as { message?: unknown }

    if (typeof error.message === 'string' && error.message.trim()) {
      message = error.message
    }
  } catch {
    // Keep the fallback when the response body is not valid JSON.
  }

  throw new Error(message)
}

export async function getProfile(): Promise<ResumeProfile | null> {
  const response = await fetch(`${API_BASE_URL}/profile`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load profile')
  }

  return response.json()
}

export async function saveProfile(
  profile: ResumeProfileInput,
): Promise<ResumeProfile> {
  const response = await fetch(`${API_BASE_URL}/profile`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(profile),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to save profile')
  }

  return response.json()
}

export async function uploadResume(
  file: File,
): Promise<{ resumeText: string }> {
  const formData = new FormData()
  formData.append('resume', file)

  const response = await fetch(
    `${API_BASE_URL}/profile/resume-upload`,
    {
      method: 'POST',
      headers: getHeaders(false),
      body: formData,
    },
  )

  if (!response.ok) {
    await handleApiError(response, 'Failed to upload resume')
  }

  return response.json()
}
