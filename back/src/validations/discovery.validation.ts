import { z } from 'zod'

const requiredText = (field: string, maxLength: number) =>
  z
    .string({ error: `${field} must be a string` })
    .trim()
    .min(1, `${field} is required`)
    .max(maxLength, `${field} is too long`)

const optionalText = (field: string, maxLength: number) =>
  z
    .string({ error: `${field} must be a string` })
    .trim()
    .max(maxLength, `${field} is too long`)
    .optional()
    .default('')

export const discoveryDecisionSchema = z
  .object({
    externalId: requiredText('external id', 500),
    jobUrl: optionalText('job URL', 2_048),
    company: requiredText('company', 200),
    position: requiredText('position', 200),
    location: optionalText('location', 200),
    source: requiredText('source', 100),
    jobDescription: optionalText('job description', 20_000),
    salaryText: optionalText('salary text', 300),
    estimatedSalary: optionalText('estimated salary', 300),
    summary: optionalText('summary', 1_000),
    fitScore: z
      .number({ error: 'fit score must be a number' })
      .int('fit score must be a whole number')
      .min(0, 'fit score must be at least 0')
      .max(100, 'fit score must be at most 100')
      .optional()
      .default(0),
    fitReason: optionalText('fit reason', 1_000),
    decision: z.enum(['liked', 'disliked'], {
      error: 'decision must be liked or disliked',
    }),
  })
  .strict()
