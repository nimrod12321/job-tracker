import type { Prisma } from '../generated/prisma/client.js'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import {
  prismaCandidateNotificationRepository,
  processPendingCandidateContactReminderDeliveries,
  type CandidateNotificationDeliveryRepository,
} from './candidateNotificationDelivery.service.js'
import {
  createTwilioCandidateNotificationSmsProvider,
  type CandidateNotificationSmsProvider,
} from './candidateNotificationSmsProvider.js'
import {
  selectNewCandidateNotificationRecipients,
  type RestaurantNotificationMember,
} from './restaurantCandidateNotification.service.js'

const REMINDER_AGE_MS = 24 * 60 * 60 * 1000

export type CandidateContactReminderLead = {
  id: string
  ownerProfileId: string
  source: string
  status: string
  createdAt: Date
  firstContactInitiatedAt: Date | null
  members: RestaurantNotificationMember[]
}

export type PendingCandidateContactReminderDelivery = {
  candidateLeadId: string
  recipientMemberId: string
  recipientPhone: string
  kind: 'reminder24h'
  status: 'pending'
  attemptCount: 0
}

export type CandidateContactReminderRepository = {
  findPotentiallyEligibleLeads: (
    cutoff: Date,
  ) => Promise<CandidateContactReminderLead[]>
  createReminderDeliveries: (
    deliveries: PendingCandidateContactReminderDelivery[],
  ) => Promise<number>
}

type CandidateContactReminderDependencies = {
  repository: CandidateContactReminderRepository
  deliveryRepository: CandidateNotificationDeliveryRepository
  enabled: boolean
  provider?: CandidateNotificationSmsProvider
  now?: () => Date
}

const prismaCandidateContactReminderRepository: CandidateContactReminderRepository =
  {
    async findPotentiallyEligibleLeads(cutoff) {
      const leads = await prisma.restaurantCandidateLead.findMany({
        where: getCandidateContactReminderEligibilityWhere(cutoff),
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          ownerProfileId: true,
          source: true,
          status: true,
          createdAt: true,
          firstContactInitiatedAt: true,
          ownerProfile: {
            select: {
              members: {
                where: {
                  status: 'active',
                  role: {
                    in: ['owner', 'hiringManager'],
                  },
                  userId: {
                    not: null,
                  },
                },
                orderBy: {
                  createdAt: 'asc',
                },
                select: {
                  id: true,
                  restaurantId: true,
                  userId: true,
                  phoneNumber: true,
                  role: true,
                  status: true,
                },
              },
            },
          },
        },
      })

      return leads.map(({ ownerProfile, ...lead }) => ({
        ...lead,
        members: ownerProfile.members,
      }))
    },

    async createReminderDeliveries(deliveries) {
      if (deliveries.length === 0) {
        return 0
      }

      const result =
        await prisma.restaurantCandidateNotificationDelivery.createMany({
          data: deliveries,
          skipDuplicates: true,
        })

      return result.count
    },
  }

export function getCandidateContactReminderEligibilityWhere(
  cutoff: Date,
): Prisma.RestaurantCandidateLeadWhereInput {
  return {
    source: 'qr',
    createdAt: {
      lte: cutoff,
    },
    firstContactInitiatedAt: null,
    status: {
      notIn: ['rejected', 'contacted'],
    },
  }
}

export function isCandidateContactReminderEligible(
  lead: Pick<
    CandidateContactReminderLead,
    'source' | 'status' | 'createdAt' | 'firstContactInitiatedAt'
  >,
  cutoff: Date,
) {
  return (
    lead.source === 'qr' &&
    lead.createdAt <= cutoff &&
    lead.firstContactInitiatedAt === null &&
    lead.status !== 'rejected' &&
    lead.status !== 'contacted'
  )
}

export async function dispatchCandidateContactReminders(
  dependencies: CandidateContactReminderDependencies,
) {
  const now = dependencies.now ?? (() => new Date())
  const dispatchStartedAt = now()
  const cutoff = new Date(dispatchStartedAt.getTime() - REMINDER_AGE_MS)
  const candidates =
    await dependencies.repository.findPotentiallyEligibleLeads(cutoff)
  const deliveries: PendingCandidateContactReminderDelivery[] = []

  for (const candidate of candidates) {
    if (!isCandidateContactReminderEligible(candidate, cutoff)) {
      continue
    }

    const recipients = selectNewCandidateNotificationRecipients(
      candidate.ownerProfileId,
      candidate.members,
    )

    deliveries.push(
      ...recipients.map((recipient) => ({
        candidateLeadId: candidate.id,
        recipientMemberId: recipient.recipientMemberId,
        recipientPhone: recipient.recipientPhone,
        kind: 'reminder24h' as const,
        status: 'pending' as const,
        attemptCount: 0 as const,
      })),
    )
  }

  const createdDeliveries =
    await dependencies.repository.createReminderDeliveries(deliveries)

  let deliveryResult = {
    pendingFound: 0,
    attempted: 0,
    accepted: 0,
    failed: 0,
  }

  if (dependencies.enabled) {
    if (!dependencies.provider) {
      throw new Error(
        'Candidate notification provider is required when enabled',
      )
    }

    deliveryResult =
      await processPendingCandidateContactReminderDeliveries(
        { enabled: true },
        {
          repository: dependencies.deliveryRepository,
          provider: dependencies.provider,
          now,
        },
      )
  }

  return {
    eligibleLeads: candidates.filter((candidate) =>
      isCandidateContactReminderEligible(candidate, cutoff),
    ).length,
    recipientPairs: deliveries.length,
    createdDeliveries,
    ...deliveryResult,
  }
}

export async function dispatchCandidateContactRemindersFromEnvironment() {
  const provider = env.candidateNotificationsEnabled
    ? createTwilioCandidateNotificationSmsProvider({
        accountSid: env.twilioAccountSid,
        apiKeySid: env.twilioApiKeySid,
        apiKeySecret: env.twilioApiKeySecret,
        messagingServiceSid: env.twilioMessagingServiceSid,
        frontendUrl: env.frontendUrl,
      })
    : undefined

  return dispatchCandidateContactReminders({
    repository: prismaCandidateContactReminderRepository,
    deliveryRepository: prismaCandidateNotificationRepository,
    enabled: env.candidateNotificationsEnabled,
    ...(provider ? { provider } : {}),
  })
}
