import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAdminUserInsights } from '../services/adminOperations.service.js'

test('Admin user insights count users and each wanted role once per user', () => {
  const insights = buildAdminUserInsights(
    [
      {
        phoneNumber: '+972501111111',
        restaurantWorkerProfile: {
          wantedRoles: ['waiter', 'barista', 'waiter'],
        },
      },
      {
        phoneNumber: '+972502222222',
        restaurantWorkerProfile: {
          wantedRoles: ['waiter', 'cook'],
        },
      },
      {
        phoneNumber: null,
        restaurantWorkerProfile: null,
      },
    ],
    [],
  )

  assert.equal(insights.totalUsers, 3)
  assert.equal(
    insights.wantedRoles.find(({ role }) => role === 'waiter')?.count,
    2,
  )
  assert.equal(
    insights.wantedRoles.find(({ role }) => role === 'barista')?.count,
    1,
  )
  assert.equal(
    insights.wantedRoles.find(({ role }) => role === 'cook')?.count,
    1,
  )
  assert.equal(
    insights.wantedRoles.find(({ role }) => role === 'host')?.count,
    0,
  )
})

test('Admin user insights omit normalized configured phones only', () => {
  const insights = buildAdminUserInsights(
    [
      {
        phoneNumber: '+972541234567',
        restaurantWorkerProfile: {
          wantedRoles: ['bartender', 'host'],
        },
      },
      {
        phoneNumber: '+972521234567',
        restaurantWorkerProfile: {
          wantedRoles: ['host'],
        },
      },
    ],
    ['054-123-4567', 'not-a-phone'],
  )

  assert.equal(insights.totalUsers, 1)
  assert.equal(
    insights.wantedRoles.find(({ role }) => role === 'bartender')?.count,
    0,
  )
  assert.equal(
    insights.wantedRoles.find(({ role }) => role === 'host')?.count,
    1,
  )
})
