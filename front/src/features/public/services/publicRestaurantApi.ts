import { API_BASE_URL } from '../../../config/env'
import type { RestaurantRole } from '../../restaurant/types/restaurant'

export type PublicRestaurant = {
  restaurantName: string
  city: string
  street: string
  description: string
  slug: string
}

export type PublicRestaurantLeadInput = {
  fullName: string
  phoneNumber: string
  wantedRoles: RestaurantRole[]
  experienceText: string
  availability: string
  age?: number
}

export type VerifiedPublicRestaurantLeadInput = {
  wantedRoles: RestaurantRole[]
  experienceText: string
  availability: string
  age: number
}

async function handleApiError(
  response: Response,
  fallbackMessage: string,
): Promise<never> {
  let message = fallbackMessage

  try {
    const error = (await response.json()) as { message?: unknown }

    if (typeof error.message === 'string' && error.message.trim()) {
      message = error.message
    }
  } catch {
    // Keep fallback when the response is not JSON.
  }

  throw new Error(message)
}

export async function submitVerifiedPublicRestaurantLead(
  slug: string,
  input: VerifiedPublicRestaurantLeadInput,
  token: string,
): Promise<{ ok: true; message?: string }> {
  const response = await fetch(
    `${API_BASE_URL}/public/restaurants/${encodeURIComponent(slug)}/verified-leads`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
  )

  if (!response.ok) {
    await handleApiError(response, 'Failed to submit application')
  }

  return response.json()
}

export async function getPublicRestaurant(
  slug: string,
): Promise<PublicRestaurant> {
  const response = await fetch(
    `${API_BASE_URL}/public/restaurants/${encodeURIComponent(slug)}`,
  )

  if (!response.ok) {
    await handleApiError(response, 'Failed to load restaurant')
  }

  return response.json()
}

export async function submitPublicRestaurantLead(
  slug: string,
  input: PublicRestaurantLeadInput,
): Promise<{ ok: true; message?: string }> {
  const response = await fetch(
    `${API_BASE_URL}/public/restaurants/${encodeURIComponent(slug)}/leads`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  )

  if (!response.ok) {
    await handleApiError(response, 'Failed to submit application')
  }

  return response.json()
}
