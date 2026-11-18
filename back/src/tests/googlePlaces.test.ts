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

function createFetchSequence(
  responses: Array<Record<string, unknown>>,
): typeof fetch {
  let responseIndex = 0

  return (async () => {
    const responseBody = responses[responseIndex]
    responseIndex += 1

    assert.ok(responseBody, 'unexpected Google Places request')

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }) as typeof fetch
}

const telAvivComponents = [
  { longText: 'Dizengoff Street', types: ['route'] },
  { longText: '100', types: ['street_number'] },
  { longText: 'Tel Aviv-Yafo', types: ['locality'] },
  { longText: 'Israel', shortText: 'IL', types: ['country'] },
]

function israelAddressComponents(input: {
  street: string
  streetNumber?: string
  city: string
}) {
  return [
    { longText: input.street, types: ['route'] },
    ...(input.streetNumber
      ? [{ longText: input.streetNumber, types: ['street_number'] }]
      : []),
    { longText: input.city, types: ['locality'] },
    { longText: 'Israel', shortText: 'IL', types: ['country'] },
  ]
}

test('restaurant Place ID stores trusted Israeli street and number', async () => {
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

for (const locationCase of [
  {
    city: 'Jerusalem',
    street: 'Jaffa Street',
    latitude: 31.7857,
    longitude: 35.2074,
  },
  {
    city: 'Haifa',
    street: 'Hanassi Boulevard',
    latitude: 32.8031,
    longitude: 34.9867,
  },
  {
    city: 'Netanya',
    street: 'Herzl Street',
    latitude: 32.3215,
    longitude: 34.8532,
  },
  {
    city: "Be'er Sheva",
    street: 'Rager Boulevard',
    latitude: 31.2529,
    longitude: 34.7915,
  },
] as const) {
  test(`restaurant verification accepts ${locationCase.city}`, async () => {
    const location = await verifyRestaurantPlaceId({
      placeId: `${locationCase.city}-restaurant-place`,
      apiKey: 'test-key',
      fetchImpl: createFetch({
        id: `${locationCase.city}-restaurant-place`,
        formattedAddress: `${locationCase.street} 10, ${locationCase.city}, Israel`,
        location: {
          latitude: locationCase.latitude,
          longitude: locationCase.longitude,
        },
        addressComponents: israelAddressComponents({
          street: locationCase.street,
          streetNumber: '10',
          city: locationCase.city,
        }),
        types: ['street_address'],
      }),
    })

    assert.equal(location.city, locationCase.city)
    assert.equal(location.streetName, locationCase.street)
    assert.equal(location.streetNumber, '10')
  })
}

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

test('place outside Israel is rejected', async () => {
  await assert.rejects(
    verifyRestaurantPlaceId({
      placeId: 'amman-place',
      apiKey: 'test-key',
      fetchImpl: createFetch({
        id: 'amman-place',
        formattedAddress: 'Rainbow Street 10, Amman, Jordan',
        location: { latitude: 31.9516, longitude: 35.9239 },
        addressComponents: [
          { longText: 'Rainbow Street', types: ['route'] },
          { longText: '10', types: ['street_number'] },
          { longText: 'Amman', types: ['locality'] },
          { longText: 'Jordan', shortText: 'JO', types: ['country'] },
        ],
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

test('worker location accepts a Haifa route', async () => {
  const location = await verifyWorkerStreetPlaceId({
    placeId: 'haifa-worker-route',
    apiKey: 'test-key',
    fetchImpl: createFetch({
      id: 'haifa-worker-route',
      formattedAddress: 'Hanassi Boulevard, Haifa, Israel',
      location: { latitude: 32.8031, longitude: 34.9867 },
      addressComponents: israelAddressComponents({
        street: 'Hanassi Boulevard',
        city: 'Haifa',
      }),
      types: ['route'],
    }),
  })

  assert.equal(location.streetName, 'Hanassi Boulevard')
  assert.equal(location.formattedAddress, 'Hanassi Boulevard, Haifa')
})

test('worker can select a numbered address while only its street is stored', async () => {
  const location = await verifyWorkerStreetPlaceId({
    placeId: 'worker-address',
    apiKey: 'test-key',
    fetchImpl: createFetchSequence([
      {
        id: 'worker-address',
        formattedAddress: 'Dizengoff St 100, Tel Aviv-Yafo, Israel',
        location: { latitude: 32.0809, longitude: 34.7732 },
        addressComponents: telAvivComponents,
        types: ['street_address'],
      },
      {
        suggestions: [
          {
            placePrediction: {
              placeId: 'worker-route',
            },
          },
        ],
      },
      {
        id: 'worker-route',
        formattedAddress: 'Dizengoff Street, Tel Aviv-Yafo, Israel',
        location: { latitude: 32.083, longitude: 34.773 },
        addressComponents: telAvivComponents.filter(
          (component) => !component.types.includes('street_number'),
        ),
        types: ['route'],
      },
    ]),
  })

  assert.equal(location.googlePlaceId, 'worker-route')
  assert.equal(location.streetName, 'Dizengoff Street')
  assert.equal(location.formattedAddress, 'Dizengoff Street, Tel Aviv-Yafo')
  assert.equal(location.latitude, 32.083)
  assert.equal(location.formattedAddress.includes('100'), false)
  assert.equal('streetNumber' in location, false)
})
