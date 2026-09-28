import { API_BASE_URL } from '../config/env'
import { getAuthToken } from '../features/auth/utils/authStorage'
import { createAnalyticsClientEventId } from './events'
import type {
  OwnerActivityEvent,
  OwnerActivityRecorder,
} from './ownerActivityActions'

async function postOwnerActivity(
  token: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${API_BASE_URL}/analytics/owner-events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
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

  const body = {
    clientEventId,
    eventName: event.eventName,
    occurredAt: new Date().toISOString(),
    route: window.location.pathname,
    properties: event.properties ?? {},
  }

  try {
    const sent = await postOwnerActivity(token, body)
    if (sent) return true
    return await postOwnerActivity(token, body)
  } catch {
    try {
      return await postOwnerActivity(token, body)
    } catch {
      return false
    }
  }
}
