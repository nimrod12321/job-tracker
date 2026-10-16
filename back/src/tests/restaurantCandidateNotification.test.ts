import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLeadWithPendingNewCandidateDeliveries,
  selectNewCandidateNotificationRecipients,
  type RestaurantNotificationMember,
} from '../services/restaurantCandidateNotification.service.js'

const restaurantId = 'restaurant-a'

function member(
  overrides: Partial<RestaurantNotificationMember> = {},
): RestaurantNotificationMember {
  return {
    id: 'member-owner',
    restaurantId,
    userId: 'user-owner',
    phoneNumber: '+972501234567',
    role: 'owner',
    status: 'active',
    ...overrides,
  }
}

test('active owner is eligible for a new-candidate notification', () => {
  assert.deepEqual(
    selectNewCandidateNotificationRecipients(restaurantId, [member()]),
    [
      {
        recipientMemberId: 'member-owner',
        recipientPhone: '+972501234567',
      },
    ],
  )
})

test('active hiring manager is eligible for a new-candidate notification', () => {
  assert.deepEqual(
    selectNewCandidateNotificationRecipients(restaurantId, [
      member({
        id: 'member-manager',
        userId: 'user-manager',
        phoneNumber: '052-123-4567',
        role: 'hiringManager',
      }),
    ]),
    [
      {
        recipientMemberId: 'member-manager',
        recipientPhone: '+972521234567',
      },
    ],
  )
})

test('inactive, pending, removed, or unlinked members are not eligible', () => {
  const recipients = selectNewCandidateNotificationRecipients(
    restaurantId,
    [
      member({ id: 'pending', status: 'pending' }),
      member({ id: 'removed', status: 'removed' }),
      member({ id: 'unlinked', userId: null }),
    ],
  )

  assert.deepEqual(recipients, [])
})

test('unsupported member roles and members from other restaurants are not eligible', () => {
  const recipients = selectNewCandidateNotificationRecipients(
    restaurantId,
    [
      member({ id: 'unsupported', role: 'viewer' }),
      member({ id: 'other-restaurant', restaurantId: 'restaurant-b' }),
    ],
  )

  assert.deepEqual(recipients, [])
})

test('recipients are normalized and deduplicated by canonical phone', () => {
  const recipients = selectNewCandidateNotificationRecipients(
    restaurantId,
    [
      member({
        id: 'member-owner',
        phoneNumber: '054-123-4567',
      }),
      member({
        id: 'member-manager',
        userId: 'user-manager',
        phoneNumber: '+972541234567',
        role: 'hiringManager',
      }),
      member({
        id: 'invalid-phone',
        userId: 'user-invalid',
        phoneNumber: '123',
        role: 'hiringManager',
      }),
    ],
  )

  assert.deepEqual(recipients, [
    {
      recipientMemberId: 'member-owner',
      recipientPhone: '+972541234567',
    },
  ])
})

test('owner and hiring manager with different phones create two pending delivery rows', async () => {
  const recipients = selectNewCandidateNotificationRecipients(
    restaurantId,
    [
      member(),
      member({
        id: 'member-manager',
        userId: 'user-manager',
        phoneNumber: '0521234567',
        role: 'hiringManager',
      }),
    ],
  )
  const capturedDeliveries: unknown[] = []

  const lead = await createLeadWithPendingNewCandidateDeliveries(
    recipients,
    {
      async createLead() {
        return { id: 'candidate-lead' }
      },
      async createDeliveries(deliveries) {
        capturedDeliveries.push(...deliveries)
      },
    },
  )

  assert.deepEqual(lead, { id: 'candidate-lead' })
  assert.deepEqual(capturedDeliveries, [
    {
      candidateLeadId: 'candidate-lead',
      recipientMemberId: 'member-owner',
      recipientPhone: '+972501234567',
      kind: 'newCandidate',
      status: 'pending',
      attemptCount: 0,
    },
    {
      candidateLeadId: 'candidate-lead',
      recipientMemberId: 'member-manager',
      recipientPhone: '+972521234567',
      kind: 'newCandidate',
      status: 'pending',
      attemptCount: 0,
    },
  ])
})

test('candidate creation succeeds when there are no eligible recipients', async () => {
  let leadCreated = false
  let deliveryWriteCalled = false

  const lead = await createLeadWithPendingNewCandidateDeliveries([], {
    async createLead() {
      leadCreated = true
      return { id: 'candidate-without-recipients' }
    },
    async createDeliveries() {
      deliveryWriteCalled = true
    },
  })

  assert.deepEqual(lead, { id: 'candidate-without-recipients' })
  assert.equal(leadCreated, true)
  assert.equal(deliveryWriteCalled, false)
})
