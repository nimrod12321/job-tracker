export const RESTAURANT_ROLES = [
  {
    value: 'waiter',
    label: 'Waiter',
    labelHe: 'מלצר/ית',
  },
  {
    value: 'bartender',
    label: 'Bartender',
    labelHe: 'ברמן/ית',
  },
  {
    value: 'host',
    label: 'Host',
    labelHe: 'מארח/ת',
  },
  {
    value: 'floorManager',
    label: 'Floor manager',
    labelHe: 'מנהל/ת רצפה',
  },
  {
    value: 'cook',
    label: 'Cook',
    labelHe: 'טבח/ית',
  },
] as const

export type RestaurantRole =
  (typeof RESTAURANT_ROLES)[number]['value']

export function getRestaurantRoleLabel(
  role: RestaurantRole,
  language: 'he' | 'en' = 'en',
) {
  const roleOption = RESTAURANT_ROLES.find(
    (option) => option.value === role,
  )

  if (!roleOption) {
    return role
  }

  return language === 'he' ? roleOption.labelHe : roleOption.label
}

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
