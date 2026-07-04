import { z } from 'zod'

const basicText = (field: string) =>
  z
    .string({ error: `${field} must be a string` })
    .trim()
    .optional()
    .default('')

const longText = (field: string) =>
  z
    .string({ error: `${field} must be a string` })
    .optional()
    .default('')

const salaryExpectation = z.preprocess(
  (value) =>
    value === '' || value === null || value === undefined ? 0 : value,
  z.coerce
    .number({ error: 'salary expectation must be a number' })
    .int('salary expectation must be a whole number'),
)

export const updateProfileSchema = z.object({
  fullName: basicText('full name'),
  targetRole: basicText('target role'),
  location: basicText('location'),
  salaryExpectation,
  skills: basicText('skills'),
  experienceText: longText('experience text'),
  resumeText: longText('resume text'),
})
