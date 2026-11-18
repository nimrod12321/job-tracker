// Bounding rectangle used to keep the optional map preference in Israel.
// Address verification itself remains country-checked through Google Places.
export const PREFERRED_WORK_AREA_ISRAEL_BOUNDS = {
  minLatitude: 29.45,
  maxLatitude: 33.35,
  minLongitude: 34.2,
  maxLongitude: 35.95,
} as const

export const PREFERRED_WORK_AREA_MIN_RADIUS_KM = 0.5
export const PREFERRED_WORK_AREA_MAX_RADIUS_KM = 5

export type PreferredWorkArea = {
  latitude: number
  longitude: number
  radiusKm: number
}

type PreferredWorkAreaFields = {
  preferredWorkAreaLatitude: number | null
  preferredWorkAreaLongitude: number | null
  preferredWorkAreaRadiusKm: number | null
}

export function getPreferredWorkArea(
  profile: PreferredWorkAreaFields,
): PreferredWorkArea | null {
  const {
    preferredWorkAreaLatitude: latitude,
    preferredWorkAreaLongitude: longitude,
    preferredWorkAreaRadiusKm: radiusKm,
  } = profile

  return typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    typeof radiusKm === 'number'
    ? { latitude, longitude, radiusKm }
    : null
}

export function calculateGeographicalDistanceKm(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(second.latitude - first.latitude)
  const longitudeDelta = toRadians(second.longitude - first.longitude)
  const firstLatitude = toRadians(first.latitude)
  const secondLatitude = toRadians(second.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine))
}

export function isInsidePreferredWorkArea(
  area: PreferredWorkArea,
  location: { latitude: number; longitude: number },
) {
  return calculateGeographicalDistanceKm(area, location) <= area.radiusKm
}
