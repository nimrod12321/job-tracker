import { z } from 'zod'

const optionalText = (field: string, maxLength: number) =>
  z
    .string({ error: `${field} must be a string` })
    .trim()
    .max(maxLength, `${field} is too long`)
    .optional()
    .default('')

const patchText = (field: string, maxLength: number) =>
  z
    .string({ error: `${field} must be a string` })
    .trim()
    .max(maxLength, `${field} is too long`)
    .optional()

export const adminRestaurantIdSchema = z
  .string()
  .uuid('restaurant id must be valid')

export const adminRestaurantCreateSchema = z
  .object({
    restaurantName: z
      .string({ error: 'restaurant name is required' })
      .trim()
      .min(1, 'restaurant name is required')
      .max(200, 'restaurant name is too long'),
    slug: optionalText('slug', 120),
    contactPerson: optionalText('contact person', 150),
    ownerLoginPhone: optionalText('owner login phone', 50),
    phoneNumber: optionalText('phone number', 50),
    whatsappNumber: optionalText('WhatsApp number', 50),
    city: optionalText('city', 200),
    street: optionalText('street', 200),
    locationPlaceId: optionalText('location place id', 300),
    description: optionalText('description', 2_000),
  })
  .strict()

export const adminRestaurantUpdateSchema = z
  .object({
    restaurantName: patchText('restaurant name', 200).refine(
      (value) => value === undefined || value.length > 0,
      'restaurant name is required',
    ),
    slug: patchText('slug', 120),
    contactPerson: patchText('contact person', 150),
    ownerLoginPhone: patchText('owner login phone', 50),
    phoneNumber: patchText('phone number', 50),
    whatsappNumber: patchText('WhatsApp number', 50),
    city: patchText('city', 200),
    street: patchText('street', 200),
    description: patchText('description', 2_000),
  })
  .strict()

export const adminRestaurantLocationSchema = z
  .object({
    placeId: z
      .string({ error: 'place id is required' })
      .trim()
      .min(1, 'place id is required')
      .max(300, 'place id is too long'),
  })
  .strict()
