import type { RestaurantRole } from '../../restaurant/types/restaurant'

export type OwnerProfile = {
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
  createdAt: string
  updatedAt: string
}

export type RestaurantMemberRole = 'owner' | 'hiringManager'
export type RestaurantMemberStatus = 'active' | 'pending' | 'removed'

export type OwnerTeamMember = {
  id: string
  phoneNumber: string
  displayName: string
  role: RestaurantMemberRole
  status: RestaurantMemberStatus
  user: {
    id: string
    fullName: string
    phoneNumber: string | null
  } | null
  createdAt: string
  updatedAt: string
}

export type OwnerTeam = {
  restaurant: OwnerProfile
  currentRole: RestaurantMemberRole
  members: OwnerTeamMember[]
}

export type OwnerProfileInput = {
  restaurantName: string
  contactPerson: string
  phoneNumber: string
  whatsappNumber: string
  city: string
  street: string
  description: string
  locationPlaceId?: string
}

export type OwnerJobInput = {
  role: RestaurantRole
  description: string
  requirements: string
  shiftInfo: string
  contactPhone: string
  contactWhatsapp: string
}

export type OwnerJob = OwnerJobInput & {
  id: string
  restaurantName: string
  city: string
  street: string
  kind: 'draft' | 'posted'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type OwnerApplicationStatus = 'applied' | 'selected' | 'rejected'

export type OwnerApplication = {
  id: string
  status: OwnerApplicationStatus
  createdAt: string
  job: {
    id: string
    role: RestaurantRole
    description: string
    shiftInfo: string
    isActive: boolean
  }
  worker: {
    id: string
    fullName: string
    phoneNumber: string
    location: string
    wantedRoles: RestaurantRole[]
    experienceText: string
    availability: string
    age: number | null
  }
}

export type CandidateLeadStatus =
  | 'new'
  | 'contacted'
  | 'relevant'
  | 'rejected'

export type RestaurantCandidateLead = {
  id: string
  fullName: string
  phoneNumber: string
  wantedRoles: RestaurantRole[]
  experienceText: string
  availability: string
  age: number | null
  source: string
  status: CandidateLeadStatus
  ownerViewedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminRestaurantCandidateLead = RestaurantCandidateLead & {
  restaurant: {
    id: string
    restaurantName: string
    city: string
    street: string
    slug: string | null
  }
}
