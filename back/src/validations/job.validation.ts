import { z } from 'zod'

const jobStatusSchema = z.enum(
  ['applied', 'HR', 'technical', 'rejected', 'offer'],
  { error: 'invalid job status' },
)

const jobPrioritySchema = z.enum(['low', 'medium', 'high'], {
  error: 'invalid job priority',
})

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

const optionalText = (field: string) =>
  z
    .string({ error: `${field} must be a string` })
    .optional()
    .default('')

const optionalNumber = (field: string) =>
  z.coerce
    .number({ error: `${field} must be a number` })
    .int(`${field} must be a whole number`)
    .optional()
    .default(0)

const dateAppliedSchema = z
  .string({ error: 'date applied must be a string' })
  .trim()
  .refine((value) => {
    if (value === '') {
      return true
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false
    }

    const date = new Date(`${value}T00:00:00.000Z`)

    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    )
  }, 'date applied must be a valid date')
  .optional()
  .default('')

const richJobFields = {
  jobDescription: optionalText('job description'),
  jobUrl: optionalText('job URL'),
  companyUrl: optionalText('company URL'),
  source: optionalText('source'),
  priority: jobPrioritySchema.optional().default('medium'),
  dateApplied: dateAppliedSchema,
  salaryMin: optionalNumber('salary minimum'),
  salaryMax: optionalNumber('salary maximum'),
}

export const createJobSchema = z.object({
  company: requiredText('company'),
  position: requiredText('position'),
  status: jobStatusSchema.optional().default('applied'),
  wantedSalary: wantedSalarySchema,
  location: requiredText('location'),
  notes: notesSchema,
  ...richJobFields,
})

export const updateJobSchema = z.object({
  company: requiredText('company'),
  position: requiredText('position'),
  status: jobStatusSchema,
  wantedSalary: wantedSalarySchema,
  location: requiredText('location'),
  notes: notesSchema,
  ...richJobFields,
})

export const updateJobStatusSchema = z.object({
  status: jobStatusSchema,
})
