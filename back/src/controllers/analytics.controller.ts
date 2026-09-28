import type { Request, Response } from 'express'
import {
  ANALYTICS_MAX_REQUEST_BYTES,
  OWNER_ACTIVITY_EVENT_NAMES,
} from '../config/analytics.js'
import {
  recordAuthenticatedOwnerActivity,
  recordOwnerOtpVerified,
  recordAnalyticsEvent,
  registerAnalyticsAcquisition,
} from '../services/analytics.service.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { getRestaurantAccessForUser } from '../services/restaurantAccess.service.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  analyticsAcquisitionSchema,
  analyticsEventSchema,
  ownerActivityEventSchema,
  ownerAcquisitionLinkSchema,
} from '../validations/analytics.validation.js'

function requestBodyIsTooLarge(body: unknown) {
  try {
    return (
      Buffer.byteLength(JSON.stringify(body ?? null), 'utf8') >
      ANALYTICS_MAX_REQUEST_BYTES
    )
  } catch {
    return true
  }
}

export async function createAnalyticsAcquisition(
  req: Request,
  res: Response,
) {
  try {
    if (requestBodyIsTooLarge(req.body)) {
      return res.status(413).json({ message: 'analytics payload is too large' })
    }

    const result = analyticsAcquisitionSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const stored = await registerAnalyticsAcquisition(result.data)
    return res.status(stored.created ? 201 : 200).json({
      ok: true,
      created: stored.created,
    })
  } catch (error) {
    console.error('Failed to register analytics acquisition:', error)
    return res.status(500).json({ message: 'failed to store analytics data' })
  }
}

export async function createAnalyticsEvent(req: Request, res: Response) {
  try {
    if (requestBodyIsTooLarge(req.body)) {
      return res.status(413).json({ message: 'analytics payload is too large' })
    }

    const result = analyticsEventSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    if (
      OWNER_ACTIVITY_EVENT_NAMES.includes(
        result.data.eventName as (typeof OWNER_ACTIVITY_EVENT_NAMES)[number],
      )
    ) {
      return res.status(403).json({
        message: 'authenticated restaurant access is required for this event',
      })
    }

    const stored = await recordAnalyticsEvent(result.data)
    if (stored.status === 'acquisition_not_found') {
      return res.status(404).json({ message: 'analytics acquisition not found' })
    }
    if (stored.status === 'conflict') {
      return res.status(409).json({
        message: 'client event id was already used for different event data',
      })
    }

    return res.status(stored.status === 'created' ? 201 : 200).json({
      ok: true,
      created: stored.status === 'created',
    })
  } catch (error) {
    console.error('Failed to record analytics event:', error)
    return res.status(500).json({ message: 'failed to store analytics event' })
  }
}

export async function createOwnerActivityEvent(
  req: Request,
  res: Response,
) {
  try {
    const userId = (req as AuthenticatedRequest).userId
    if (!userId) {
      return res.status(401).json({ message: 'unauthorized' })
    }

    if (requestBodyIsTooLarge(req.body)) {
      return res.status(413).json({ message: 'analytics payload is too large' })
    }

    const result = ownerActivityEventSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    // Owner APIs consistently resolve the user's primary active restaurant.
    // No client restaurant id is accepted or trusted by this endpoint.
    const access = await getRestaurantAccessForUser(userId)
    if (!access) {
      return res.status(403).json({ message: 'restaurant access required' })
    }

    const stored = await recordAuthenticatedOwnerActivity(
      userId,
      result.data,
    )
    if (stored.status === 'acquisition_not_found') {
      return res.status(404).json({
        message: 'linked analytics acquisition not found',
      })
    }
    if (stored.status === 'conflict') {
      return res.status(409).json({
        message: 'client event id was already used for different event data',
      })
    }

    return res.status(stored.status === 'created' ? 201 : 200).json({
      ok: true,
      created: stored.status === 'created',
    })
  } catch (error) {
    console.error('Failed to record authenticated owner activity:', error)
    return res.status(500).json({ message: 'failed to store analytics event' })
  }
}

export async function linkOwnerAcquisition(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).userId
    if (!userId) {
      return res.status(401).json({ message: 'unauthorized' })
    }

    if (requestBodyIsTooLarge(req.body)) {
      return res.status(413).json({ message: 'analytics payload is too large' })
    }

    const result = ownerAcquisitionLinkSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const authenticatedRequest = req as AuthenticatedRequest
    if (
      authenticatedRequest.authMethod !== 'otp' ||
      authenticatedRequest.ownerAcquisitionId !==
        result.data.anonymousAcquisitionId ||
      authenticatedRequest.ownerAcquisitionFlow !== result.data.flow
    ) {
      return res.status(403).json({
        message: 'owner OTP verification is required for this analytics link',
      })
    }

    const linked = await recordOwnerOtpVerified({
      userId,
      ...result.data,
    })
    if (linked.status === 'acquisition_not_found') {
      return res.status(404).json({ message: 'analytics acquisition not found' })
    }
    if (linked.status === 'acquisition_user_conflict') {
      console.warn(
        'Rejected analytics acquisition relink to a different authenticated user',
      )
      return res.status(409).json({
        message: 'analytics acquisition is already linked to another user',
      })
    }
    if (linked.status === 'event_conflict') {
      return res.status(409).json({
        message: 'client event id was already used for different event data',
      })
    }

    return res.status(linked.status === 'created' ? 201 : 200).json({
      ok: true,
      created: linked.status === 'created',
    })
  } catch (error) {
    console.error('Failed to link owner analytics acquisition:', error)
    return res.status(500).json({ message: 'failed to link analytics data' })
  }
}
