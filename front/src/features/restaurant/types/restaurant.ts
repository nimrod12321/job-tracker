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

export const RESTAURANT_EMPLOYMENT_SCOPES = [
  {
    value: 'fullTime',
    label: 'Full-time',
    labelHe: 'משרה מלאה',
  },
  {
    value: 'partTime',
    label: 'Part-time',
    labelHe: 'משרה חלקית',
  },
  {
    value: 'flexible',
    label: 'Flexible',
    labelHe: 'גמיש',
  },
] as const

export type RestaurantEmploymentScope =
  (typeof RESTAURANT_EMPLOYMENT_SCOPES)[number]['value']

export function getRestaurantEmploymentScopeLabel(
  scope: RestaurantEmploymentScope | null,
  language: 'he' | 'en' = 'en',
) {
  if (!scope) {
    return language === 'he' ? 'לא צוין' : 'Not specified'
  }

  const option = RESTAURANT_EMPLOYMENT_SCOPES.find(
    (currentOption) => currentOption.value === scope,
  )

  return option
    ? language === 'he'
      ? option.labelHe
      : option.label
    : scope
}

export const RESTAURANT_VENUE_TYPES = [
  { value: 'restaurant', label: 'Restaurant', labelHe: 'מסעדה' },
  { value: 'bar', label: 'Bar', labelHe: 'בר' },
  { value: 'cafe', label: 'Cafe', labelHe: 'בית קפה' },
  { value: 'fastFood', label: 'Fast food', labelHe: 'מזון מהיר' },
  { value: 'stand', label: 'Stand', labelHe: 'דוכן' },
  { value: 'patisserie', label: 'Patisserie', labelHe: 'קונדיטוריה' },
] as const

export type RestaurantVenueType =
  (typeof RESTAURANT_VENUE_TYPES)[number]['value']

export function getRestaurantVenueTypeLabel(
  venueType: RestaurantVenueType,
  language: 'he' | 'en' = 'en',
) {
  const option = RESTAURANT_VENUE_TYPES.find(
    (currentOption) => currentOption.value === venueType,
  )

  return option
    ? language === 'he'
      ? option.labelHe
      : option.label
    : venueType
}

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
  restaurantId: string
  restaurantName: string
  role: RestaurantRole
  city: string
  street: string
  description: string
  requirements: string
  shiftInfo: string
  employmentScope: RestaurantEmploymentScope | null
  hourlyWage: number | null
}

export type RestaurantJobBoardRestaurant = {
  id: string
  restaurantName: string
  description: string
  city: string
  street: string
  venueTypes: RestaurantVenueType[]
}

export type RestaurantJobBoardRestaurantResponse = {
  restaurant: RestaurantJobBoardRestaurant
  jobs: RestaurantExploreJob[]
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
    employmentScope: RestaurantEmploymentScope | null
    hourlyWage: number | null
    contactPhone: string
    contactWhatsapp: string
  }
}
