import { z } from 'zod'

export const adminCandidateFollowUpStatuses = [
  'notContacted',
  'contacted',
  'lookingForJob',
  'foundJobElsewhere',
  'hiredByAdmin',
] as const

export const adminOpportunityConsentStatuses = [
  'notAsked',
  'yes',
  'no',
] as const

export const adminCandidateFollowUpFilters = [
  'notContacted',
  'inProgress',
  'closed',
  'all',
] as const

export const adminCandidateFollowUpQuerySchema = z
  .object({
    filter: z.enum(adminCandidateFollowUpFilters).default('notContacted'),
    search: z.string().trim().max(100).default(''),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()

export const adminCandidateReferenceSchema = z
  .object({
    source: z.enum(['qr', 'jobBoard', 'followUp']),
    id: z.string().uuid('candidate reference is invalid'),
  })
  .strict()

export const adminCandidateFollowUpUpdateSchema = z
  .object({
    candidate: adminCandidateReferenceSchema,
    status: z.enum(adminCandidateFollowUpStatuses).optional(),
    privateNote: z.string().trim().max(2_000).optional(),
    nextFollowUpAt: z.iso.datetime().nullable().optional(),
    opportunityConsent: z
      .enum(adminOpportunityConsentStatuses)
      .optional(),
    opportunityConsentMethod: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.status !== undefined ||
      input.privateNote !== undefined ||
      input.nextFollowUpAt !== undefined ||
      input.opportunityConsent !== undefined ||
      input.opportunityConsentMethod !== undefined,
    'at least one follow-up field is required',
  )
