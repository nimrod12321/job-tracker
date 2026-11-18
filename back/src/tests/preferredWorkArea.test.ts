import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateGeographicalDistanceKm,
  getPreferredWorkArea,
  isInsidePreferredWorkArea,
} from '../services/preferredWorkArea.service.js'
import { restaurantProfileSchema } from '../validations/restaurant.validation.js'

const validProfile = {
  fullName: 'Test Worker',
  phoneNumber: '+972501234567',
  location: 'Tel Aviv',
  wantedRoles: ['waiter'],
  experienceText: '1 year',
  availability: 'Evening',
  age: 24,
}

test('worker profile remains valid without a preferred work area', () => {
  const result = restaurantProfileSchema.safeParse(validProfile)

  assert.equal(result.success, true)
  if (result.success) {
    assert.equal(result.data.preferredWorkArea, undefined)
  }
})

test('preferred work area accepts create and removal payloads', () => {
  const area = {
    latitude: 32.0853,
    longitude: 34.7818,
    radiusKm: 2,
  }

  const createResult = restaurantProfileSchema.safeParse({
    ...validProfile,
    preferredWorkArea: area,
  })
  const removeResult = restaurantProfileSchema.safeParse({
    ...validProfile,
    preferredWorkArea: null,
  })

  assert.equal(createResult.success, true)
  assert.equal(removeResult.success, true)
  if (createResult.success) {
    assert.deepEqual(createResult.data.preferredWorkArea, area)
  }
  if (removeResult.success) {
    assert.equal(removeResult.data.preferredWorkArea, null)
  }
})

test('preferred work area accepts Jerusalem and Haifa', () => {
  for (const preferredWorkArea of [
    { latitude: 31.7683, longitude: 35.2137, radiusKm: 2 },
    { latitude: 32.794, longitude: 34.9896, radiusKm: 5 },
  ]) {
    assert.equal(
      restaurantProfileSchema.safeParse({
        ...validProfile,
        preferredWorkArea,
      }).success,
      true,
    )
  }
})

test('preferred work area rejects invalid coordinates and radius', () => {
  for (const preferredWorkArea of [
    { latitude: 29.4, longitude: 34.7818, radiusKm: 2 },
    { latitude: 33.4, longitude: 34.9, radiusKm: 2 },
    { latitude: 32.0853, longitude: 36, radiusKm: 2 },
    { latitude: 32.0853, longitude: 34.7818, radiusKm: 0.4 },
    { latitude: 32.0853, longitude: 34.7818, radiusKm: 5.1 },
  ]) {
    assert.equal(
      restaurantProfileSchema.safeParse({
        ...validProfile,
        preferredWorkArea,
      }).success,
      false,
    )
  }
})

test('distance filtering includes the boundary and excludes farther jobs', () => {
  const center = { latitude: 31.7683, longitude: 35.2137 }
  const restaurant = { latitude: 31.786, longitude: 35.2137 }
  const boundaryRadiusKm = calculateGeographicalDistanceKm(
    center,
    restaurant,
  )

  assert.equal(
    isInsidePreferredWorkArea(
      { ...center, radiusKm: boundaryRadiusKm },
      restaurant,
    ),
    true,
  )
  assert.equal(
    isInsidePreferredWorkArea(
      { ...center, radiusKm: boundaryRadiusKm - 0.001 },
      restaurant,
    ),
    false,
  )
})

test('partial persisted work-area data is treated as no preference', () => {
  assert.equal(
    getPreferredWorkArea({
      preferredWorkAreaLatitude: 32.0853,
      preferredWorkAreaLongitude: null,
      preferredWorkAreaRadiusKm: 2,
    }),
    null,
  )
})
