import { API_BASE_URL } from '../../../config/env'
import type { RestaurantRole } from '../../restaurant/types/restaurant'

export type PublicRestaurantClaim = {
  restaurantName: string
  slug: string
  city: string
  street: string
  qrEnabledRoles: RestaurantRole[]
  enabledQrRoleCount: number
  claimStatus: 'available'
}

export type RestaurantClaimCompletion = {
  alreadyOwned: boolean
  profileComplete: boolean
  restaurant: {
    id: string
    restaurantName: string
    slug: string | null
  }
}

export class RestaurantClaimApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message)
    this.name = 'RestaurantClaimApiError'
    this.status = status
    this.code = code
  }
}

async function getClaimError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as {
      code?: unknown
      message?: unknown
    }

    return new RestaurantClaimApiError(
      typeof body.message === 'string' && body.message.trim()
        ? body.message
        : fallback,
      response.status,
      typeof body.code === 'string' ? body.code : undefined,
    )
  } catch {
    return new RestaurantClaimApiError(fallback, response.status)
  }
}

export async function getPublicRestaurantClaim(
  slug: string,
  token: string,
): Promise<PublicRestaurantClaim> {
  const response = await fetch(
    `${API_BASE_URL}/public/restaurants/${encodeURIComponent(slug)}/claim?token=${encodeURIComponent(token)}`,
  )

  if (!response.ok) {
    throw await getClaimError(response, 'Activation link is unavailable')
  }

  return response.json()
}

export async function completePublicRestaurantClaim(input: {
  slug: string
  token: string
  authToken: string
}): Promise<RestaurantClaimCompletion> {
  const response = await fetch(
    `${API_BASE_URL}/owner/claims/${encodeURIComponent(input.slug)}/complete`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: input.token,
      }),
    },
  )

  if (!response.ok) {
    throw await getClaimError(response, 'Failed to activate restaurant')
  }

  return response.json()
}
