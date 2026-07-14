import { API_BASE_URL } from '../../../config/env'
import {
  clearAuthToken,
  getAuthToken,
  notifyAuthSessionExpired,
} from '../../auth/utils/authStorage'
import type {
  AdminRestaurant,
  AdminRestaurantClaim,
  AdminRestaurantCandidateLead,
  AdminRestaurantDetail,
  AdminRestaurantInput,
  CandidateLeadStatus,
} from '../types/admin'

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

export async function getAdminRestaurants(): Promise<AdminRestaurant[]> {
  const response = await fetch(`${API_BASE_URL}/admin/restaurants`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load restaurants')
  }

  return response.json()
}

export async function createAdminRestaurant(
  input: AdminRestaurantInput,
): Promise<AdminRestaurant> {
  const response = await fetch(`${API_BASE_URL}/admin/restaurants`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to create restaurant')
  }

  return response.json()
}

export async function getAdminRestaurantDetail(
  id: string,
): Promise<AdminRestaurantDetail> {
  const response = await fetch(
    `${API_BASE_URL}/admin/restaurants/${encodeURIComponent(id)}`,
    {
      headers: getHeaders(),
    },
  )

  if (!response.ok) {
    await handleApiError(response, 'Failed to load restaurant')
  }

  return response.json()
}

export async function markAdminRestaurantSeen(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/admin/restaurants/${encodeURIComponent(id)}/mark-seen`,
    {
      method: 'POST',
      headers: getHeaders(),
    },
  )

  if (!response.ok) {
    await handleApiError(response, 'Failed to mark restaurant seen')
  }
}

export async function updateAdminRestaurant(
  id: string,
  input: Partial<AdminRestaurantInput>,
): Promise<AdminRestaurant> {
  const response = await fetch(
    `${API_BASE_URL}/admin/restaurants/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(input),
    },
  )

  if (!response.ok) {
    await handleApiError(response, 'Failed to update restaurant')
  }

  return response.json()
}

export async function regenerateAdminRestaurantClaim(
  id: string,
): Promise<AdminRestaurantClaim> {
  const response = await fetch(
    `${API_BASE_URL}/admin/restaurants/${encodeURIComponent(id)}/claim/regenerate`,
    {
      method: 'POST',
      headers: getHeaders(),
    },
  )

  if (!response.ok) {
    await handleApiError(response, 'Failed to regenerate activation link')
  }

  return response.json()
}

export async function deleteAdminRestaurant(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/admin/restaurants/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: getHeaders(),
    },
  )

  if (!response.ok) {
    await handleApiError(response, 'Failed to delete restaurant')
  }
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
