import { env } from '../config/env.js'

const GOOGLE_PLACE_FIELDS = [
  'id',
  'formattedAddress',
  'location',
  'addressComponents',
  'types',
].join(',')

type GoogleAddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
}

export type GooglePlaceDetails = {
  id?: string
  formattedAddress?: string
  location?: {
    latitude?: number
    longitude?: number
  }
  addressComponents?: GoogleAddressComponent[]
  types?: string[]
}

const testPlaceDetails = new Map<string, GooglePlaceDetails>()

export function setGooglePlaceDetailsForTest(
  placeId: string,
  details: GooglePlaceDetails,
) {
  if (env.nodeEnv !== 'test') {
    throw new Error('Google Place test data is available only in test mode.')
  }

  testPlaceDetails.set(placeId, details)
}

export function clearGooglePlaceDetailsForTest() {
  testPlaceDetails.clear()
}

export type VerifiedRestaurantLocation = {
  googlePlaceId: string
  city: string
  streetName: string
  streetNumber: string
  formattedAddress: string
  latitude: number
  longitude: number
}

export type VerifiedWorkerStreet = {
  googlePlaceId: string
  streetName: string
  formattedAddress: string
  latitude: number
  longitude: number
}

export class GooglePlacesError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message)
    this.name = 'GooglePlacesError'
  }
}

function normalizeAddressName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-–—־']/g, '')
    .toLowerCase()
}

function isTelAvivName(value: string) {
  const normalized = normalizeAddressName(value)

  return (
    normalized === 'telaviv' ||
    normalized === 'telavivyafo' ||
    normalized === 'telavivjaffa' ||
    normalized === 'תלאביב' ||
    normalized === 'תלאביביפו'
  )
}

function getAddressComponent(
  components: GoogleAddressComponent[],
  type: string,
) {
  return components.find((component) => component.types?.includes(type))
}

function getComponentText(component?: GoogleAddressComponent) {
  return component?.longText?.trim() || component?.shortText?.trim() || ''
}

function validateCommonPlace(place: GooglePlaceDetails) {
  const components = place.addressComponents ?? []
  const country = getAddressComponent(components, 'country')
  const countryCode = country?.shortText?.trim().toUpperCase()
  const countryName = normalizeAddressName(getComponentText(country))
  const cityCandidates = components.filter((component) =>
    component.types?.some((type) =>
      [
        'locality',
        'postal_town',
        'administrative_area_level_2',
        'administrative_area_level_1',
      ].includes(type),
    ),
  )
  const route = getComponentText(getAddressComponent(components, 'route'))
  const latitude = place.location?.latitude
  const longitude = place.location?.longitude

  if (
    (countryCode !== 'IL' && countryName !== 'israel' && countryName !== 'ישראל') ||
    !cityCandidates.some((component) =>
      isTelAvivName(getComponentText(component)),
    ) ||
    !route ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    !place.id ||
    !place.formattedAddress
  ) {
    throw new GooglePlacesError(
      'Please choose a valid address in Tel Aviv–Yafo.',
    )
  }

  const city =
    cityCandidates
      .map((component) => getComponentText(component))
      .find(isTelAvivName) || 'Tel Aviv–Yafo'

  return {
    googlePlaceId: place.id,
    city,
    route,
    formattedAddress: place.formattedAddress,
    latitude,
    longitude,
    components,
  }
}

async function fetchPlaceDetails(input: {
  placeId: string
  apiKey?: string
  fetchImpl?: typeof fetch
}) {
  const testDetails = testPlaceDetails.get(input.placeId)

  if (env.nodeEnv === 'test' && testDetails) {
    return testDetails
  }

  const apiKey = input.apiKey ?? env.googleMapsApiKey

  if (!apiKey) {
    throw new GooglePlacesError(
      'Address search is temporarily unavailable. Please try again.',
      503,
    )
  }

  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(input.placeId)}`,
    {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': GOOGLE_PLACE_FIELDS,
      },
    },
  )

  if (!response.ok) {
    console.error('Google Place Details verification failed', {
      status: response.status,
    })
    throw new GooglePlacesError(
      'Address search is temporarily unavailable. Please try again.',
      response.status >= 500 ? 503 : 400,
    )
  }

  return (await response.json()) as GooglePlaceDetails
}

export async function verifyRestaurantPlaceId(input: {
  placeId: string
  apiKey?: string
  fetchImpl?: typeof fetch
}): Promise<VerifiedRestaurantLocation> {
  const place = await fetchPlaceDetails(input)
  const common = validateCommonPlace(place)
  const streetNumber = getComponentText(
    getAddressComponent(common.components, 'street_number'),
  )

  if (!streetNumber) {
    throw new GooglePlacesError(
      'Choose a valid Tel Aviv–Yafo street and number.',
    )
  }

  return {
    googlePlaceId: common.googlePlaceId,
    city: common.city,
    streetName: common.route,
    streetNumber,
    formattedAddress: common.formattedAddress,
    latitude: common.latitude,
    longitude: common.longitude,
  }
}

export async function verifyWorkerStreetPlaceId(input: {
  placeId: string
  apiKey?: string
  fetchImpl?: typeof fetch
}): Promise<VerifiedWorkerStreet> {
  const place = await fetchPlaceDetails(input)
  const common = validateCommonPlace(place)

  // A worker chooses a street/route, never a precise home address.
  if (!place.types?.includes('route')) {
    throw new GooglePlacesError(
      'Choose a valid street in Tel Aviv–Yafo.',
    )
  }

  return {
    googlePlaceId: common.googlePlaceId,
    streetName: common.route,
    formattedAddress: `${common.route}, ${common.city}`,
    latitude: common.latitude,
    longitude: common.longitude,
  }
}

export function getVerifiedRestaurantLocationData(
  location: VerifiedRestaurantLocation,
) {
  return {
    locationStatus: 'verified' as const,
    locationCity: location.city,
    locationStreetName: location.streetName,
    locationStreetNumber: location.streetNumber,
    formattedAddress: location.formattedAddress,
    googlePlaceId: location.googlePlaceId,
    latitude: location.latitude,
    longitude: location.longitude,
    locationVerifiedAt: new Date(),
    // Keep the legacy display fields populated for old QR/job UI.
    city: location.city,
    street: `${location.streetName} ${location.streetNumber}`.trim(),
  }
}
