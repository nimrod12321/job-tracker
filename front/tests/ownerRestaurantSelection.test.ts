import assert from 'node:assert/strict'
import test from 'node:test'
import type { OwnerAccessibleRestaurant } from '../src/features/owner/types/owner.ts'
import {
  clearStoredOwnerRestaurantId,
  resolveValidOwnerRestaurantId,
  storeOwnerRestaurantId,
} from '../src/features/owner/utils/ownerRestaurantSelection.ts'

const storage = new Map<string, string>()

Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    clear() {
      storage.clear()
    },
    getItem(key: string) {
      return storage.get(key) ?? null
    },
    removeItem(key: string) {
      storage.delete(key)
    },
    setItem(key: string, value: string) {
      storage.set(key, value)
    },
  },
})

const restaurants: OwnerAccessibleRestaurant[] = [
  {
    restaurantId: '11111111-1111-4111-8111-111111111111',
    restaurantName: 'Cafe One',
    slug: 'cafe-one',
    membershipRole: 'owner',
  },
  {
    restaurantId: '22222222-2222-4222-8222-222222222222',
    restaurantName: 'Cafe Two',
    slug: 'cafe-two',
    membershipRole: 'hiringManager',
  },
]

test('an SMS restaurant is selected only when it is in the authorized restaurant list', () => {
  clearStoredOwnerRestaurantId()

  assert.equal(
    resolveValidOwnerRestaurantId(
      restaurants,
      '22222222-2222-4222-8222-222222222222',
    ),
    '22222222-2222-4222-8222-222222222222',
  )
})

test('an unauthorized or revoked SMS restaurant cannot replace an authorized selection', () => {
  storeOwnerRestaurantId('11111111-1111-4111-8111-111111111111')

  assert.equal(
    resolveValidOwnerRestaurantId(
      restaurants,
      '33333333-3333-4333-8333-333333333333',
    ),
    '11111111-1111-4111-8111-111111111111',
  )
})

test('single-restaurant users keep the existing implicit selection', () => {
  clearStoredOwnerRestaurantId()

  assert.equal(
    resolveValidOwnerRestaurantId([restaurants[0]!]),
    '11111111-1111-4111-8111-111111111111',
  )
})
