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
    labelHe: 'אחמ״ש',
  },
  {
    value: 'cook',
    label: 'Cook',
    labelHe: 'טבח/ית',
  },
  {
    value: 'barista',
    label: 'Barista',
    labelHe: 'בריסטה',
  },
  {
    value: 'socialManager',
    label: 'Social manager',
    labelHe: 'מנהל/ת סושיאל',
  },
  {
    value: 'counterWorker',
    label: 'Counter worker',
    labelHe: 'עובד/ת דלפק',
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
  homeStreetName: string | null
  homeAreaFormatted: string | null
  homeGooglePlaceId: string | null
  homeLatitude: number | null
  homeLongitude: number | null
  homeLocationUpdatedAt: string | null
  locationRequired: boolean
  createdAt: string
  updatedAt: string
}

export type RestaurantWorkerProfileInput = {
  fullName: string
  phoneNumber: string
  location: string
  homePlaceId?: string
  wantedRoles: RestaurantRole[]
  experienceText: string
  availability: string
  age: number
}

export type RestaurantMapJob = {
  id: string
  role: RestaurantRole
  title: string
}

export type RestaurantMapEntry = {
  restaurantId: string
  restaurantName: string
  formattedAddress: string
  latitude: number
  longitude: number
  jobs: RestaurantMapJob[]
}

export type RestaurantExploreJob = {
  id: string
  restaurantName: string
  role: RestaurantRole
  city: string
  street: string
  description: string
  requirements: string
  shiftInfo: string
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
