import { API_BASE_URL } from '../config/env'
import { getStoredAcquisitionContext } from './acquisition'

export const APPROVED_ANALYTICS_EVENT_NAMES = [
  'owner_signup_started',
  'owner_otp_verified',
  'hiring_roles_updated',
  'recruitment_kit_opened',
  'hiring_link_copied',
  'poster_download_started',
  'qr_download_started',
  'instagram_assist_opened',
  'candidate_card_opened',
  'candidate_contact_initiated',
] as const

export type AnalyticsEventName =
  (typeof APPROVED_ANALYTICS_EVENT_NAMES)[number]
type AnalyticsPropertyValue = string | number | boolean | null

type SendAnalyticsEventOptions = {
  eventName: AnalyticsEventName
  properties?: Record<string, AnalyticsPropertyValue>
  route?: string
  clientEventId?: string
  occurredAt?: string
  retryOnce?: boolean
}

export function createAnalyticsClientEventId() {
  try {
    if (typeof crypto === 'undefined') return null
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    if (typeof crypto.getRandomValues !== 'function') return null

    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0'),
    )
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-')
  } catch {
    return null
  }
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return response.ok
}

export async function persistAnalyticsAcquisition() {
  const context = getStoredAcquisitionContext()
  if (!context) return false

  try {
    return await postJson('/analytics/acquisition', {
      anonymousAcquisitionId: context.anonymousAcquisitionId,
      firstTouch: context.firstTouch,
    })
  } catch {
    return false
  }
}

export async function sendAnalyticsEvent({
  eventName,
  properties = {},
  route,
  clientEventId,
  occurredAt,
  retryOnce = true,
}: SendAnalyticsEventOptions) {
  const context = getStoredAcquisitionContext()
  if (!context) return false

  const resolvedClientEventId =
    clientEventId ?? createAnalyticsClientEventId()
  if (!resolvedClientEventId) return false

  const acquisitionStored = await persistAnalyticsAcquisition()
  if (!acquisitionStored) return false

  const body = {
    anonymousAcquisitionId: context.anonymousAcquisitionId,
    clientEventId: resolvedClientEventId,
    eventName,
    occurredAt: occurredAt ?? new Date().toISOString(),
    route: route ?? window.location.pathname,
    properties,
  }

  try {
    const sent = await postJson('/analytics/events', body)
    if (sent || !retryOnce) return sent
    return await postJson('/analytics/events', body)
  } catch {
    if (!retryOnce) return false
    try {
      return await postJson('/analytics/events', body)
    } catch {
      return false
    }
  }
}
