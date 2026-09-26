import type { Prisma } from '../generated/prisma/client.js'
import {
  ANALYTICS_ACQUISITION_RETENTION_DAYS,
  ANALYTICS_EVENT_RETENTION_DAYS,
  type OwnerAcquisitionFlow,
  retentionDateFrom,
} from '../config/analytics.js'
import { prisma } from '../lib/prisma.js'
import type {
  AnalyticsAcquisitionInput,
  AnalyticsEventInput,
  OwnerAcquisitionLinkInput,
  OwnerOtpAnalyticsAttemptInput,
  OwnerSignupAnalyticsInput,
} from '../validations/analytics.validation.js'

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

function normalizedProperties(properties: Record<string, unknown>) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(properties).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  )
}

export async function registerAnalyticsAcquisition(
  input: AnalyticsAcquisitionInput,
) {
  const { firstTouch } = input

  try {
    const acquisition = await prisma.analyticsAcquisition.create({
      data: {
        anonymousAcquisitionId: input.anonymousAcquisitionId,
        firstSource: firstTouch.source,
        firstMedium: firstTouch.medium,
        firstCampaign: firstTouch.campaign,
        firstReferrer: firstTouch.referrer,
        direct: firstTouch.direct,
        firstLandingPath: firstTouch.landingPath,
        firstTouchedAt: new Date(firstTouch.firstTouchedAt),
        expiresAt: retentionDateFrom(
          new Date(firstTouch.firstTouchedAt),
          ANALYTICS_ACQUISITION_RETENTION_DAYS,
        ),
      },
      select: {
        id: true,
      },
    })

    return { acquisition, created: true }
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    const acquisition = await prisma.analyticsAcquisition.findUnique({
      where: {
        anonymousAcquisitionId: input.anonymousAcquisitionId,
      },
      select: {
        id: true,
      },
    })

    if (!acquisition) {
      throw error
    }

    // First-touch attribution is intentionally immutable. A repeated request
    // acknowledges the existing row and never updates its attribution fields.
    return { acquisition, created: false }
  }
}

type EventResult =
  | { status: 'created' | 'duplicate'; eventId: string }
  | { status: 'acquisition_not_found' | 'conflict' }

export async function recordAnalyticsEvent(
  input: AnalyticsEventInput,
): Promise<EventResult> {
  const acquisition = await prisma.analyticsAcquisition.findUnique({
    where: {
      anonymousAcquisitionId: input.anonymousAcquisitionId,
    },
    select: {
      id: true,
    },
  })

  if (!acquisition) {
    return { status: 'acquisition_not_found' }
  }

  try {
    const event = await prisma.analyticsEvent.create({
      data: {
        acquisitionId: acquisition.id,
        clientEventId: input.clientEventId,
        eventName: input.eventName,
        occurredAt: new Date(input.occurredAt),
        route: input.route ?? null,
        properties: input.properties as Prisma.InputJsonValue,
        expiresAt: retentionDateFrom(
          new Date(input.occurredAt),
          ANALYTICS_EVENT_RETENTION_DAYS,
        ),
      },
      select: {
        id: true,
      },
    })

    return { status: 'created', eventId: event.id }
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    const existing = await prisma.analyticsEvent.findUnique({
      where: {
        clientEventId: input.clientEventId,
      },
      select: {
        id: true,
        acquisitionId: true,
        eventName: true,
        occurredAt: true,
        route: true,
        properties: true,
      },
    })

    if (
      existing &&
      existing.acquisitionId === acquisition.id &&
      existing.eventName === input.eventName &&
      existing.occurredAt.getTime() === new Date(input.occurredAt).getTime() &&
      existing.route === (input.route ?? null) &&
      normalizedProperties(existing.properties as Record<string, unknown>) ===
        normalizedProperties(input.properties)
    ) {
      return { status: 'duplicate', eventId: existing.id }
    }

    return { status: 'conflict' }
  }
}

