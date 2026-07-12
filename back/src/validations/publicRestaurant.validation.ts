import { z } from 'zod'
import { restaurantRoles } from './restaurant.validation.js'

export const restaurantSlugSchema = z
  .string()
  .trim()
  .min(1, 'restaurant slug is required')
  .max(120, 'restaurant slug is too long')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'restaurant slug is invalid')

export const candidateLeadStatusSchema = z.enum(
  ['new', 'contacted', 'relevant', 'rejected'],
  {
    error: 'status is invalid',
  },
)

export const publicRestaurantLeadSchema = z
  .object({
    fullName: z
      .string({ error: 'full name is required' })
      .trim()
      .min(1, 'full name is required')
      .max(150, 'full name is too long'),
    phoneNumber: z
      .string({ error: 'phone number is required' })
      .trim()
      .min(1, 'phone number is required')
      .max(50, 'phone number is too long'),
    wantedRoles: z
      .array(z.enum(restaurantRoles, { error: 'role is invalid' }))
      .min(1, 'choose at least one role')
      .max(restaurantRoles.length, 'too many wanted roles'),
    experienceText: z
      .string({ error: 'experience must be a string' })
      .trim()
      .max(1_000, 'experience is too long')
      .optional()
      .default(''),
    availability: z
      .string({ error: 'availability must be a string' })
      .trim()
      .max(500, 'availability is too long')
      .optional()
      .default(''),
    age: z
      .number({ error: 'age must be a number' })
      .int('age must be a whole number')
      .min(16, 'age must be at least 16')
      .max(80, 'age must be 80 or below'),
  })
  .strict()

export const verifiedPublicRestaurantLeadSchema = z
  .object({
    wantedRoles: z
      .array(z.enum(restaurantRoles, { error: 'role is invalid' }))
      .min(1, 'choose at least one role')
      .max(restaurantRoles.length, 'too many wanted roles'),
    experienceText: z
      .string({ error: 'experience must be a string' })
      .trim()
      .max(1_000, 'experience is too long')
      .optional()
      .default(''),
    availability: z
      .string({ error: 'availability must be a string' })
      .trim()
      .max(500, 'availability is too long')
      .optional()
      .default(''),
    age: z
      .number({ error: 'age must be a number' })
      .int('age must be a whole number')
      .min(16, 'age must be at least 16')
      .max(80, 'age must be 80 or below'),
  })
  .strict()

export const leadIdSchema = z.string().uuid('lead id must be valid')

export const publicRestaurantQrEventSchema = z
  .object({
    type: z.enum(['qrPageView', 'qrFormStarted'], {
      error: 'QR event type is invalid',
    }),
    sessionId: z
      .string({ error: 'session id must be a string' })
      .trim()
      .max(120, 'session id is too long')
      .regex(/^[A-Za-z0-9_-]+$/, 'session id is invalid')
      .optional(),
  })
  .strict()

export const candidateLeadStatusBodySchema = z
  .object({
    status: candidateLeadStatusSchema,
  })
  .strict()
