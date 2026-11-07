import { API_BASE_URL } from '../config/env'
import { getAuthToken } from '../features/auth/utils/authStorage'
import { createAnalyticsClientEventId } from './events'
import type {
  OwnerActivityEvent,
  OwnerActivityRecorder,
} from './ownerActivityActions'
import { getStoredOwnerRestaurantId } from '../features/owner/utils/ownerRestaurantSelection'

async function postOwnerActivity(
  token: string,
  body: Record<string, unknown>,
  restaurantId: string | null,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  if (restaurantId) {
    headers['X-Restaurant-Id'] = restaurantId
  }

  const response = await fetch(`${API_BASE_URL}/analytics/owner-events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  return response.ok
}

export const sendOwnerActivityEvent: OwnerActivityRecorder = async (
  event: OwnerActivityEvent,
) => {
  const token = getAuthToken()
  const clientEventId = createAnalyticsClientEventId()

  if (!token || !clientEventId) return false

  const candidateReference =
    'candidateReference' in event
      ? {
          kind: event.candidateReference.kind,
          id: event.candidateReference.id,
        }
      : null
  const restaurantId =
    ('candidateReference' in event
      ? event.candidateReference.restaurantId
      : undefined) ?? getStoredOwnerRestaurantId()
  const body = {
    clientEventId,
    eventName: event.eventName,
    occurredAt: new Date().toISOString(),
    route: window.location.pathname,
    ...(candidateReference ? { candidateReference } : {}),
    properties: event.properties ?? {},
  }

  try {
    const sent = await postOwnerActivity(token, body, restaurantId)
    if (sent) return true
    return await postOwnerActivity(token, body, restaurantId)
  } catch {
    try {
      return await postOwnerActivity(token, body, restaurantId)
    } catch {
      return false
    }
  }
}
