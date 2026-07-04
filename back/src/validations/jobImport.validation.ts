import { z } from 'zod'

const optionalInputText = (field: string) =>
  z
    .string({ error: `${field} must be a string` })
    .optional()
    .default('')

export const jobImportRequestSchema = z.object({
  jobDescription: z
    .string({ error: 'job description is required' })
    .refine(
      (value) => value.trim().length > 0,
      'job description is required',
    ),
  jobUrl: optionalInputText('job URL'),
  source: optionalInputText('source'),
})

const extractedText = z.string()
const extractedSalary = z.number().int().min(0)

export const extractedJobFieldsSchema = z
  .object({
    company: extractedText,
    position: extractedText,
    location: extractedText,
    wantedSalary: extractedSalary,
    salaryMin: extractedSalary,
    salaryMax: extractedSalary,
    companyUrl: extractedText,
    notes: extractedText,
  })
  .strict()

export type ExtractedJobFields = z.infer<
  typeof extractedJobFieldsSchema
>
