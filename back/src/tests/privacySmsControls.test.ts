import assert from 'node:assert/strict'
import test from 'node:test'
import { verifyCodeSchema } from '../validations/auth.validation.js'
import { sendMarketingSmsAtBoundary } from '../services/marketingSms.service.js'
import { selectNewCandidateNotificationRecipients } from '../services/restaurantCandidateNotification.service.js'
import { requiresLegalAcceptanceForOtpPurpose } from '../services/legalConsent.service.js'

test('registration-like OTP flows require legal acceptance while login does not', () => {
  const withoutLegal = verifyCodeSchema.safeParse({
    phoneNumber: '0501234567',
    code: '1234',
    purpose: 'register',
    fullName: 'Test User',
    track: 'restaurant',
  })
  const withLegalAndNoMarketing = verifyCodeSchema.safeParse({
    phoneNumber: '0501234567',
    code: '1234',
    purpose: 'register',
    fullName: 'Test User',
    track: 'restaurant',
    legalAccepted: true,
  })

  assert.equal(withoutLegal.success, true)
  assert.equal(withLegalAndNoMarketing.success, true)
  assert.equal(requiresLegalAcceptanceForOtpPurpose('register'), true)
  assert.equal(requiresLegalAcceptanceForOtpPurpose('qrApply'), true)
  assert.equal(requiresLegalAcceptanceForOtpPurpose('login'), false)
  if (withLegalAndNoMarketing.success) {
    assert.equal(withLegalAndNoMarketing.data.marketingSmsOptIn, false)
  }
})

test('marketing SMS sender skips users without affirmative current consent', async () => {
  let providerCalls = 0

  const result = await sendMarketingSmsAtBoundary(
    {
      userId: 'worker-1',
      body: 'New job recommendation',
      frontendUrl: 'https://staging.peepss.com',
    },
    {
      repository: {
        async findEligibleUser() {
          return {
            id: 'worker-1',
            phoneNumber: '+972501234567',
            phoneVerifiedAt: new Date(),
            marketingSmsEnabled: false,
            marketingSmsConsentedAt: null,
          }
        },
        async createUnsubscribeToken() {
          assert.fail('unsubscribe token must not be created')
        },
      },
      provider: {
        async sendSms() {
          providerCalls += 1
          return { providerMessageSid: 'SM-not-used' }
        },
      },
    },
  )

  assert.deepEqual(result, { sent: false, reason: 'not_opted_in' })
  assert.equal(providerCalls, 0)
})

test('marketing SMS checks consent at the send boundary and includes opaque unsubscribe link', async () => {
  let enabled = true
  const sentBodies: string[] = []
  const storedHashes: string[] = []
  const dependencies = {
    repository: {
      async findEligibleUser() {
        return {
          id: 'worker-1',
          phoneNumber: '+972501234567',
          phoneVerifiedAt: new Date('2026-01-01T00:00:00Z'),
          marketingSmsEnabled: enabled,
          marketingSmsConsentedAt: new Date('2026-01-01T00:00:00Z'),
        }
      },
      async createUnsubscribeToken(input: { tokenHash: string }) {
        storedHashes.push(input.tokenHash)
      },
    },
    provider: {
      async sendSms(_phone: string, body: string) {
        sentBodies.push(body)
        return { providerMessageSid: 'SM-1' }
      },
    },
    createToken: () => 'opaque-test-token-not-a-user-id',
    now: () => new Date('2026-01-02T00:00:00Z'),
  }

  const first = await sendMarketingSmsAtBoundary(
    {
      userId: 'worker-1',
      body: 'New job recommendation',
      frontendUrl: 'https://staging.peepss.com',
    },
    dependencies,
  )
  enabled = false
  const retryAfterOptOut = await sendMarketingSmsAtBoundary(
    {
      userId: 'worker-1',
      body: 'New job recommendation retry',
      frontendUrl: 'https://staging.peepss.com',
    },
    dependencies,
  )

  assert.equal(first.sent, true)
  assert.match(sentBodies[0] ?? '', /sms\/unsubscribe\?token=opaque-test-token/)
  assert.equal(sentBodies[0]?.includes('worker-1'), false)
  assert.equal(storedHashes.length, 1)
  assert.notEqual(storedHashes[0], 'opaque-test-token-not-a-user-id')
  assert.deepEqual(retryAfterOptOut, {
    sent: false,
    reason: 'not_opted_in',
  })
  assert.equal(sentBodies.length, 1)
})

test('service notification categories are enforced independently', () => {
  const member = {
    id: 'member-1',
    restaurantId: 'restaurant-1',
    userId: 'owner-1',
    phoneNumber: '+972501234567',
    role: 'owner',
    status: 'active',
    newCandidateSmsEnabled: false,
    candidateReminderSmsEnabled: true,
  }

  assert.deepEqual(
    selectNewCandidateNotificationRecipients('restaurant-1', [member]),
    [],
  )
  assert.equal(
    selectNewCandidateNotificationRecipients(
      'restaurant-1',
      [member],
      'reminder24h',
    ).length,
    1,
  )
})
