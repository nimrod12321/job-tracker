import type { RestaurantRole } from '../../restaurant/types/restaurant'
import type {
  CandidateLeadStatus,
  RestaurantCandidateLead,
} from '../../owner/types/owner'

export type { CandidateLeadStatus }

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
  ownerUser: AdminOwnerUser
  activeJobsCount: number
  qrLeadsCount: number
  applicationsCount: number
  funnelMetrics: AdminRestaurantFunnelMetrics
  hasNewCandidate: boolean
  newCandidateCount: number
  createdAt: string
  updatedAt: string
}

export type AdminRestaurantInput = {
  restaurantName: string
  slug: string
  contactPerson: string
  phoneNumber: string
  whatsappNumber: string
  city: string
  street: string
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
