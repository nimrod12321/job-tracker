import { z } from 'zod'
import { env } from '../config/env.js'

const requiredCredentialsMessage = 'email and password are required'

const emailSchema = z
  .string({ error: requiredCredentialsMessage })
  .trim()
  .min(1, requiredCredentialsMessage)

const passwordSchema = z
  .string({ error: requiredCredentialsMessage })
  .min(1, requiredCredentialsMessage)

export const registerSchema = z.object({
  email: emailSchema.email('invalid email'),
  password: passwordSchema.min(6, 'password must be at least 6 characters'),
  track: z
    .enum(['highTech', 'restaurant', 'restaurantOwner'])
    .optional()
    .default('highTech'),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const otpPurposeSchema = z.enum(['login', 'register', 'qrApply'])

export const requestCodeSchema = z
  .object({
    phoneNumber: z
      .string({ error: 'phone number is required' })
      .trim()
      .min(1, 'phone number is required')
      .max(50, 'phone number is too long'),
    purpose: otpPurposeSchema,
  })
  .strict()

export const verifyCodeSchema = z
  .object({
    phoneNumber: z
      .string({ error: 'phone number is required' })
      .trim()
      .min(1, 'phone number is required')
      .max(50, 'phone number is too long'),
    code: z
      .string({ error: 'code is required' })
      .regex(
        new RegExp(`^\\d{${env.otpCodeLength}}$`),
        `code must be exactly ${env.otpCodeLength} digits`,
      ),
    purpose: z.enum(['login', 'register', 'qrApply']),
    fullName: z
      .string({ error: 'full name must be a string' })
      .trim()
      .max(150, 'full name is too long')
      .optional(),
    track: z.enum(['restaurant', 'restaurantOwner']).optional(),
  })
  .strict()
