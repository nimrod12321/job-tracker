import { z } from 'zod'

export const notificationSettingsSchema = z
  .object({
    marketingSmsEnabled: z.boolean().optional(),
    newCandidateSmsEnabled: z.boolean().optional(),
    candidateReminderSmsEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'at least one notification setting is required',
  })

export const unsubscribeMarketingSmsSchema = z
  .object({
    token: z.string().trim().min(20).max(500),
  })
  .strict()
