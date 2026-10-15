import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dispatchCandidateContactReminders,
  type CandidateContactReminderLead,
  type CandidateContactReminderRepository,
  type PendingCandidateContactReminderDelivery,
} from '../services/candidateContactReminder.service.js'
import {
  CandidateNotificationSmsError,
  type CandidateNotificationKind,
  type CandidateNotificationSmsProvider,
} from '../services/candidateNotificationSmsProvider.js'
import type { CandidateNotificationDeliveryRepository } from '../services/candidateNotificationDelivery.service.js'

const NOW = new Date('2026-10-15T12:00:00.000Z')
const OLDER_THAN_24_HOURS = new Date('2026-10-14T11:59:59.000Z')

type StoredDelivery = Omit<
  PendingCandidateContactReminderDelivery,
  'status'
> & {
  id: string
  lastAttemptAt: Date | null
  acceptedAt: Date | null
  providerMessageSid: string | null
  safeErrorCode: string | null
  status: 'pending' | 'accepted' | 'failed'
}

function lead(
  overrides: Partial<CandidateContactReminderLead> = {},
): CandidateContactReminderLead {
  return {
    id: 'lead-a',
    ownerProfileId: 'restaurant-a',
    source: 'qr',
    status: 'new',
    createdAt: OLDER_THAN_24_HOURS,
    firstContactInitiatedAt: null,
    members: [
      {
        id: 'member-owner',
        restaurantId: 'restaurant-a',
        userId: 'user-owner',
        phoneNumber: '050-123-4567',
        role: 'owner',
        status: 'active',
      },
    ],
    ...overrides,
  }
}

function createRepositories(leads: CandidateContactReminderLead[]) {
  const deliveries: StoredDelivery[] = []
  let nextId = 1

  const repository: CandidateContactReminderRepository = {
    async findPotentiallyEligibleLeads() {
      return leads
    },
    async createReminderDeliveries(newDeliveries) {
      let created = 0

      for (const item of newDeliveries) {
        const duplicate = deliveries.some(
          (stored) =>
            stored.candidateLeadId === item.candidateLeadId &&
            stored.recipientPhone === item.recipientPhone &&
            stored.kind === item.kind,
        )

        if (duplicate) {
          continue
        }

        deliveries.push({
          ...item,
          id: `delivery-${nextId++}`,
          lastAttemptAt: null,
          acceptedAt: null,
          providerMessageSid: null,
          safeErrorCode: null,
        })
        created += 1
      }

      return created
    },
  }

  const deliveryRepository: CandidateNotificationDeliveryRepository = {
    async findPendingDeliveries(kind, candidateLeadId) {
      return deliveries
        .filter(
          (item) =>
            item.kind === kind &&
            item.status === 'pending' &&
            item.attemptCount === 0 &&
            item.lastAttemptAt === null &&
            (!candidateLeadId ||
              item.candidateLeadId === candidateLeadId),
        )
        .map(({ id, recipientPhone, attemptCount, kind }) => ({
          id,
          recipientPhone,
          attemptCount,
          kind,
        }))
    },
    async claimPendingAttempt(item, attemptedAt) {
      const stored = deliveries.find(
        (delivery) => delivery.id === item.id,
      )

      if (
        !stored ||
        stored.kind !== item.kind ||
        stored.status !== 'pending' ||
        stored.attemptCount !== 0 ||
        stored.lastAttemptAt !== null
      ) {
        return false
      }

      stored.attemptCount += 1
      stored.lastAttemptAt = attemptedAt
      return true
    },
    async markAccepted(id, acceptedAt, providerMessageSid) {
      const stored = deliveries.find((delivery) => delivery.id === id)
      assert.ok(stored)
      stored.status = 'accepted'
      stored.acceptedAt = acceptedAt
      stored.providerMessageSid = providerMessageSid
      stored.safeErrorCode = null
    },
    async markFailed(id, safeErrorCode) {
      const stored = deliveries.find((delivery) => delivery.id === id)
      assert.ok(stored)
      stored.status = 'failed'
      stored.safeErrorCode = safeErrorCode
      stored.acceptedAt = null
      stored.providerMessageSid = null
    },
  }

  return { repository, deliveryRepository, deliveries }
}

function createProvider(fail = false) {
  const calls: Array<{
    phone: string
    kind: CandidateNotificationKind
  }> = []
  const provider: CandidateNotificationSmsProvider = {
    async sendCandidateNotification(phone, kind) {
      calls.push({ phone, kind })

      if (fail) {
        throw new CandidateNotificationSmsError('twilio_30001')
      }

      return { providerMessageSid: `SM-${phone}` }
    },
  }

  return { provider, calls }
}

