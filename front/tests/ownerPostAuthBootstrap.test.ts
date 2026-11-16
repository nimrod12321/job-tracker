import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  OwnerAccessibleRestaurant,
  OwnerProfile,
} from '../src/features/owner/types/owner.ts'
import {
  getOwnerPostAuthBootstrap,
  loadOwnerPostAuthBootstrap,
} from '../src/features/owner/utils/ownerPostAuthBootstrap.ts'

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111'
const storage = new Map<string, string>()

Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
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
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Cafe One',
    slug: 'cafe-one',
    membershipRole: 'owner',
  },
]

const profile = {
  id: RESTAURANT_ID,
  restaurantName: 'Cafe One',
} as OwnerProfile

test('owner post-auth bootstrap fetches restaurants and profile exactly once', async () => {
  storage.clear()
  let restaurantRequests = 0
  let profileRequests = 0

  const bootstrap = await loadOwnerPostAuthBootstrap(null, {
    async getRestaurants() {
      restaurantRequests += 1
      return restaurants
    },
    async getProfile(restaurantId) {
      profileRequests += 1
      assert.equal(restaurantId, RESTAURANT_ID)
      return profile
    },
  })

  assert.equal(restaurantRequests, 1)
  assert.equal(profileRequests, 1)
  assert.deepEqual(bootstrap, {
    restaurants,
    selectedRestaurantId: RESTAURANT_ID,
    profile,
  })
})

test('navigation state exposes only the explicit owner bootstrap payload', () => {
  const bootstrap = {
    restaurants,
    selectedRestaurantId: RESTAURANT_ID,
    profile,
  }

  assert.equal(
    getOwnerPostAuthBootstrap({ ownerBootstrap: bootstrap }),
    bootstrap,
  )
  assert.equal(getOwnerPostAuthBootstrap(null), null)
  assert.equal(getOwnerPostAuthBootstrap({ ownerBootstrap: 'invalid' }), null)
})
