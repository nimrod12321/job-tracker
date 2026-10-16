import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAdminUserInsights } from '../services/adminOperations.service.js'
import { isAnalyticsExcludedPhone } from '../services/analyticsExclusion.service.js'

test('unset analytics exclusion counts users and each wanted role once per user', () => {
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
          phoneNumber: '+972541234567',
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

test('analytics phone exclusions resolve supported Israeli normalization variants', () => {
  const excludedPhones = ['054-123-4567']

  for (const phoneNumber of [
    '0541234567',
    '054 123 4567',
    '+972541234567',
    '972541234567',
    '+972 54 123 4567',
  ]) {
    assert.equal(
      isAnalyticsExcludedPhone(phoneNumber, excludedPhones),
      true,
      `${phoneNumber} should resolve to the configured excluded phone`,
    )
  }

  assert.equal(
    isAnalyticsExcludedPhone('+972521234567', excludedPhones),
    false,
  )
})

test('a matching durable worker-profile phone is excluded from aggregates', () => {
  const insights = buildAdminUserInsights(
    [
      {
        phoneNumber: null,
        restaurantWorkerProfile: {
          phoneNumber: '+972541234567',
          wantedRoles: ['waiter'],
        },
      },
      {
        phoneNumber: '+972521234567',
        restaurantWorkerProfile: {
          phoneNumber: '+972521234567',
          wantedRoles: ['waiter'],
        },
      },
    ],
    ['054-123-4567'],
  )

  assert.equal(insights.totalUsers, 1)
  assert.equal(
    insights.wantedRoles.find(({ role }) => role === 'waiter')?.count,
    1,
  )
})