async function dispatch(
  leads: CandidateContactReminderLead[],
  options: { enabled?: boolean; fail?: boolean } = {},
) {
  const stores = createRepositories(leads)
  const providerState = createProvider(options.fail)
  const result = await dispatchCandidateContactReminders({
    repository: stores.repository,
    deliveryRepository: stores.deliveryRepository,
    enabled: options.enabled ?? false,
    provider: providerState.provider,
    now: () => NOW,
  })

  return { ...stores, ...providerState, result }
}

test('lead younger than 24 hours does not create a reminder', async () => {
  const state = await dispatch([
    lead({ createdAt: new Date('2026-10-14T12:00:01.000Z') }),
  ])

  assert.equal(state.result.createdDeliveries, 0)
  assert.deepEqual(state.deliveries, [])
})

test('QR lead older than 24 hours with no contact creates a reminder', async () => {
  const state = await dispatch([lead()])

  assert.equal(state.result.eligibleLeads, 1)
  assert.equal(state.result.createdDeliveries, 1)
  assert.equal(state.deliveries[0]?.kind, 'reminder24h')
  assert.equal(state.deliveries[0]?.status, 'pending')
  assert.equal(state.deliveries[0]?.attemptCount, 0)
})

test('firstContactInitiatedAt excludes a lead from reminders', async () => {
  const state = await dispatch([
    lead({ firstContactInitiatedAt: new Date('2026-10-14T13:00:00Z') }),
  ])

  assert.equal(state.result.createdDeliveries, 0)
})

test('rejected lead is excluded from reminders', async () => {
  const state = await dispatch([lead({ status: 'rejected' })])

  assert.equal(state.result.createdDeliveries, 0)
})

test('legacy contacted lead with null contact timestamp is excluded', async () => {
  const state = await dispatch([lead({ status: 'contacted' })])

  assert.equal(state.result.createdDeliveries, 0)
})

test('repeated dispatcher run does not duplicate a reminder delivery', async () => {
  const stores = createRepositories([lead()])
  const providerState = createProvider()
  const dependencies = {
    repository: stores.repository,
    deliveryRepository: stores.deliveryRepository,
    enabled: false,
    provider: providerState.provider,
    now: () => NOW,
  }

  const first = await dispatchCandidateContactReminders(dependencies)
  const second = await dispatchCandidateContactReminders(dependencies)

  assert.equal(first.createdDeliveries, 1)
  assert.equal(second.createdDeliveries, 0)
  assert.equal(stores.deliveries.length, 1)
})

test('two active recipients create two reminder deliveries', async () => {
  const state = await dispatch([
    lead({
      members: [
        ...lead().members,
        {
          id: 'member-manager',
          restaurantId: 'restaurant-a',
          userId: 'user-manager',
          phoneNumber: '0521234567',
          role: 'hiringManager',
          status: 'active',
        },
      ],
    }),
  ])

  assert.equal(state.result.createdDeliveries, 2)
  assert.deepEqual(
    state.deliveries.map(({ recipientPhone }) => recipientPhone),
    ['+972501234567', '+972521234567'],
  )
})

test('duplicate normalized recipient phone creates one reminder', async () => {
  const state = await dispatch([
    lead({
      members: [
        ...lead().members,
        {
          id: 'member-manager',
          restaurantId: 'restaurant-a',
          userId: 'user-manager',
          phoneNumber: '+972501234567',
          role: 'hiringManager',
          status: 'active',
        },
      ],
    }),
  ])

  assert.equal(state.result.createdDeliveries, 1)
  assert.equal(state.deliveries.length, 1)
})

test('disabled flag leaves the reminder pending without a provider call', async () => {
  const state = await dispatch([lead()])

  assert.deepEqual(state.calls, [])
  assert.equal(state.deliveries[0]?.status, 'pending')
  assert.equal(state.deliveries[0]?.attemptCount, 0)
})

test('successful reminder send is accepted with one attempt', async () => {
  const state = await dispatch([lead()], { enabled: true })

  assert.deepEqual(state.calls, [
    { phone: '+972501234567', kind: 'reminder24h' },
  ])
  assert.equal(state.deliveries[0]?.status, 'accepted')
  assert.equal(state.deliveries[0]?.attemptCount, 1)
  assert.equal(
    state.deliveries[0]?.providerMessageSid,
    'SM-+972501234567',
  )
})

test('provider failure marks reminder failed without changing candidate', async () => {
  const candidate = lead()
  const originalCandidate = structuredClone(candidate)
  const state = await dispatch([candidate], {
    enabled: true,
    fail: true,
  })

  assert.equal(state.deliveries[0]?.status, 'failed')
  assert.equal(state.deliveries[0]?.attemptCount, 1)
  assert.equal(state.deliveries[0]?.safeErrorCode, 'twilio_30001')
  assert.deepEqual(candidate, originalCandidate)
})
