import { z } from 'zod'

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
  track: z.enum(['highTech', 'restaurant']).optional().default('highTech'),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})
