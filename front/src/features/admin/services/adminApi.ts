import { API_BASE_URL } from '../../../config/env'
import {
  clearAuthToken,
  getAuthToken,
  notifyAuthSessionExpired,
} from '../../auth/utils/authStorage'
import type {
  AdminRestaurantCandidateLead,
  CandidateLeadStatus,
} from '../../owner/types/owner'

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
    // Keep fallback.
  }

  throw new Error(message)
}

export async function getAdminRestaurantLeads(): Promise<
  AdminRestaurantCandidateLead[]
> {
  const response = await fetch(`${API_BASE_URL}/admin/restaurant-leads`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load restaurant leads')
  }

  return response.json()
}

export async function updateAdminRestaurantLeadStatus(
  id: string,
  status: CandidateLeadStatus,
): Promise<AdminRestaurantCandidateLead> {
  const response = await fetch(
    `${API_BASE_URL}/admin/restaurant-leads/${id}/status`,
    {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        status,
      }),
    },
  )

  if (!response.ok) {
    await handleApiError(response, 'Failed to update restaurant lead')
  }

  return response.json()
}
