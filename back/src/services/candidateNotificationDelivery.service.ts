import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import {
  createTwilioCandidateNotificationSmsProvider,
  getCandidateNotificationSafeErrorCode,
  type CandidateNotificationSmsProvider,
} from './candidateNotificationSmsProvider.js'

export type PendingCandidateNotificationDelivery = {
  id: string
  recipientPhone: string
  attemptCount: number
}

export type CandidateNotificationDeliveryRepository = {
  findPendingNewCandidateDeliveries: (
    candidateLeadId: string,
  ) => Promise<PendingCandidateNotificationDelivery[]>
  claimPendingAttempt: (
    delivery: PendingCandidateNotificationDelivery,
    attemptedAt: Date,
  ) => Promise<boolean>
  markAccepted: (
    deliveryId: string,
    acceptedAt: Date,
    providerMessageSid: string,
  ) => Promise<void>
  markFailed: (
    deliveryId: string,
    safeErrorCode: string,
  ) => Promise<void>
}

type CandidateNotificationProcessorDependencies = {
  repository: CandidateNotificationDeliveryRepository
  provider: CandidateNotificationSmsProvider
  now?: () => Date
  logError?: (message: string, details: { safeErrorCode: string }) => void
}

const prismaCandidateNotificationRepository: CandidateNotificationDeliveryRepository =
  {
    findPendingNewCandidateDeliveries(candidateLeadId) {
      return prisma.restaurantCandidateNotificationDelivery.findMany({
        where: {
          candidateLeadId,
          kind: 'newCandidate',
          status: 'pending',
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          recipientPhone: true,
          attemptCount: true,
        },
      })
    },

    async claimPendingAttempt(delivery, attemptedAt) {
      const result =
        await prisma.restaurantCandidateNotificationDelivery.updateMany({
          where: {
            id: delivery.id,
            kind: 'newCandidate',
            status: 'pending',
            attemptCount: 0,
            lastAttemptAt: null,
          },
          data: {
            attemptCount: {
              increment: 1,
            },
            lastAttemptAt: attemptedAt,
          },
        })

      return result.count === 1
    },

    async markAccepted(deliveryId, acceptedAt, providerMessageSid) {
      await prisma.restaurantCandidateNotificationDelivery.update({
        where: {
          id: deliveryId,
        },
        data: {
          status: 'accepted',
          acceptedAt,
          providerMessageSid,
          safeErrorCode: null,
        },
      })
    },

    async markFailed(deliveryId, safeErrorCode) {
      await prisma.restaurantCandidateNotificationDelivery.update({
        where: {
          id: deliveryId,
        },
        data: {
          status: 'failed',
          acceptedAt: null,
          providerMessageSid: null,
          safeErrorCode,
        },
      })
    },
  }

export async function processNewCandidateNotificationDeliveries(
  input: {
    candidateLeadId: string
    enabled: boolean
  },
  dependencies: CandidateNotificationProcessorDependencies,
) {
  if (!input.enabled) {
    return
  }

  const now = dependencies.now ?? (() => new Date())
  const logError = dependencies.logError ?? console.error
  const deliveries =
    await dependencies.repository.findPendingNewCandidateDeliveries(
      input.candidateLeadId,
    )

  for (const delivery of deliveries) {
    try {
      const attemptedAt = now()
      const claimed = await dependencies.repository.claimPendingAttempt(
        delivery,
        attemptedAt,
      )

      if (!claimed) {
        continue
      }

      try {
        const result =
          await dependencies.provider.sendNewCandidateNotification(
            delivery.recipientPhone,
          )

        await dependencies.repository.markAccepted(
          delivery.id,
          now(),
          result.providerMessageSid,
        )
      } catch (error) {
        const safeErrorCode =
          getCandidateNotificationSafeErrorCode(error)

        await dependencies.repository.markFailed(
          delivery.id,
          safeErrorCode,
        )
      }
    } catch {
      logError('Failed to persist candidate notification delivery result', {
        safeErrorCode: 'candidate_notification_persistence_failed',
      })
    }
  }
}

export async function processNewCandidateNotificationsBestEffort(
  candidateLeadId: string,
) {
  if (!env.candidateNotificationsEnabled) {
    return
  }

  try {
    const provider = createTwilioCandidateNotificationSmsProvider({
      accountSid: env.twilioAccountSid,
      apiKeySid: env.twilioApiKeySid,
      apiKeySecret: env.twilioApiKeySecret,
      messagingServiceSid: env.twilioMessagingServiceSid,
    })

    await processNewCandidateNotificationDeliveries(
      {
        candidateLeadId,
        enabled: true,
      },
      {
        repository: prismaCandidateNotificationRepository,
        provider,
      },
    )
  } catch {
    console.error('Failed to process new-candidate notifications', {
      safeErrorCode: 'candidate_notification_processing_failed',
    })
  }
}
