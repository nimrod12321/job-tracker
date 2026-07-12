import { z } from 'zod'

export const restaurantRoles = [
  'waiter',
  'bartender',
  'host',
  'floorManager',
  'cook',
  'barista',
  'socialManager',
] as const

export const defaultQrEnabledRoles = [
  'waiter',
  'bartender',
  'host',
  'cook',
  'floorManager',
] as const

const optionalText = (field: string, maxLength: number) =>
  z
    .string({ error: `${field} must be a string` })
    .trim()
    .max(maxLength, `${field} is too long`)
    .optional()
    .default('')

const requiredText = (field: string, maxLength: number) =>
  z
    .string({ error: `${field} must be a string` })
    .trim()
    .min(1, `${field} is required`)
    .max(maxLength, `${field} is too long`)

export const workerExperienceLevels = [
  'No experience',
  '1 year',
  '2 years',
  '3 years',
  'More than 3 years',
] as const

export const workerAvailabilityOptions = [
  'Morning',
  'Afternoon',
  'Evening',
  'Night',
  'Weekends',
  'Flexible',
] as const

const ageSchema = z.preprocess(
  (value) =>
    value === '' || value === null || value === undefined ? 0 : value,
  z.coerce
    .number({ error: 'age must be a number' })
    .int('age must be a whole number')
    .min(16, 'age must be at least 16')
    .max(80, 'age must be at most 80'),
)

export const restaurantProfileSchema = z
  .object({
    fullName: requiredText('full name', 150),
    phoneNumber: requiredText('phone number', 50),
    location: optionalText('location', 200),
    wantedRoles: z
      .array(z.enum(restaurantRoles))
      .min(1, 'choose at least one wanted role')
      .max(restaurantRoles.length, 'too many wanted roles')
      .default([]),
    experienceText: requiredText('experience text', 3_000).refine(
      (value) => {
        const [experienceLevel = ''] = value.trim().split(/\n{2,}/)

        return workerExperienceLevels.includes(
          experienceLevel.trim() as (typeof workerExperienceLevels)[number],
        )
      },
      {
        message: 'experience must be one of the allowed options',
      },
    ),
    availability: requiredText('availability', 500).refine(
      (value) => {
        const selectedAvailability = value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)

        return (
          selectedAvailability.length > 0 &&
          selectedAvailability.every((item) =>
            workerAvailabilityOptions.includes(
              item as (typeof workerAvailabilityOptions)[number],
            ),
          )
        )
      },
      {
        message: 'availability must use the allowed options',
      },
    ),
    age: ageSchema,
  })
  .strict()

export const restaurantExploreSchema = z
  .object({
    limit: z
      .number({ error: 'limit must be a number' })
      .int('limit must be a whole number')
      .min(1, 'limit must be at least 1')
      .max(10, 'limit must be at most 10')
      .optional()
      .default(10),
    excludeJobIds: z
      .array(
        z
          .string({ error: 'excluded job id must be a string' })
          .uuid('excluded job id must be valid'),
      )
      .max(100, 'too many excluded job ids')
      .optional()
      .default([]),
  })
  .strict()

export const restaurantApplicationSchema = z
  .object({
    restaurantJobId: z
      .string({ error: 'restaurant job id is required' })
      .uuid('restaurant job id must be valid'),
  })
  .strict()
