import { z } from 'zod'
import {
  ANALYTICS_ACQUISITION_RETENTION_DAYS,
  ANALYTICS_EVENT_PROPERTY_ALLOWLIST,
  ANALYTICS_EVENT_RETENTION_DAYS,
  APPROVED_ANALYTICS_EVENT_NAMES,
  CLIENT_ANALYTICS_EVENT_NAMES,
  OWNER_ACTIVITY_EVENT_NAMES,
  OWNER_ACQUISITION_FLOWS,
  type ApprovedAnalyticsEventName,
} from '../config/analytics.js'

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
const humanReadableAttributionSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    /^[\p{L}\p{N} ._+/()-]+$/u,
    'invalid attribution value',
  )
const optionalCampaignSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(
    /^[\p{L}\p{N} ._+/()-]+$/u,
    'invalid campaign value',
  )
  .nullable()
const hostnameSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i,
    'referrer must be a hostname only',
  )
  .nullable()
const privatePathSchema = z
  .string()
  .min(1)
  .max(500)
  .startsWith('/')
  .refine(
    (value) => !value.includes('?') && !value.includes('#'),
    'path must not contain a query string or fragment',
  )
const timestampSchema = z.iso.datetime({ offset: true })
export const anonymousAcquisitionIdSchema = z.uuid()

function validateTimestamp(
  value: string,
  retentionDays: number,
  context: z.RefinementCtx,
) {
  const timestamp = Date.parse(value)
  const now = Date.now()

  if (timestamp > now + MAX_CLOCK_SKEW_MS) {
    context.addIssue({
      code: 'custom',
      message: 'timestamp is too far in the future',
    })
  }

  if (timestamp < now - retentionDays * 24 * 60 * 60 * 1000) {
    context.addIssue({
      code: 'custom',
      message: 'timestamp is outside the retention window',
    })
  }
}

const firstTouchSchema = z
  .strictObject({
    source: humanReadableAttributionSchema,
    medium: humanReadableAttributionSchema,
    campaign: optionalCampaignSchema,
    referrer: hostnameSchema,
    direct: z.boolean(),
    landingPath: privatePathSchema,
    firstTouchedAt: timestampSchema,
  })
  .superRefine((value, context) => {
    validateTimestamp(
      value.firstTouchedAt,
      ANALYTICS_ACQUISITION_RETENTION_DAYS,
      context,
    )

    if (
      value.direct &&
      (value.source !== 'direct' ||
        value.medium !== 'none' ||
        value.campaign !== null ||
        value.referrer !== null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'direct attribution fields are inconsistent',
      })
    }

    if (!value.direct && value.source === 'direct') {
      context.addIssue({
        code: 'custom',
        message: 'non-direct attribution cannot use direct as its source',
      })
    }
  })

export const analyticsAcquisitionSchema = z.strictObject({
  anonymousAcquisitionId: anonymousAcquisitionIdSchema,
  firstTouch: firstTouchSchema,
})

