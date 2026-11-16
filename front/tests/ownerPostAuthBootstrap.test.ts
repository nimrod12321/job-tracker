import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  OwnerAccessibleRestaurant,
  OwnerProfile,
} from '../src/features/owner/types/owner.ts'
import {
  createOwnerPostAuthBootstrapHandoff,
  loadOwnerPostAuthBootstrap,
  resolveOwnerPostAuthBootstrap,
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

test('owner bootstrap resolves only for the authenticated account and session', () => {
  const bootstrap = {
    restaurants,
    selectedRestaurantId: RESTAURANT_ID,
    profile,
  }
  const handoff = createOwnerPostAuthBootstrapHandoff(
    'session-a',
    'user-a',
    bootstrap,
  )

  assert.equal(
    resolveOwnerPostAuthBootstrap(handoff, 'session-a', 'user-a'),
    bootstrap,
  )
  assert.equal(
    resolveOwnerPostAuthBootstrap(handoff, 'session-a', 'user-b'),
    null,
  )
  assert.equal(
    resolveOwnerPostAuthBootstrap(handoff, 'session-b', 'user-a'),
    null,
  )
})

test('a fresh page session cannot recover an old owner bootstrap', () => {
  const bootstrap = {
    restaurants,
    selectedRestaurantId: RESTAURANT_ID,
    profile,
  }
  const storedItemCount = storage.size

  createOwnerPostAuthBootstrapHandoff('session-a', 'user-a', bootstrap)

  assert.equal(storage.size, storedItemCount)
  assert.equal(
    resolveOwnerPostAuthBootstrap(null, 'session-b', 'user-a'),
    null,
  )
})
