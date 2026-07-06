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
    city: optionalText('city', 200),
    street: optionalText('street', 200),
    description: optionalText('description', 2_000),
  })
  .strict()

export const ownerJobSchema = z
  .object({
    role: z.enum(restaurantRoles, {
      error: 'role is invalid',
    }),
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
