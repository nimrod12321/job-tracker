import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTwilioWhatsAppOtpProvider,
  formatTwilioWhatsAppRecipient,
  resolveOtpProviderKind,
  validateTwilioWhatsAppConfig,
  type TwilioMessagesClient,
} from '../services/twilioOtpProvider.js'

test('OTP provider selection uses captured test provider in NODE_ENV=test', () => {
  assert.equal(
    resolveOtpProviderKind({
      nodeEnv: 'test',
      otpProvider: 'twilio',
      otpChannel: 'whatsapp',
    }),
    'test',
  )
})

test('OTP provider selection uses Twilio WhatsApp when configured outside tests', () => {
  assert.equal(
    resolveOtpProviderKind({
      nodeEnv: 'development',
      otpProvider: 'twilio',
      otpChannel: 'whatsapp',
    }),
    'twilio-whatsapp',
  )
})

test('Twilio WhatsApp recipient is formatted with whatsapp prefix', () => {
  assert.equal(
    formatTwilioWhatsAppRecipient('+972501234567'),
    'whatsapp:+972501234567',
  )
})

test('Twilio WhatsApp provider sends from, to, and OTP body', async () => {
  const sentMessages: Array<{
    from: string
    to: string
    body: string
  }> = []
  const fakeClient: TwilioMessagesClient = {
    messages: {
      async create(message) {
        sentMessages.push(message)
      },
    },
  }
  const provider = createTwilioWhatsAppOtpProvider(
    {
      accountSid: 'AC_test',
      apiKeySid: 'SK_test',
      apiKeySecret: 'secret',
      whatsappFrom: 'whatsapp:+14155238886',
    },
    fakeClient,
  )

  await provider.sendOtpCode('+972501234567', '1234', 'login')

  assert.deepEqual(sentMessages, [
    {
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+972501234567',
      body: 'Peepss verification code: 1234',
    },
  ])
})

test('missing Twilio config causes clear provider config error', () => {
  assert.throws(
    () =>
      validateTwilioWhatsAppConfig({
        accountSid: '',
        apiKeySid: 'SK_test',
        apiKeySecret: '',
        whatsappFrom: '',
      }),
    /Missing Twilio OTP environment variables: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SECRET, TWILIO_WHATSAPP_FROM/,
  )
})
