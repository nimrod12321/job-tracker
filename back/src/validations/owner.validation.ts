import { z } from 'zod'
import {
  restaurantEmploymentScopes,
  restaurantRoles,
  restaurantVenueTypes,
} from './restaurant.validation.js'
import { candidateLeadStatusSchema } from './publicRestaurant.validation.js'

const optionalText = (field: string, maxLength: number) =>
  z
    .string({ error: `${field} must be a string` })
    .trim()
    .max(maxLength, `${field} is too long`)
    .optional()
    .default('')

const countWords = (value: string) => {
  const trimmedValue = value.trim()

  return trimmedValue ? trimmedValue.split(/\s+/u).length : 0
}

const limitedJobText = (
  field: string,
  maxLength: number,
  maxWords: number,
) =>
  optionalText(field, maxLength).refine(
    (value) => countWords(value) <= maxWords,
    `${field} must be ${maxWords} words or fewer`,
  )

export const ownerProfileSchema = z
  .object({
    restaurantName: optionalText('restaurant name', 200),
    contactPerson: optionalText('contact person', 150),
    phoneNumber: optionalText('phone number', 50),
    whatsappNumber: optionalText('WhatsApp number', 50),
    city: optionalText('city', 200),
    street: optionalText('street', 200),
    locationPlaceId: optionalText('location place id', 300),
    description: optionalText('description', 2_000),
    venueTypes: z
      .array(z.enum(restaurantVenueTypes, { error: 'venue type is invalid' }))
      .max(restaurantVenueTypes.length, 'too many venue types')
      .refine(
        (venueTypes) => new Set(venueTypes).size === venueTypes.length,
        'venue types must be unique',
      )
      .optional(),
  })
  .strict()

export const ownerAdditionalRestaurantSchema = ownerProfileSchema.superRefine(
  (profile, context) => {
    const requiredFields = [
      ['restaurantName', profile.restaurantName],
      ['contactPerson', profile.contactPerson],
      ['phoneNumber', profile.phoneNumber],
      ['city', profile.city],
      ['street', profile.street],
      ['description', profile.description],
      ['locationPlaceId', profile.locationPlaceId],
    ] as const

    for (const [field, value] of requiredFields) {
      if (!value.trim()) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} is required`,
        })
      }
    }
  },
)

export const ownerJobSchema = z
  .object({
    role: z.enum(restaurantRoles, {
      error: 'role is invalid',
    }),
    description: limitedJobText('description', 2_000, 18),
    requirements: limitedJobText('requirements', 2_000, 16),
    shiftInfo: optionalText('shift info', 500),
    employmentScope: z
      .enum(restaurantEmploymentScopes, {
        error: 'employment scope is invalid',
      })
      .nullable()
      .optional(),
    hourlyWage: z
      .number({ error: 'hourly wage must be a number' })
      .int('hourly wage must be a whole number')
      .min(1, 'hourly wage must be at least 1')
      .max(10_000, 'hourly wage is too high')
      .nullable()
      .optional(),
    contactPhone: optionalText('contact phone', 50),
    contactWhatsapp: optionalText('contact WhatsApp', 50),
  })
  .strict()

export const ownerJobActiveSchema = z
  .object({
    isActive: z.boolean({
      error: 'isActive must be a boolean',
    }),
  })
  .strict()

export const ownerQrEnabledRolesSchema = z
  .object({
    qrEnabledRoles: z
      .array(z.enum(restaurantRoles, { error: 'role is invalid' }))
      .max(restaurantRoles.length, 'too many QR roles'),
  })
  .strict()

export const ownerJobIdSchema = z.string().uuid('job id must be valid')

export const ownerApplicationStatusSchema = z
  .object({
    status: z.enum(['selected', 'rejected'], {
      error: 'status must be selected or rejected',
    }),
  })
  .strict()

export const ownerApplicationIdSchema = z
  .string()
  .uuid('application id must be valid')

export const ownerCandidateLeadStatusSchema = z
  .object({
    status: candidateLeadStatusSchema,
    contactChannel: z.enum(['phone', 'whatsapp']).optional(),
  })
  .strict()

export const ownerTeamMemberSchema = z
  .object({
    displayName: optionalText('name', 150),
    phoneNumber: z
      .string({ error: 'phone number is required' })
      .trim()
      .min(1, 'phone number is required')
      .max(50, 'phone number is too long'),
  })
  .strict()

export const ownerTeamMemberIdSchema = z
  .string()
  .uuid('member id must be valid')
