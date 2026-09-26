export const ANALYTICS_EVENT_RETENTION_DAYS = 180
export const ANALYTICS_ACQUISITION_RETENTION_DAYS = 365
export const ANALYTICS_MAX_REQUEST_BYTES = 8 * 1024

export const APPROVED_ANALYTICS_EVENT_NAMES = [
  'owner_signup_started',
  'owner_otp_verified',
  'hiring_roles_updated',
  'recruitment_kit_opened',
  'hiring_link_copied',
  'poster_download_started',
  'qr_download_started',
  'instagram_assist_opened',
  'candidate_card_opened',
  'candidate_contact_initiated',
] as const

export type ApprovedAnalyticsEventName =
  (typeof APPROVED_ANALYTICS_EVENT_NAMES)[number]

export const OWNER_ACQUISITION_FLOWS = [
  'selfServe',
  'claim',
  'pendingPhone',
] as const

export type OwnerAcquisitionFlow =
  (typeof OWNER_ACQUISITION_FLOWS)[number]

export const ANALYTICS_EVENT_PROPERTY_ALLOWLIST: Record<
  ApprovedAnalyticsEventName,
  readonly string[]
> = {
  owner_signup_started: ['flow'],
  owner_otp_verified: ['flow', 'purpose', 'newAccount'],
  hiring_roles_updated: ['roleCount'],
  recruitment_kit_opened: [],
  hiring_link_copied: ['method'],
  poster_download_started: ['format'],
  qr_download_started: ['format'],
  instagram_assist_opened: ['context'],
  candidate_card_opened: ['candidateSource'],
  candidate_contact_initiated: ['candidateSource', 'channel'],
}

export function retentionDateFrom(
  date: Date,
  retentionDays: number,
) {
  return new Date(date.getTime() + retentionDays * 24 * 60 * 60 * 1000)
}
