import { API_BASE_URL } from '../config/env'
import {
  getStoredAcquisitionContext,
  type AcquisitionContext,
} from './acquisition'
import {
  createAnalyticsClientEventId,
  persistAnalyticsAcquisition,
  sendAnalyticsEvent,
} from './events'

export type OwnerAcquisitionFlow = 'selfServe' | 'claim' | 'pendingPhone'

export type OwnerSignupAttempt = {
  acquisition: AcquisitionContext
  clientEventId: string
  occurredAt: string
  route: string
  flowHint?: 'selfServe'
}

export type OwnerOtpVerifiedAttempt = {
  anonymousAcquisitionId: string
  clientEventId: string
  occurredAt: string
  route: string
}

function currentRoute() {
  return window.location.pathname
}

export function createOwnerSignupAttempt(
  flowHint?: 'selfServe',
): OwnerSignupAttempt | null {
  const acquisition = getStoredAcquisitionContext()
  const clientEventId = createAnalyticsClientEventId()

  if (!acquisition || !clientEventId) {
    return null
  }

  return {
    acquisition,
    clientEventId,
    occurredAt: new Date().toISOString(),
    route: currentRoute(),
    ...(flowHint ? { flowHint } : {}),
  }
}

export function createOwnerOtpVerifiedAttempt(): OwnerOtpVerifiedAttempt | null {
  const acquisition = getStoredAcquisitionContext()
  const clientEventId = createAnalyticsClientEventId()
  if (!acquisition || !clientEventId) return null

  return {
    anonymousAcquisitionId: acquisition.anonymousAcquisitionId,
    clientEventId,
    occurredAt: new Date().toISOString(),
    route: currentRoute(),
  }
}

export async function recordClaimSignupStarted(
  attempt: OwnerSignupAttempt,
) {
  return sendAnalyticsEvent({
    eventName: 'owner_signup_started',
    properties: { flow: 'claim' },
    route: attempt.route,
    clientEventId: attempt.clientEventId,
    occurredAt: attempt.occurredAt,
  })
}

export async function linkOwnerOtpVerified(input: {
  token: string
  flow: OwnerAcquisitionFlow
  attempt: OwnerOtpVerifiedAttempt
}) {
  try {
    await persistAnalyticsAcquisition()

    const response = await fetch(`${API_BASE_URL}/analytics/link`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        anonymousAcquisitionId: input.attempt.anonymousAcquisitionId,
        clientEventId: input.attempt.clientEventId,
        flow: input.flow,
        occurredAt: input.attempt.occurredAt,
        route: input.attempt.route,
      }),
    })

    return response.ok
  } catch {
    // Analytics must never block authentication or restaurant activation.
    return false
  }
}
