import { API_BASE_URL } from '../../../config/env'
import { getAuthToken } from '../utils/authStorage'

export type NotificationSettings = {
  marketingSmsEnabled: boolean
  marketingSmsConsentedAt: string | null
  newCandidateSmsEnabled: boolean
  candidateReminderSmsEnabled: boolean
}

function getHeaders() {
  const token = getAuthToken()

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: unknown }
    return typeof body.message === 'string' && body.message.trim()
      ? body.message
      : fallback
  } catch {
    return fallback
  }
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const response = await fetch(`${API_BASE_URL}/auth/notification-settings`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, 'Failed to load notification settings'),
    )
  }

  return response.json()
}

export async function updateNotificationSettings(input: {
  marketingSmsEnabled: boolean
  newCandidateSmsEnabled?: boolean
  candidateReminderSmsEnabled?: boolean
}): Promise<NotificationSettings> {
  const response = await fetch(`${API_BASE_URL}/auth/notification-settings`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, 'Failed to save notification settings'),
    )
  }

  return response.json()
}

export async function unsubscribeMarketingSms(token: string) {
  const response = await fetch(`${API_BASE_URL}/auth/sms/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  if (!response.ok) {
    throw new Error('Failed to update SMS preferences')
  }
}
