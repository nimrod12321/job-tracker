import { API_BASE_URL } from '../../../config/env'
import {
  clearAuthToken,
  getAuthToken,
  notifyAuthSessionExpired,
} from '../../auth/utils/authStorage'
import type {
  OwnerApplication,
  OwnerAccessibleRestaurant,
  OwnerJob,
  OwnerJobInput,
  OwnerProfile,
  OwnerProfileInput,
  OwnerTeam,
  OwnerTeamMember,
  RestaurantCandidateLead,
} from '../types/owner'
import type { RestaurantRole } from '../../restaurant/types/restaurant'
import { getStoredOwnerRestaurantId } from '../utils/ownerRestaurantSelection'

function getHeaders(restaurantId?: string | null): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
  })
  const token = getAuthToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const resolvedRestaurantId =
    restaurantId === null
      ? null
      : restaurantId ?? getStoredOwnerRestaurantId()

  if (resolvedRestaurantId) {
    headers.set('X-Restaurant-Id', resolvedRestaurantId)
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

export async function getOwnerRestaurants(): Promise<
  OwnerAccessibleRestaurant[]
> {
  const response = await fetch(`${API_BASE_URL}/owner/restaurants`, {
    headers: getHeaders(null),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load accessible restaurants')
  }

  const body = (await response.json()) as {
    restaurants: OwnerAccessibleRestaurant[]
  }

  return body.restaurants
}

export async function getOwnerProfile(
  restaurantId?: string,
): Promise<OwnerProfile | null> {
  const response = await fetch(`${API_BASE_URL}/owner/profile`, {
    headers: getHeaders(restaurantId),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load restaurant profile')
  }

  return response.json()
}

export async function saveOwnerProfile(
  input: OwnerProfileInput,
  restaurantId?: string,
): Promise<OwnerProfile> {
  const response = await fetch(`${API_BASE_URL}/owner/profile`, {
    method: 'PUT',
    headers: getHeaders(restaurantId),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to save restaurant profile')
  }

  return response.json()
}

export async function updateOwnerQrRoles(
  qrEnabledRoles: RestaurantRole[],
  restaurantId?: string,
): Promise<OwnerProfile> {
  const response = await fetch(`${API_BASE_URL}/owner/qr-roles`, {
    method: 'PATCH',
    headers: getHeaders(restaurantId),
    body: JSON.stringify({
      qrEnabledRoles,
    }),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to update QR roles')
  }

  return response.json()
}

export async function getOwnerJobs(restaurantId?: string): Promise<OwnerJob[]> {
  const response = await fetch(`${API_BASE_URL}/owner/jobs`, {
    headers: getHeaders(restaurantId),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load restaurant jobs')
  }

  return response.json()
}

export async function createOwnerJob(
  input: OwnerJobInput,
  restaurantId?: string,
): Promise<OwnerJob> {
  const response = await fetch(`${API_BASE_URL}/owner/jobs`, {
    method: 'POST',
    headers: getHeaders(restaurantId),
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
  restaurantId?: string,
): Promise<OwnerJob> {
  const response = await fetch(`${API_BASE_URL}/owner/jobs/${id}`, {
    method: 'PUT',
    headers: getHeaders(restaurantId),
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
  restaurantId?: string,
): Promise<OwnerJob> {
  const response = await fetch(`${API_BASE_URL}/owner/jobs/${id}/active`, {
    method: 'PATCH',
    headers: getHeaders(restaurantId),
    body: JSON.stringify({
      isActive,
    }),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to update job visibility')
  }

  return response.json()
}

export async function deleteOwnerJob(
  id: string,
  restaurantId?: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/owner/jobs/${id}`, {
    method: 'DELETE',
    headers: getHeaders(restaurantId),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to delete restaurant job')
  }
}

export async function getOwnerApplications(
  restaurantId?: string,
): Promise<OwnerApplication[]> {
  const response = await fetch(`${API_BASE_URL}/owner/applications`, {
    headers: getHeaders(restaurantId),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load applications')
  }

  return response.json()
}

export async function getAllOwnerApplications(): Promise<OwnerApplication[]> {
  const response = await fetch(`${API_BASE_URL}/owner/applications/all`, {
    headers: getHeaders(null),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load applications')
  }

  return response.json()
}

export async function updateOwnerApplicationStatus(
  id: string,
  status: 'selected' | 'rejected',
  restaurantId?: string,
): Promise<Pick<OwnerApplication, 'id' | 'status' | 'createdAt'>> {
  const response = await fetch(
    `${API_BASE_URL}/owner/applications/${id}/status`,
    {
      method: 'PATCH',
      headers: getHeaders(restaurantId),
      body: JSON.stringify({
        status,
      }),
    },
  )

  if (!response.ok) {
    await handleApiError(response, 'Failed to update application')
  }

  return response.json()
}

export async function deleteOwnerApplication(
  id: string,
  restaurantId?: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/owner/applications/${id}`, {
    method: 'DELETE',
    headers: getHeaders(restaurantId),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to remove application')
  }
}

export async function getOwnerLeads(
  restaurantId?: string,
): Promise<RestaurantCandidateLead[]> {
  const response = await fetch(`${API_BASE_URL}/owner/leads`, {
    headers: getHeaders(restaurantId),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load QR candidates')
  }

  return response.json()
}

export async function getAllOwnerLeads(): Promise<RestaurantCandidateLead[]> {
  const response = await fetch(`${API_BASE_URL}/owner/leads/all`, {
    headers: getHeaders(null),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load QR candidates')
  }

  return response.json()
}

export async function updateOwnerLeadStatus(
  id: string,
  status: RestaurantCandidateLead['status'],
  contactChannel?: 'phone' | 'whatsapp',
  restaurantId?: string,
): Promise<RestaurantCandidateLead> {
  const response = await fetch(`${API_BASE_URL}/owner/leads/${id}/status`, {
    method: 'PATCH',
    keepalive: Boolean(contactChannel),
    headers: getHeaders(restaurantId),
    body: JSON.stringify({
      status,
      ...(contactChannel ? { contactChannel } : {}),
    }),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to update QR candidate')
  }

  return response.json()
}

export async function deleteOwnerLead(
  id: string,
  restaurantId?: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/owner/leads/${id}`, {
    method: 'DELETE',
    headers: getHeaders(restaurantId),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to remove QR candidate')
  }
}

export async function getOwnerTeam(restaurantId?: string): Promise<OwnerTeam> {
  const response = await fetch(`${API_BASE_URL}/owner/team`, {
    headers: getHeaders(restaurantId),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to load restaurant team')
  }

  return response.json()
}

export async function addOwnerTeamMember(input: {
  displayName: string
  phoneNumber: string
}, restaurantId?: string): Promise<OwnerTeamMember> {
  const response = await fetch(`${API_BASE_URL}/owner/team/members`, {
    method: 'POST',
    headers: getHeaders(restaurantId),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to add team member')
  }

  return response.json()
}

export async function removeOwnerTeamMember(
  id: string,
  restaurantId?: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/owner/team/members/${id}`, {
    method: 'DELETE',
    headers: getHeaders(restaurantId),
  })

  if (!response.ok) {
    await handleApiError(response, 'Failed to remove team member')
  }
}
