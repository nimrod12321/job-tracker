import type { RestaurantRole } from '../../restaurant/types/restaurant'

export type OwnerProfile = {
  id: string
  restaurantName: string
  contactPerson: string
  phoneNumber: string
  whatsappNumber: string
  location: string
  area: string
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
  location: string
  area: string
  description: string
  requirements: string
  shiftInfo: string
  contactPhone: string
  contactWhatsapp: string
}

export type OwnerJob = OwnerJobInput & {
  id: string
  restaurantName: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}