export async function resolveOwnerAcquisitionFlow(input: {
  phoneNumber: string
  purpose: 'login' | 'register' | 'qrApply'
  flowHint?: 'selfServe' | 'claim'
  track?: 'restaurant' | 'restaurantOwner'
}): Promise<OwnerAcquisitionFlow | null> {
  if (input.purpose === 'qrApply') {
    return null
  }

  if (
    input.purpose === 'register' &&
    input.track !== 'restaurant' &&
    input.flowHint === 'claim'
  ) {
    return 'claim'
  }

  const pendingOwnerMembership = await prisma.restaurantMember.findFirst({
    where: {
      phoneNumber: input.phoneNumber,
      userId: null,
      role: 'owner',
      status: 'pending',
    },
    select: {
      id: true,
    },
  })

  if (pendingOwnerMembership) {
    return 'pendingPhone'
  }

  if (
    input.purpose === 'register' &&
    input.track !== 'restaurant' &&
    input.flowHint === 'selfServe'
  ) {
    return 'selfServe'
  }

  return null
}

export async function recordOwnerSignupStartedFromAuth(input: {
  analytics: OwnerSignupAnalyticsInput
  phoneNumber: string
  purpose: 'login' | 'register' | 'qrApply'
}) {
  const flow = await resolveOwnerAcquisitionFlow({
    phoneNumber: input.phoneNumber,
    purpose: input.purpose,
    ...(input.analytics.flowHint
      ? { flowHint: input.analytics.flowHint }
      : {}),
  })

  if (!flow) {
    return { status: 'not_owner_intent' as const }
  }

  await registerAnalyticsAcquisition(input.analytics.acquisition)
  return recordAnalyticsEvent({
    anonymousAcquisitionId:
      input.analytics.acquisition.anonymousAcquisitionId,
    clientEventId: input.analytics.clientEventId,
    eventName: 'owner_signup_started',
    occurredAt: input.analytics.occurredAt,
    route: input.analytics.route,
    properties: { flow },
  })
}

export type OwnerLinkResult =
  | { status: 'created' | 'duplicate' }
  | { status: 'acquisition_not_found' | 'acquisition_user_conflict' | 'event_conflict' }

export type RecordOwnerOtpVerifiedInput =
  OwnerOtpAnalyticsAttemptInput & {
    userId: string
    flow: OwnerAcquisitionFlow
  }

export async function recordOwnerOtpVerified(
  input: RecordOwnerOtpVerifiedInput,
) {
  const { userId, ...eventInput } = input
  return linkOwnerAcquisitionToUser(userId, {
    ...eventInput,
    flow: input.flow,
  })
}

type OwnerOtpVerifiedRecorder = (
  input: RecordOwnerOtpVerifiedInput,
) => Promise<OwnerLinkResult>

export async function recordOwnerOtpVerifiedBestEffort(
  input: RecordOwnerOtpVerifiedInput,
  dependencies: {
    record?: OwnerOtpVerifiedRecorder
    logError?: (message: string, error?: unknown) => void
  } = {},
) {
  const record = dependencies.record ?? recordOwnerOtpVerified
  const logError = dependencies.logError ?? console.error
  const logSafely = (message: string, error?: unknown) => {
    try {
      if (error === undefined) {
        logError(message)
      } else {
        logError(message, error)
      }
    } catch {
      // Observability must never turn an analytics failure into an auth error.
    }
  }

  try {
    const result = await record(input)
    if (
      result.status !== 'created' &&
      result.status !== 'duplicate'
    ) {
      logSafely(
        `Owner OTP analytics was not recorded: ${result.status}`,
      )
    }
    return result
  } catch (error) {
    logSafely('Failed to record owner OTP analytics', error)
    return { status: 'failed' as const }
  }
}

