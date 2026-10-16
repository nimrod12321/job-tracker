export type AdminCandidateNotificationDeliveryRecord = {
  id: string
  candidateLeadId: string
  kind: 'newCandidate' | 'reminder24h'
  status: 'pending' | 'accepted' | 'failed'
  recipientPhone: string
  recipientMemberId: string | null
  attemptCount: number
  createdAt: Date
  lastAttemptAt: Date | null
  acceptedAt: Date | null
  safeErrorCode: string | null
}

export function mapAdminCandidateNotificationDeliveries(
  candidateLeadId: string,
  deliveries: AdminCandidateNotificationDeliveryRecord[],
) {
  return deliveries
    .filter((delivery) => delivery.candidateLeadId === candidateLeadId)
    .map((delivery) => ({
      id: delivery.id,
      kind: delivery.kind,
      status: delivery.status,
      recipientPhone: delivery.recipientPhone,
      recipientMemberId: delivery.recipientMemberId,
      attemptCount: delivery.attemptCount,
      createdAt: delivery.createdAt.toISOString(),
      lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
      acceptedAt: delivery.acceptedAt?.toISOString() ?? null,
      safeErrorCode: delivery.safeErrorCode,
    }))
}
