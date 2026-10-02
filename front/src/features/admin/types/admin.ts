import type { RestaurantRole } from '../../restaurant/types/restaurant'
import type {
  CandidateLeadStatus,
  RestaurantCandidateLead,
} from '../../owner/types/owner'

export type { CandidateLeadStatus }

export type AdminAcquisitionFunnelStageKey =
  | 'ownerSignupStarted'
  | 'otpVerified'
  | 'restaurantEstablished'
  | 'hiringReady'
  | 'recruitmentKitOpened'
  | 'recruitmentAssetUsed'
  | 'candidateReceived'
  | 'candidateCardOpened'
  | 'contactInitiated'

export type AdminAcquisitionStageCounts = Record<
  AdminAcquisitionFunnelStageKey,
  number
>

export type AdminAcquisitionFunnelReport = {
  cohort: {
    basis: 'owner_signup_started'
    count: number
  }
  filters: {
    source: string | null
    medium: string | null
    campaign: string | null
  }
  filterOptions: {
    sources: string[]
    mediums: string[]
    campaigns: string[]
  }
  funnel: Array<{
    key: AdminAcquisitionFunnelStageKey
    count: number
    conversionFromPrevious: number | null
  }>
  currentStageCounts: AdminAcquisitionStageCounts
  byAttribution: Array<{
    source: string
    medium: string
    campaign: string | null
    stages: AdminAcquisitionStageCounts
  }>
  signupFlows: {
    selfServe: number
    claim: number
    pendingPhone: number
    unknown: number
  }
  candidateSources: {
    external: number
    jobBoard: number
  }
}

export type AdminAcquisitionStageDetail = {
  acquisitionId: string
  ownerName: string | null
  phoneNumber: string | null
  phoneVerified: boolean
  source: string
  medium: string
  campaign: string | null
  flow: 'selfServe' | 'claim' | 'pendingPhone' | 'unknown'
  restaurant: {
    id: string
    restaurantName: string
  } | null
  currentStage: AdminAcquisitionFunnelStageKey
  currentStageReachedAt: string | null
  firstTouchedAt: string
  signupStartedAt: string
}

export type AdminAcquisitionStageDetailsReport = {
  stage: AdminAcquisitionFunnelStageKey
  filters: {
    source: string | null
    medium: string | null
    campaign: string | null
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  rows: AdminAcquisitionStageDetail[]
}

export type AdminOwnerUser = {
  id: string
  email: string | null
  phoneNumber: string | null
  fullName: string
} | null

export type AdminRestaurantFunnelMetrics = {
  qrScans: number
  uniqueQrVisitors: number
  startedForms: number
  completedForms: number
  ownerViewedCompletedForms: number
  newCandidates: number
  lastScanAt: string | null
  lastCompletedAt: string | null
  lastOwnerViewAt: string | null
}

export type AdminRestaurant = {
  id: string
  restaurantName: string
  contactPerson: string
  phoneNumber: string
  whatsappNumber: string
  city: string
  street: string
  description: string
  slug: string | null
  qrEnabledRoles: RestaurantRole[]
  locationStatus: 'unverified' | 'verified'
  locationCity: string | null
  locationStreetName: string | null
  locationStreetNumber: string | null
  formattedAddress: string | null
  googlePlaceId: string | null
  latitude: number | null
  longitude: number | null
  locationVerifiedAt: string | null
  ownerLoginPhone: string | null
  ownerUser: AdminOwnerUser
  hasActiveOwner: boolean
  claim: AdminRestaurantClaim
  activeJobsCount: number
  enabledHiringRolesCount: number
  qrLeadsCount: number
  applicationsCount: number
  totalCandidatesCount: number
  ownerUnviewedQrCandidates: number
  qrCandidateStatusCounts: Record<CandidateLeadStatus, number>
  latestActivityAt: string
  funnelMetrics: AdminRestaurantFunnelMetrics
  hasNewCandidate: boolean
  newCandidateCount: number
  createdAt: string
  updatedAt: string
}

export type AdminCandidateSource = 'qr' | 'jobBoard'
export type AdminCandidateStatus =
  | CandidateLeadStatus
  | 'applied'
  | 'selected'

export type AdminCandidate = {
  id: string
  source: AdminCandidateSource
  fullName: string
  phoneNumber: string
  roles: RestaurantRole[]
  experienceText: string
  availability: string
  age: number | null
  status: AdminCandidateStatus
  ownerViewState: 'viewed' | 'unviewed' | 'notTracked'
  ownerViewedAt: string | null
  createdAt: string
  updatedAt: string
  restaurant: {
    id: string
    restaurantName: string
    city: string
    street: string
    slug: string | null
  }
  job: {
    id: string
    role: RestaurantRole
  } | null
}

export type AdminRestaurantClaim = {
  status: 'available' | 'claimed' | 'missing'
  token: string | null
  claimedAt: string | null
  createdAt: string | null
}

export type AdminRestaurantInput = {
  restaurantName: string
  slug: string
  contactPerson: string
  ownerLoginPhone: string
  phoneNumber: string
  whatsappNumber: string
  city: string
  street: string
  locationPlaceId?: string
  description: string
}

export type AdminRestaurantJob = {
  id: string
  restaurantName: string
  role: RestaurantRole
  city: string
  street: string
  description: string
  requirements: string
  shiftInfo: string
  kind: 'draft' | 'posted'
  isActive: boolean
  applicationsCount: number
  createdAt: string
  updatedAt: string
}

export type AdminRestaurantQrLead = RestaurantCandidateLead & {
  ownerViewedAt: string | null
  restaurant: {
    id: string
    restaurantName: string
    city: string
    street: string
    slug: string | null
  }
}

export type AdminRestaurantApplication = {
  id: string
  status: 'applied' | 'selected' | 'rejected'
  createdAt: string
  updatedAt: string
  worker: {
    id: string
    fullName: string
    phoneNumber: string
  }
  job: {
    id: string
    role: RestaurantRole
    restaurantName: string
  }
}

export type AdminRestaurantDetail = {
  restaurant: AdminRestaurant
  ownerUser: AdminOwnerUser
  ownerAccountPhone: string | null
  restaurantContactPhone: string
  jobs: AdminRestaurantJob[]
  qrLeads: AdminRestaurantQrLead[]
  applications: AdminRestaurantApplication[]
}

export type AdminRestaurantCandidateLead = RestaurantCandidateLead & {
  status: CandidateLeadStatus
  ownerViewedAt: string | null
  restaurant: {
    id: string
    restaurantName: string
    city: string
    street: string
    slug: string | null
  }
}