export async function linkOwnerAcquisitionToUser(
  userId: string,
  input: OwnerAcquisitionLinkInput,
): Promise<OwnerLinkResult> {
  return prisma.$transaction(async (transaction) => {
    let acquisition = await transaction.analyticsAcquisition.findUnique({
      where: {
        anonymousAcquisitionId: input.anonymousAcquisitionId,
      },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!acquisition) {
      return { status: 'acquisition_not_found' as const }
    }

    if (acquisition.userId && acquisition.userId !== userId) {
      return { status: 'acquisition_user_conflict' as const }
    }

    if (!acquisition.userId) {
      const linked = await transaction.analyticsAcquisition.updateMany({
        where: {
          id: acquisition.id,
          userId: null,
        },
        data: {
          userId,
        },
      })

      if (linked.count === 0) {
        acquisition = await transaction.analyticsAcquisition.findUniqueOrThrow({
          where: {
            id: acquisition.id,
          },
          select: {
            id: true,
            userId: true,
          },
        })

        if (acquisition.userId !== userId) {
          return { status: 'acquisition_user_conflict' as const }
        }
      }
    }

    const properties = { flow: input.flow }

    const inserted = await transaction.analyticsEvent.createMany({
      data: [
        {
          acquisitionId: acquisition.id,
          clientEventId: input.clientEventId,
          eventName: 'owner_otp_verified',
          occurredAt: new Date(input.occurredAt),
          route: input.route ?? null,
          properties,
          expiresAt: retentionDateFrom(
            new Date(input.occurredAt),
            ANALYTICS_EVENT_RETENTION_DAYS,
          ),
        },
      ],
      skipDuplicates: true,
    })

    if (inserted.count === 1) {
      return { status: 'created' as const }
    }

    const existing = await transaction.analyticsEvent.findUnique({
      where: {
        clientEventId: input.clientEventId,
      },
      select: {
        acquisitionId: true,
        eventName: true,
        occurredAt: true,
        route: true,
        properties: true,
      },
    })

    if (
      existing &&
      existing.acquisitionId === acquisition.id &&
      existing.eventName === 'owner_otp_verified' &&
      existing.occurredAt.getTime() === new Date(input.occurredAt).getTime() &&
      existing.route === (input.route ?? null) &&
      normalizedProperties(
        existing.properties as Record<string, unknown>,
      ) === normalizedProperties(properties)
    ) {
      return { status: 'duplicate' as const }
    }

    return { status: 'event_conflict' as const }
  })
}

export async function isRestaurantEstablishedForAcquisition(
  anonymousAcquisitionId: string,
  flow: OwnerAcquisitionFlow,
) {
  const acquisition = await prisma.analyticsAcquisition.findUnique({
    where: {
      anonymousAcquisitionId,
    },
    select: {
      userId: true,
    },
  })

  if (!acquisition?.userId) {
    return false
  }

  const commonMembershipWhere = {
    userId: acquisition.userId,
    role: 'owner' as const,
    status: 'active' as const,
  }

  // Reporting derives establishment from product-owned durable facts:
  // - selfServe: the linked user owns the profile and has an active owner membership.
  // - claim: the linked user has an active owner membership and the claim is consumed.
  // - pendingPhone: the phone-created owner membership has become active for the user.
  if (flow === 'selfServe') {
    return Boolean(
      await prisma.restaurantMember.findFirst({
        where: {
          ...commonMembershipWhere,
          restaurant: {
            userId: acquisition.userId,
          },
        },
        select: { id: true },
      }),
    )
  }

  if (flow === 'claim') {
    return Boolean(
      await prisma.restaurantMember.findFirst({
        where: {
          ...commonMembershipWhere,
          restaurant: {
            claim: {
              claimedAt: {
                not: null,
              },
            },
          },
        },
        select: { id: true },
      }),
    )
  }

  return Boolean(
    await prisma.restaurantMember.findFirst({
      where: commonMembershipWhere,
      select: { id: true },
    }),
  )
}

export async function cleanupExpiredAnalytics(now = new Date()) {
  return prisma.$transaction(async (transaction) => {
    const events = await transaction.analyticsEvent.deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    })
    const acquisitions = await transaction.analyticsAcquisition.deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    })

    return {
      deletedEvents: events.count,
      deletedAcquisitions: acquisitions.count,
    }
  })
}