const analyticsPropertyValueSchema = z.union([
  z.string().max(100),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

function validateEventDetails(
  value: {
    eventName: ApprovedAnalyticsEventName
    occurredAt: string
    properties: Record<string, string | number | boolean | null>
  },
  context: z.RefinementCtx,
) {
  validateTimestamp(
    value.occurredAt,
    ANALYTICS_EVENT_RETENTION_DAYS,
    context,
  )

  const propertyKeys = Object.keys(value.properties)
  if (propertyKeys.length > 6) {
    context.addIssue({
      code: 'custom',
      path: ['properties'],
      message: 'too many event properties',
    })
  }

  const allowedKeys = new Set(
    ANALYTICS_EVENT_PROPERTY_ALLOWLIST[value.eventName],
  )
  for (const key of propertyKeys) {
    if (!allowedKeys.has(key)) {
      context.addIssue({
        code: 'custom',
        path: ['properties', key],
        message: `property is not allowed for ${value.eventName}`,
      })
    }
  }
}

export const analyticsEventSchema = z
  .strictObject({
    anonymousAcquisitionId: anonymousAcquisitionIdSchema,
    clientEventId: z.uuid(),
    eventName: z.enum(CLIENT_ANALYTICS_EVENT_NAMES),
    occurredAt: timestampSchema,
    route: privatePathSchema.nullish(),
    properties: z
      .record(
        z.string().min(1).max(40).regex(/^[a-z][a-zA-Z0-9]*$/),
        analyticsPropertyValueSchema,
      )
      .default({}),
  })
  .superRefine((value, context) => {
    validateEventDetails(value, context)
  })

export type AnalyticsAcquisitionInput = z.infer<
  typeof analyticsAcquisitionSchema
>
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>

const ownerCandidateReferenceSchema = z.strictObject({
  kind: z.enum(['externalLead', 'jobApplication']),
  id: z.uuid(),
})

export const ownerActivityEventSchema = z
  .strictObject({
    clientEventId: z.uuid(),
    eventName: z.enum(OWNER_ACTIVITY_EVENT_NAMES),
    occurredAt: timestampSchema,
    route: privatePathSchema.nullish(),
    candidateReference: ownerCandidateReferenceSchema.optional(),
    properties: z
      .record(
        z.string().min(1).max(40).regex(/^[a-z][a-zA-Z0-9]*$/),
        analyticsPropertyValueSchema,
      )
      .default({}),
  })
  .superRefine((value, context) => {
    validateEventDetails(value, context)

    const isCandidateEvent =
      value.eventName === 'candidate_card_opened' ||
      value.eventName === 'candidate_contact_initiated'

    if (isCandidateEvent && !value.candidateReference) {
      context.addIssue({
        code: 'custom',
        path: ['candidateReference'],
        message: 'candidate reference is required for candidate activity',
      })
    }

    if (!isCandidateEvent && value.candidateReference) {
      context.addIssue({
        code: 'custom',
        path: ['candidateReference'],
        message: 'candidate reference is only allowed for candidate activity',
      })
    }

    if (isCandidateEvent && 'candidateSource' in value.properties) {
      context.addIssue({
        code: 'custom',
        path: ['properties', 'candidateSource'],
        message: 'candidate source is derived by the server',
      })
    }

    if (
      value.eventName === 'candidate_card_opened' &&
      Object.keys(value.properties).length > 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['properties'],
        message: 'candidate card open properties are derived by the server',
      })
    }

    if (value.eventName === 'candidate_contact_initiated') {
      if (
        Object.keys(value.properties).length !== 1 ||
        (value.properties.channel !== 'phone' &&
          value.properties.channel !== 'whatsapp')
      ) {
        context.addIssue({
          code: 'custom',
          path: ['properties', 'channel'],
          message: 'candidate contact channel must be phone or whatsapp',
        })
      }
    }
  })

export type OwnerActivityEventInput = z.infer<
  typeof ownerActivityEventSchema
>

export const ownerSignupAnalyticsSchema = z
  .strictObject({
    acquisition: analyticsAcquisitionSchema,
    clientEventId: z.uuid(),
    occurredAt: timestampSchema,
    route: privatePathSchema.nullish(),
    flowHint: z.enum(['selfServe']).optional(),
  })
  .superRefine((value, context) => {
    validateTimestamp(
      value.occurredAt,
      ANALYTICS_EVENT_RETENTION_DAYS,
      context,
    )
  })

export type OwnerSignupAnalyticsInput = z.infer<
  typeof ownerSignupAnalyticsSchema
>

export const ownerOtpAnalyticsAttemptSchema = z
  .strictObject({
    anonymousAcquisitionId: anonymousAcquisitionIdSchema,
    clientEventId: z.uuid(),
    occurredAt: timestampSchema,
    route: privatePathSchema.nullish(),
  })
  .superRefine((value, context) => {
    validateTimestamp(
      value.occurredAt,
      ANALYTICS_EVENT_RETENTION_DAYS,
      context,
    )
  })

export type OwnerOtpAnalyticsAttemptInput = z.infer<
  typeof ownerOtpAnalyticsAttemptSchema
>

export const ownerAcquisitionLinkSchema = z.strictObject({
  anonymousAcquisitionId: anonymousAcquisitionIdSchema,
  clientEventId: z.uuid(),
  flow: z.enum(OWNER_ACQUISITION_FLOWS),
  occurredAt: timestampSchema,
  route: privatePathSchema.nullish(),
})

export type OwnerAcquisitionLinkInput = z.infer<
  typeof ownerAcquisitionLinkSchema
>
