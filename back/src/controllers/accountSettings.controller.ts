import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { unsubscribeMarketingSms } from '../services/marketingSms.service.js'
import {
  notificationSettingsSchema,
  unsubscribeMarketingSmsSchema,
} from '../validations/accountSettings.validation.js'
import { getValidationErrorMessage } from '../utils/validation.js'

function mapNotificationSettings(settings: {
  marketingSmsEnabled: boolean
  marketingSmsConsentedAt: Date | null
  newCandidateSmsEnabled: boolean
  candidateReminderSmsEnabled: boolean
}) {
  return {
    marketingSmsEnabled: settings.marketingSmsEnabled,
    marketingSmsConsentedAt:
      settings.marketingSmsConsentedAt?.toISOString() ?? null,
    newCandidateSmsEnabled: settings.newCandidateSmsEnabled,
    candidateReminderSmsEnabled:
      settings.candidateReminderSmsEnabled,
  }
}

const notificationSettingsSelect = {
  marketingSmsEnabled: true,
  marketingSmsConsentedAt: true,
  newCandidateSmsEnabled: true,
  candidateReminderSmsEnabled: true,
} as const

export async function getNotificationSettings(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId

  if (!userId) {
    return res.status(401).json({ message: 'unauthorized' })
  }

  const settings = await prisma.user.findUnique({
    where: { id: userId },
    select: notificationSettingsSelect,
  })

  if (!settings) {
    return res.status(404).json({ message: 'user not found' })
  }

  return res.json(mapNotificationSettings(settings))
}

export async function updateNotificationSettings(
  req: Request,
  res: Response,
) {
  const userId = (req as AuthenticatedRequest).userId

  if (!userId) {
    return res.status(401).json({ message: 'unauthorized' })
  }

  const result = notificationSettingsSchema.safeParse(req.body)

  if (!result.success) {
    return res.status(400).json({
      message: getValidationErrorMessage(result.error),
    })
  }

  const now = new Date()
  const marketingSmsEnabled = result.data.marketingSmsEnabled
  const currentSettings = await prisma.user.findUnique({
    where: { id: userId },
    select: notificationSettingsSelect,
  })

  if (!currentSettings) {
    return res.status(404).json({ message: 'user not found' })
  }

  const settings = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(marketingSmsEnabled === undefined
        ? {}
        : marketingSmsEnabled === currentSettings.marketingSmsEnabled
          ? {}
          : marketingSmsEnabled
          ? {
              marketingSmsEnabled: true,
              marketingSmsConsentedAt: now,
              marketingSmsOptedOutAt: null,
            }
          : {
              marketingSmsEnabled: false,
              marketingSmsOptedOutAt: now,
            }),
      ...(result.data.newCandidateSmsEnabled === undefined
        ? {}
        : {
            newCandidateSmsEnabled:
              result.data.newCandidateSmsEnabled,
          }),
      ...(result.data.candidateReminderSmsEnabled === undefined
        ? {}
        : {
            candidateReminderSmsEnabled:
              result.data.candidateReminderSmsEnabled,
          }),
    },
    select: notificationSettingsSelect,
  })

  return res.json(mapNotificationSettings(settings))
}

export async function unsubscribeFromMarketingSms(
  req: Request,
  res: Response,
) {
  const result = unsubscribeMarketingSmsSchema.safeParse(req.body)

  if (result.success) {
    await unsubscribeMarketingSms(result.data.token)
  }

  // Deliberately return the same response for invalid, expired, used, and
  // valid tokens so this public endpoint cannot be used to enumerate users.
  return res.json({ ok: true })
}
