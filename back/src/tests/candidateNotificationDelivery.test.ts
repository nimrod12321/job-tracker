import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CandidateNotificationSmsError,
  NEW_CANDIDATE_SMS_BODY,
  createTwilioCandidateNotificationSmsProvider,
  type CandidateNotificationSmsProvider,
} from '../services/candidateNotificationSmsProvider.js'
import {
  processNewCandidateNotificationDeliveries,
  type CandidateNotificationDeliveryRepository,
} from '../services/candidateNotificationDelivery.service.js'
import type { TwilioMessagesClient } from '../services/twilioOtpProvider.js'

type DeliveryStatus = 'pending' | 'accepted' | 'failed'

type FakeDelivery = {
  id: string
  candidateLeadId: string
  recipientPhone: string
  status: DeliveryStatus
  attemptCount: number
  lastAttemptAt: Date | null
  acceptedAt: Date | null
  providerMessageSid: string | null
  safeErrorCode: string | null
}

function delivery(
  id: string,
  overrides: Partial<FakeDelivery> = {},
): FakeDelivery {
  return {
    id,
    candidateLeadId: 'candidate-lead',
    recipientPhone: `+9725000000${id}`,
    status: 'pending',
    attemptCount: 0,
    lastAttemptAt: null,
    acceptedAt: null,
    providerMessageSid: null,
    safeErrorCode: null,
    ...overrides,
  }
}

