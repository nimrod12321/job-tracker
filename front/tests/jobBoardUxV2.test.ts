import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getRestaurantEmploymentScopeLabel,
  getRestaurantVenueTypeLabel,
  RESTAURANT_EMPLOYMENT_SCOPES,
  RESTAURANT_VENUE_TYPES,
} from '../src/features/restaurant/types/restaurant.ts'

test('employment scope labels include the supported values and unspecified', () => {
  assert.deepEqual(
    RESTAURANT_EMPLOYMENT_SCOPES.map((scope) => scope.value),
    ['fullTime', 'partTime', 'flexible'],
  )
  assert.equal(getRestaurantEmploymentScopeLabel('fullTime', 'he'), 'משרה מלאה')
  assert.equal(getRestaurantEmploymentScopeLabel('partTime', 'en'), 'Part-time')
  assert.equal(getRestaurantEmploymentScopeLabel(null, 'he'), 'לא צוין')
})

test('venue type labels cover all supported multi-select values', () => {
  assert.deepEqual(
    RESTAURANT_VENUE_TYPES.map((venueType) => venueType.value),
    ['restaurant', 'bar', 'cafe', 'fastFood', 'stand', 'patisserie'],
  )
  assert.equal(getRestaurantVenueTypeLabel('cafe', 'he'), 'בית קפה')
  assert.equal(getRestaurantVenueTypeLabel('patisserie', 'en'), 'Patisserie')
})
