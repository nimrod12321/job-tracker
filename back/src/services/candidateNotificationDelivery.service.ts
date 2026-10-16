import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'
import {
  createTwilioCandidateNotificationSmsProvider,
  getCandidateNotificationSafeErrorCode,
  type CandidateNotificationKind,
  type CandidateNotificationSmsProvider,
} from './candidateNotificationSmsProvider.js'

export type PendingCandidateNotificationDelivery = {
  id: string
  recipientPhone: string
  attemptCount: number
  kind: CandidateNotificationKind
}

export type CandidateNotificationDeliveryRepository = {
  findPendingDeliveries: (
    kind: CandidateNotificationKind,
    candidateLeadId?: string,
  ) => Promise<PendingCandidateNotificationDelivery[]>
  claimPendingAttempt: (
    delivery: PendingCandidateNotificationDelivery,
    attemptedAt: Date,
  ) => Promise<boolean>
  claimPendingReminderBatch: (
    deliveries: PendingCandidateNotificationDelivery[],
    attemptedAt: Date,
  ) => Promise<string[]>
  markAccepted: (
    deliveryId: string,
    acceptedAt: Date,
    providerMessageSid: string,
  ) => Promise<void>
  markFailed: (
    deliveryId: string,
    safeErrorCode: string,
  ) => Promise<void>
  markReminderBatchAccepted: (
    deliveryIds: string[],
    acceptedAt: Date,
    providerMessageSid: string,
  ) => Promise<void>
  markReminderBatchFailed: (
    deliveryIds: string[],
    safeErrorCode: string,
  ) => Promise<void>
}

type CandidateNotificationProcessorDependencies = {
  repository: CandidateNotificationDeliveryRepository
  provider: CandidateNotificationSmsProvider
  now?: () => Date
  logError?: (message: string, details: { safeErrorCode: string }) => void
}

