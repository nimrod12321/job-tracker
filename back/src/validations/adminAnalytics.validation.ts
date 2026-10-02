import { z } from 'zod'
import { ACQUISITION_FUNNEL_STAGE_KEYS } from '../config/analytics.js'

const optionalAttributionFilter = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    return trimmed || undefined
  },
  z.string().max(160).optional(),
)

export const adminAcquisitionFunnelQuerySchema = z.strictObject({
  source: optionalAttributionFilter,
  medium: optionalAttributionFilter,
  campaign: optionalAttributionFilter,
})

export const adminAcquisitionStageParamsSchema = z.strictObject({
  stage: z.enum(ACQUISITION_FUNNEL_STAGE_KEYS),
})

export const adminAcquisitionStageQuerySchema = z.strictObject({
  source: optionalAttributionFilter,
  medium: optionalAttributionFilter,
  campaign: optionalAttributionFilter,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export type AdminAcquisitionFunnelQuery = z.infer<
  typeof adminAcquisitionFunnelQuerySchema
>

export type AdminAcquisitionStageQuery = z.infer<
  typeof adminAcquisitionStageQuerySchema
>
