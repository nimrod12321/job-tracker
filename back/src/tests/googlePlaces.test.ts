import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GooglePlacesError,
  verifyRestaurantPlaceId,
  verifyWorkerStreetPlaceId,
} from '../services/googlePlaces.service.js'

function createFetch(place: Record<string, unknown>): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(place), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })) as typeof fetch
}

const telAvivComponents = [
  { longText: 'Dizengoff Street', types: ['route'] },
  { longText: '100', types: ['street_number'] },
  { longText: 'Tel Aviv-Yafo', types: ['locality'] },
  { longText: 'Israel', shortText: 'IL', types: ['country'] },
]

test('restaurant Place ID stores trusted Tel Aviv street and number', async () => {
  const location = await verifyRestaurantPlaceId({
    placeId: 'restaurant-place',
    apiKey: 'test-key',
    fetchImpl: createFetch({
      id: 'restaurant-place',
      formattedAddress: 'Dizengoff St 100, Tel Aviv-Yafo, Israel',
      location: { latitude: 32.0809, longitude: 34.7732 },
      addressComponents: telAvivComponents,
      types: ['street_address'],
    }),
  })

  assert.equal(location.googlePlaceId, 'restaurant-place')
  assert.equal(location.streetName, 'Dizengoff Street')
  assert.equal(location.streetNumber, '100')
  assert.equal(location.latitude, 32.0809)
})

test('restaurant Place ID without street number is rejected', async () => {
  await assert.rejects(
    verifyRestaurantPlaceId({
      placeId: 'route-only',
      apiKey: 'test-key',
      fetchImpl: createFetch({
        id: 'route-only',
        formattedAddress: 'Dizengoff Street, Tel Aviv-Yafo, Israel',
        location: { latitude: 32.0809, longitude: 34.7732 },
        addressComponents: telAvivComponents.filter(
          (component) => !component.types.includes('street_number'),
        ),
        types: ['route'],
      }),
    }),
    (error: unknown) =>
      error instanceof GooglePlacesError &&
      error.message.includes('street and number'),
  )
})

test('place outside Tel Aviv–Yafo is rejected', async () => {
  await assert.rejects(
    verifyRestaurantPlaceId({
      placeId: 'jerusalem-place',
      apiKey: 'test-key',
      fetchImpl: createFetch({
        id: 'jerusalem-place',
        formattedAddress: 'Jaffa St 10, Jerusalem, Israel',
        location: { latitude: 31.7857, longitude: 35.2074 },
        addressComponents: telAvivComponents.map((component) =>
          component.types.includes('locality')
            ? { ...component, longText: 'Jerusalem' }
            : component,
        ),
        types: ['street_address'],
      }),
    }),
    GooglePlacesError,
  )
})

test('worker location accepts a Tel Aviv route and stores no house number', async () => {
  const location = await verifyWorkerStreetPlaceId({
    placeId: 'worker-route',
    apiKey: 'test-key',
    fetchImpl: createFetch({
      id: 'worker-route',
      formattedAddress: 'Dizengoff Street, Tel Aviv-Yafo, Israel',
      location: { latitude: 32.083, longitude: 34.773 },
      addressComponents: telAvivComponents.filter(
        (component) => !component.types.includes('street_number'),
      ),
      types: ['route'],
    }),
  })

  assert.equal(location.streetName, 'Dizengoff Street')
  assert.equal(location.formattedAddress, 'Dizengoff Street, Tel Aviv-Yafo')
  assert.equal('streetNumber' in location, false)
})
