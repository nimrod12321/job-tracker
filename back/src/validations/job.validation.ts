import { z } from 'zod'

const jobStatusSchema = z.enum(
  ['applied', 'HR', 'technical', 'rejected', 'offer'],
  { error: 'invalid job status' },
)

function requiredText(field: string) {
  return z
    .string({ error: `${field} is required` })
    .trim()
    .min(1, `${field} is required`)
}

const wantedSalarySchema = z.coerce
  .number({ error: 'wanted salary must be a number' })
  .int('wanted salary must be a whole number')
  .optional()
  .default(0)

const notesSchema = z
  .string({ error: 'notes must be a string' })
  .optional()
  .default('')

export const createJobSchema = z.object({
  company: requiredText('company'),
  position: requiredText('position'),
  status: jobStatusSchema.optional().default('applied'),
  wantedSalary: wantedSalarySchema,
  location: requiredText('location'),
  notes: notesSchema,
})

export const updateJobSchema = z.object({
  company: requiredText('company'),
  position: requiredText('position'),
  status: jobStatusSchema,
  wantedSalary: wantedSalarySchema,
  location: requiredText('location'),
  notes: notesSchema,
})

export const updateJobStatusSchema = z.object({
  status: jobStatusSchema,
})