function createFakeRepository(deliveries: FakeDelivery[]) {
  const repository: CandidateNotificationDeliveryRepository = {
    async findPendingNewCandidateDeliveries(candidateLeadId) {
      return deliveries
        .filter(
          (item) =>
            item.candidateLeadId === candidateLeadId &&
            item.status === 'pending',
        )
        .map(({ id, recipientPhone, attemptCount }) => ({
          id,
          recipientPhone,
          attemptCount,
        }))
    },

    async claimPendingAttempt(item, attemptedAt) {
      const stored = deliveries.find(({ id }) => id === item.id)

      if (
        !stored ||
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
      const stored = deliveries.find((item) => item.id === id)
      assert.ok(stored)
      stored.status = 'accepted'
      stored.acceptedAt = acceptedAt
      stored.providerMessageSid = providerMessageSid
      stored.safeErrorCode = null
    },

    async markFailed(id, safeErrorCode) {
      const stored = deliveries.find((item) => item.id === id)
      assert.ok(stored)
      stored.status = 'failed'
      stored.acceptedAt = null
      stored.providerMessageSid = null
      stored.safeErrorCode = safeErrorCode
    },
  }

  return repository
}

function createFakeProvider(options?: { failPhones?: Set<string> }) {
  const calls: string[] = []
  const provider: CandidateNotificationSmsProvider = {
    async sendNewCandidateNotification(recipientPhone) {
      calls.push(recipientPhone)

      if (options?.failPhones?.has(recipientPhone)) {
        throw new CandidateNotificationSmsError('twilio_30001')
      }

      return {
        providerMessageSid: `SM-${recipientPhone}`,
      }
    },
  }

  return { provider, calls }
}

const attemptedAt = new Date('2026-10-15T10:00:00.000Z')
const acceptedAt = new Date('2026-10-15T10:00:01.000Z')

function createClock() {
  const times = [attemptedAt, acceptedAt]
  let index = 0

  return () => times[index++] ?? acceptedAt
}

test('disabled flag leaves pending delivery untouched and does not call provider', async () => {
  const deliveries = [delivery('1')]
  const { provider, calls } = createFakeProvider()

  await processNewCandidateNotificationDeliveries(
    { candidateLeadId: 'candidate-lead', enabled: false },
    {
      repository: createFakeRepository(deliveries),
      provider,
    },
  )

  assert.deepEqual(calls, [])
  assert.deepEqual(deliveries, [delivery('1')])
})

test('successful send persists its complete accepted attempt result', async () => {
  const deliveries = [delivery('1', { safeErrorCode: 'old_error' })]
  const { provider, calls } = createFakeProvider()

  await processNewCandidateNotificationDeliveries(
    { candidateLeadId: 'candidate-lead', enabled: true },
    {
      repository: createFakeRepository(deliveries),
      provider,
      now: createClock(),
    },
  )

  assert.deepEqual(calls, [deliveries[0]?.recipientPhone])
  assert.equal(deliveries[0]?.attemptCount, 1)
  assert.equal(deliveries[0]?.lastAttemptAt, attemptedAt)
  assert.equal(deliveries[0]?.status, 'accepted')
  assert.equal(deliveries[0]?.acceptedAt, acceptedAt)
  assert.equal(
    deliveries[0]?.providerMessageSid,
    `SM-${deliveries[0]?.recipientPhone}`,
  )
  assert.equal(deliveries[0]?.safeErrorCode, null)
})

test('provider failure is persisted safely without failing candidate submission', async () => {
  const deliveries = [delivery('1')]
  const recipientPhone = deliveries[0]?.recipientPhone ?? ''
  const { provider } = createFakeProvider({
    failPhones: new Set([recipientPhone]),
  })

  const simulatedCandidateResponse = await (async () => {
    await processNewCandidateNotificationDeliveries(
      { candidateLeadId: 'candidate-lead', enabled: true },
      {
        repository: createFakeRepository(deliveries),
        provider,
        now: createClock(),
      },
    )

    return { status: 201, body: { ok: true } }
  })()

  assert.deepEqual(simulatedCandidateResponse, {
    status: 201,
    body: { ok: true },
  })
  assert.equal(deliveries[0]?.attemptCount, 1)
  assert.equal(deliveries[0]?.lastAttemptAt, attemptedAt)
  assert.equal(deliveries[0]?.status, 'failed')
  assert.equal(deliveries[0]?.acceptedAt, null)
  assert.equal(deliveries[0]?.providerMessageSid, null)
  assert.equal(deliveries[0]?.safeErrorCode, 'twilio_30001')
})

test('an already accepted delivery is not sent again', async () => {
  const deliveries = [
    delivery('1', {
      status: 'accepted',
      attemptCount: 1,
      acceptedAt,
      providerMessageSid: 'SM-existing',
    }),
  ]
  const { provider, calls } = createFakeProvider()

  await processNewCandidateNotificationDeliveries(
    { candidateLeadId: 'candidate-lead', enabled: true },
    {
      repository: createFakeRepository(deliveries),
      provider,
    },
  )

  assert.deepEqual(calls, [])
  assert.equal(deliveries[0]?.attemptCount, 1)
  assert.equal(deliveries[0]?.providerMessageSid, 'SM-existing')
})

test('a pending delivery with an existing attempt is not sent again', async () => {
  const deliveries = [
    delivery('1', {
      attemptCount: 1,
      lastAttemptAt: attemptedAt,
    }),
  ]
  const { provider, calls } = createFakeProvider()

  await processNewCandidateNotificationDeliveries(
    { candidateLeadId: 'candidate-lead', enabled: true },
    {
      repository: createFakeRepository(deliveries),
      provider,
    },
  )

  assert.deepEqual(calls, [])
  assert.equal(deliveries[0]?.attemptCount, 1)
  assert.equal(deliveries[0]?.status, 'pending')
})

test('multiple pending recipients receive one independent attempt each', async () => {
  const deliveries = [delivery('1'), delivery('2')]
  const { provider, calls } = createFakeProvider()

  await processNewCandidateNotificationDeliveries(
    { candidateLeadId: 'candidate-lead', enabled: true },
    {
      repository: createFakeRepository(deliveries),
      provider,
      now: createClock(),
    },
  )

  assert.equal(calls.length, 2)
  assert.deepEqual(
    deliveries.map(({ status, attemptCount }) => ({
      status,
      attemptCount,
    })),
    [
      { status: 'accepted', attemptCount: 1 },
      { status: 'accepted', attemptCount: 1 },
    ],
  )
})

test('one failed recipient does not prevent another recipient succeeding', async () => {
  const deliveries = [delivery('1'), delivery('2')]
  const failedPhone = deliveries[0]?.recipientPhone ?? ''
  const { provider, calls } = createFakeProvider({
    failPhones: new Set([failedPhone]),
  })

  const simulatedCandidateResponse = await (async () => {
    await processNewCandidateNotificationDeliveries(
      { candidateLeadId: 'candidate-lead', enabled: true },
      {
        repository: createFakeRepository(deliveries),
        provider,
        now: createClock(),
      },
    )

    return { status: 201, body: { ok: true } }
  })()

  assert.deepEqual(simulatedCandidateResponse, {
    status: 201,
    body: { ok: true },
  })
  assert.equal(calls.length, 2)
  assert.equal(deliveries[0]?.status, 'failed')
  assert.equal(deliveries[0]?.safeErrorCode, 'twilio_30001')
  assert.equal(deliveries[1]?.status, 'accepted')
  assert.equal(deliveries[1]?.safeErrorCode, null)
})

test('Twilio notification provider uses SMS Messaging Service and centralized non-PII body', async () => {
  const messages: unknown[] = []
  const client: TwilioMessagesClient = {
    messages: {
      async create(message) {
        messages.push(message)
        return { sid: 'SM-provider-result' }
      },
    },
  }
  const provider = createTwilioCandidateNotificationSmsProvider(
    {
      accountSid: 'AC-test',
      apiKeySid: 'SK-test',
      apiKeySecret: 'test-secret',
      messagingServiceSid: 'MG-test',
    },
    client,
  )

  const result = await provider.sendNewCandidateNotification(
    '+972501234567',
  )

  assert.deepEqual(messages, [
    {
      messagingServiceSid: 'MG-test',
      to: '+972501234567',
      body: NEW_CANDIDATE_SMS_BODY,
    },
  ])
  assert.deepEqual(result, {
    providerMessageSid: 'SM-provider-result',
  })
})
