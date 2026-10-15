import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'

const NOTIFICATION_MEMBER_ROLES = new Set([
  'owner',
  'hiringManager',
])

export type RestaurantNotificationMember = {
  id: string
  restaurantId: string
  userId: string | null
  phoneNumber: string
  role: string
  status: string
}

export type CandidateNotificationRecipient = {
  recipientMemberId: string
  recipientPhone: string
}

export type PendingNewCandidateDelivery = {
  candidateLeadId: string
  recipientMemberId: string
  recipientPhone: string
  kind: 'newCandidate'
  status: 'pending'
  attemptCount: 0
}

export function selectNewCandidateNotificationRecipients(
  restaurantId: string,
  members: RestaurantNotificationMember[],
) {
  const recipientsByPhone = new Map<
    string,
    CandidateNotificationRecipient
  >()

  for (const member of members) {
    if (
      member.restaurantId !== restaurantId ||
      member.status !== 'active' ||
      !member.userId ||
      !NOTIFICATION_MEMBER_ROLES.has(member.role)
    ) {
      continue
    }

    let recipientPhone: string

    try {
      recipientPhone = normalizeIsraeliPhoneNumber(member.phoneNumber)
    } catch {
      continue
    }

    if (!recipientsByPhone.has(recipientPhone)) {
      recipientsByPhone.set(recipientPhone, {
        recipientMemberId: member.id,
        recipientPhone,
      })
    }
  }

  return [...recipientsByPhone.values()]
}

export async function createLeadWithPendingNewCandidateDeliveries<
  TLead extends { id: string },
>(
  recipients: CandidateNotificationRecipient[],
  operations: {
    createLead: () => Promise<TLead>
    createDeliveries: (
      deliveries: PendingNewCandidateDelivery[],
    ) => Promise<void>
  },
) {
  const lead = await operations.createLead()
  const deliveries = recipients.map((recipient) => ({
    candidateLeadId: lead.id,
    recipientMemberId: recipient.recipientMemberId,
    recipientPhone: recipient.recipientPhone,
    kind: 'newCandidate' as const,
    status: 'pending' as const,
    attemptCount: 0 as const,
  }))

  if (deliveries.length > 0) {
    await operations.createDeliveries(deliveries)
  }

  return lead
}
