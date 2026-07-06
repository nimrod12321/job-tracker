export const RESTAURANT_ROLES = [
  {
    value: 'waiter',
    label: 'Waiter',
  },
  {
    value: 'bartender',
    label: 'Bartender',
  },
  {
    value: 'host',
    label: 'Host',
  },
  {
    value: 'floorManager',
    label: 'Floor manager',
  },
  {
    value: 'cook',
    label: 'Cook',
  },
] as const

export type RestaurantRole =
  (typeof RESTAURANT_ROLES)[number]['value']

export type RestaurantWorkerProfile = {
  id: string
  fullName: string
  phoneNumber: string
  location: string
  wantedRoles: RestaurantRole[]
  experienceText: string
  availability: string
  age: number
  createdAt: string
  updatedAt: string
}

export type RestaurantWorkerProfileInput = Omit<
  RestaurantWorkerProfile,
  'id' | 'createdAt' | 'updatedAt'
>

export type RestaurantExploreJob = {
  id: string
  restaurantName: string
  role: RestaurantRole
  city: string
  street: string
  description: string
  requirements: string
  shiftInfo: string
  contactPhone: string
  contactWhatsapp: string
}

export type RestaurantApplication = {
  id: string
  restaurantJobId: string
  status: 'applied' | 'selected' | 'rejected'
}

export type RestaurantMatch = {
  id: string
  createdAt: string
  job: {
    id: string
    restaurantName: string
    role: RestaurantRole
    city: string
    street: string
    description: string
    requirements: string
    shiftInfo: string
    contactPhone: string
    contactWhatsapp: string
  }
}
