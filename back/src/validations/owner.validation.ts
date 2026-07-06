import { z } from 'zod'
import { restaurantRoles } from './restaurant.validation.js'

const optionalText = (field: string, maxLength: number) =>
  z
    .string({ error: `${field} must be a string` })
    .trim()
    .max(maxLength, `${field} is too long`)
    .optional()
    .default('')

export const ownerProfileSchema = z
  .object({
    restaurantName: optionalText('restaurant name', 200),
    contactPerson: optionalText('contact person', 150),
    phoneNumber: optionalText('phone number', 50),
    whatsappNumber: optionalText('WhatsApp number', 50),
    location: optionalText('location', 200),
    area: optionalText('area', 200),
    description: optionalText('description', 2_000),
  })
  .strict()

export const ownerJobSchema = z
  .object({
    role: z.enum(restaurantRoles, {
      error: 'role is invalid',
    }),
    location: optionalText('location', 200),
    area: optionalText('area', 200),
    description: optionalText('description', 2_000),
    requirements: optionalText('requirements', 2_000),
    shiftInfo: optionalText('shift info', 500),
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

export const ownerJobIdSchema = z.string().uuid('job id must be valid')