export const prismaCandidateNotificationRepository: CandidateNotificationDeliveryRepository =
  {
    findPendingDeliveries(kind, candidateLeadId) {
      return prisma.restaurantCandidateNotificationDelivery.findMany({
        where: {
          ...(candidateLeadId ? { candidateLeadId } : {}),
          kind,
          status: 'pending',
          attemptCount: 0,
          lastAttemptAt: null,
          ...(kind === 'reminder24h'
            ? {
                candidateLead: {
                  source: 'qr',
                  firstContactInitiatedAt: null,
                  status: {
                    notIn: ['rejected', 'contacted'],
                  },
                },
              }
            : {}),
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          recipientPhone: true,
          attemptCount: true,
          kind: true,
        },
      })
    },

    async claimPendingAttempt(delivery, attemptedAt) {
      const result =
        await prisma.restaurantCandidateNotificationDelivery.updateMany({
          where: {
            id: delivery.id,
            kind: delivery.kind,
            status: 'pending',
            attemptCount: 0,
            lastAttemptAt: null,
            ...(delivery.kind === 'reminder24h'
              ? {
                  candidateLead: {
                    source: 'qr',
                    firstContactInitiatedAt: null,
                    status: {
                      notIn: ['rejected', 'contacted'],
                    },
                  },
                }
              : {}),
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

    async claimPendingReminderBatch(deliveries, attemptedAt) {
      const claimed =
        await prisma.restaurantCandidateNotificationDelivery.updateManyAndReturn(
          {
            where: {
              id: {
                in: deliveries.map(({ id }) => id),
              },
              kind: 'reminder24h',
              status: 'pending',
              attemptCount: 0,
              lastAttemptAt: null,
              candidateLead: {
                source: 'qr',
                firstContactInitiatedAt: null,
                status: {
                  notIn: ['rejected', 'contacted'],
                },
              },
            },
            data: {
              attemptCount: {
                increment: 1,
              },
              lastAttemptAt: attemptedAt,
            },
            select: {
              id: true,
            },
          },
        )

      return claimed.map(({ id }) => id)
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

    async markReminderBatchAccepted(
      deliveryIds,
      acceptedAt,
      providerMessageSid,
    ) {
      await prisma.restaurantCandidateNotificationDelivery.updateMany({
        where: {
          id: {
            in: deliveryIds,
          },
          kind: 'reminder24h',
        },
        data: {
          status: 'accepted',
          acceptedAt,
          providerMessageSid,
          safeErrorCode: null,
        },
      })
    },

    async markReminderBatchFailed(deliveryIds, safeErrorCode) {
      await prisma.restaurantCandidateNotificationDelivery.updateMany({
        where: {
          id: {
            in: deliveryIds,
          },
          kind: 'reminder24h',
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

  const deliveries = await dependencies.repository.findPendingDeliveries(
    'newCandidate',
    input.candidateLeadId,
  )

  return processCandidateNotificationDeliveryAttempts(
    deliveries,
    dependencies,
  )
}

export async function processPendingCandidateContactReminderDeliveries(
  input: { enabled: boolean },
  dependencies: CandidateNotificationProcessorDependencies,
) {
  if (!input.enabled) {
    return emptyProcessingResult()
  }

  const deliveries = await dependencies.repository.findPendingDeliveries(
    'reminder24h',
  )

  return processGroupedCandidateContactReminderDeliveries(
    deliveries,
    dependencies,
  )
}

async function processGroupedCandidateContactReminderDeliveries(
  deliveries: PendingCandidateNotificationDelivery[],
  dependencies: CandidateNotificationProcessorDependencies,
) {
  const now = dependencies.now ?? (() => new Date())
  const logError = dependencies.logError ?? console.error
  const result = {
    ...emptyProcessingResult(),
    pendingFound: deliveries.length,
  }
  const deliveriesByPhone = new Map<
    string,
    PendingCandidateNotificationDelivery[]
  >()

  for (const delivery of deliveries) {
    try {
      const normalizedPhone = normalizeIsraeliPhoneNumber(
        delivery.recipientPhone,
      )
      const phoneDeliveries = deliveriesByPhone.get(normalizedPhone) ?? []
      phoneDeliveries.push(delivery)
      deliveriesByPhone.set(normalizedPhone, phoneDeliveries)
    } catch {
      logError('Skipped invalid candidate reminder recipient phone', {
        safeErrorCode: 'candidate_notification_invalid_recipient',
      })
    }
  }

  for (const [recipientPhone, phoneDeliveries] of deliveriesByPhone) {
    try {
      const claimedIds =
        await dependencies.repository.claimPendingReminderBatch(
          phoneDeliveries,
          now(),
        )

      if (claimedIds.length === 0) {
        continue
      }

      result.attempted += claimedIds.length

      let providerResult: { providerMessageSid: string }

      try {
        providerResult =
          await dependencies.provider.sendCandidateNotification(
            recipientPhone,
            'reminder24h',
            claimedIds.length,
          )
      } catch (error) {
        const safeErrorCode =
          getCandidateNotificationSafeErrorCode(error)

        await dependencies.repository.markReminderBatchFailed(
          claimedIds,
          safeErrorCode,
        )
        result.failed += claimedIds.length
        continue
      }

      await dependencies.repository.markReminderBatchAccepted(
        claimedIds,
        now(),
        providerResult.providerMessageSid,
      )
      result.accepted += claimedIds.length
    } catch {
      logError('Failed to persist candidate notification delivery result', {
        safeErrorCode: 'candidate_notification_persistence_failed',
      })
    }
  }

  return result
}

function emptyProcessingResult() {
  return {
    pendingFound: 0,
    attempted: 0,
    accepted: 0,
    failed: 0,
  }
}

async function processCandidateNotificationDeliveryAttempts(
  deliveries: PendingCandidateNotificationDelivery[],
  dependencies: CandidateNotificationProcessorDependencies,
) {
  const now = dependencies.now ?? (() => new Date())
  const logError = dependencies.logError ?? console.error
  const result = {
    ...emptyProcessingResult(),
    pendingFound: deliveries.length,
  }

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

      result.attempted += 1

      try {
        const providerResult =
          await dependencies.provider.sendCandidateNotification(
            delivery.recipientPhone,
            delivery.kind,
          )

        await dependencies.repository.markAccepted(
          delivery.id,
          now(),
          providerResult.providerMessageSid,
        )
        result.accepted += 1
      } catch (error) {
        const safeErrorCode =
          getCandidateNotificationSafeErrorCode(error)

        await dependencies.repository.markFailed(
          delivery.id,
          safeErrorCode,
        )
        result.failed += 1
      }
    } catch {
      logError('Failed to persist candidate notification delivery result', {
        safeErrorCode: 'candidate_notification_persistence_failed',
      })
    }
  }

  return result
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
      frontendUrl: env.frontendUrl,
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
