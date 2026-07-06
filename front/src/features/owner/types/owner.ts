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
  createdAt: string
  updatedAt: string
}

export type OwnerProfileInput = Omit<
  OwnerProfile,
  'id' | 'createdAt' | 'updatedAt'
>

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
