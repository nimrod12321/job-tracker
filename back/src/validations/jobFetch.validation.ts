import { z } from 'zod'

export const jobFetchRequestSchema = z.object({
  query: z
    .string({ error: 'query must be a string' })
    .trim()
    .optional()
    .default(''),
  location: z
    .string({ error: 'location must be a string' })
    .trim()
    .optional()
    .default(''),
  limit: z.coerce
    .number({ error: 'limit must be a number' })
    .int('limit must be a whole number')
    .min(1, 'limit must be at least 1')
    .max(10, 'limit must be at most 10')
    .optional()
    .default(5),
})
