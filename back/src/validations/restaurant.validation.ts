import { z } from 'zod'

export const restaurantRoles = [
  'waiter',
  'bartender',
  'host',
  'floorManager',
  'cook',
] as const

const optionalText = (field: string, maxLength: number) =>
  z
    .string({ error: `${field} must be a string` })
    .trim()
    .max(maxLength, `${field} is too long`)
    .optional()
    .default('')

const ageSchema = z.preprocess(
  (value) =>
    value === '' || value === null || value === undefined ? 0 : value,
  z.coerce
    .number({ error: 'age must be a number' })
    .int('age must be a whole number')
    .min(0, 'age must be at least 0')
    .max(120, 'age must be at most 120'),
)

export const restaurantProfileSchema = z
  .object({
    fullName: optionalText('full name', 150),
    phoneNumber: optionalText('phone number', 50),
    location: optionalText('location', 200),
    wantedRoles: z
      .array(z.enum(restaurantRoles))
      .max(restaurantRoles.length, 'too many wanted roles')
      .optional()
      .default([]),
    experienceText: optionalText('experience text', 3_000),
    availability: optionalText('availability', 500),
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
