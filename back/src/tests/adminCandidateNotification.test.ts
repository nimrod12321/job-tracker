import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mapAdminCandidateNotificationDeliveries,
  type AdminCandidateNotificationDeliveryRecord,
} from '../services/adminCandidateNotification.service.js'

const createdAt = new Date('2026-10-15T08:00:00.000Z')

function delivery(
  overrides: Partial<AdminCandidateNotificationDeliveryRecord> = {},
): AdminCandidateNotificationDeliveryRecord {
  return {
    id: 'delivery-owner',
    candidateLeadId: 'candidate-a',
    kind: 'newCandidate',
    status: 'pending',
    recipientPhone: '+972501234567',
    recipientMemberId: 'member-owner',
    attemptCount: 0,
    createdAt,
    lastAttemptAt: null,
    acceptedAt: null,
    safeErrorCode: null,
    ...overrides,
  }
}

test('maps one delivery for the requested candidate', () => {
  assert.deepEqual(
    mapAdminCandidateNotificationDeliveries('candidate-a', [delivery()]),
    [
      {
        id: 'delivery-owner',
        kind: 'newCandidate',
        status: 'pending',
        recipientPhone: '+972501234567',
        recipientMemberId: 'member-owner',
        attemptCount: 0,
        createdAt: '2026-10-15T08:00:00.000Z',
        lastAttemptAt: null,
        acceptedAt: null,
        safeErrorCode: null,
      },
    ],
  )
})

test('maps multiple recipients for the same candidate', () => {
  const mapped = mapAdminCandidateNotificationDeliveries('candidate-a', [
    delivery(),
    delivery({
      id: 'delivery-manager',
      recipientPhone: '+972521234567',
      recipientMemberId: 'member-manager',
      status: 'accepted',
      attemptCount: 1,
      lastAttemptAt: new Date('2026-10-15T08:01:00.000Z'),
      acceptedAt: new Date('2026-10-15T08:01:01.000Z'),
    }),
  ])

  assert.equal(mapped.length, 2)
  assert.deepEqual(
    mapped.map((item) => item.recipientPhone),
    ['+972501234567', '+972521234567'],
  )
})

test('returns an empty list when the candidate has no deliveries', () => {
  assert.deepEqual(
    mapAdminCandidateNotificationDeliveries('candidate-a', []),
    [],
  )
})

test('does not include a delivery belonging to another candidate', () => {
  assert.deepEqual(
    mapAdminCandidateNotificationDeliveries('candidate-a', [
      delivery({
        id: 'delivery-other',
        candidateLeadId: 'candidate-b',
      }),
    ]),
    [],
  )
})
