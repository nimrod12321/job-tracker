import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTwilioWhatsAppOtpProvider,
  formatTwilioWhatsAppRecipient,
  resolveOtpProviderKind,
  validateTwilioWhatsAppConfig,
  type TwilioMessagesClient,
  type TwilioWhatsAppConfig,
} from '../services/twilioOtpProvider.js'

const baseTwilioConfig: TwilioWhatsAppConfig = {
  accountSid: 'AC_test',
  apiKeySid: 'SK_test',
  apiKeySecret: 'secret',
  whatsappFrom: 'whatsapp:+14155238886',
  otpMode: 'sandbox',
  authContentSid: '',
}

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

test('Twilio WhatsApp sandbox provider sends from, to, and OTP body', async () => {
  const sentMessages: unknown[] = []
  const fakeClient: TwilioMessagesClient = {
    messages: {
      async create(message) {
        sentMessages.push(message)
      },
    },
  }
  const provider = createTwilioWhatsAppOtpProvider(
    baseTwilioConfig,
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

test('Twilio WhatsApp production provider sends content template fields without body', async () => {
  const sentMessages: unknown[] = []
  const fakeClient: TwilioMessagesClient = {
    messages: {
      async create(message) {
        sentMessages.push(message)
      },
    },
  }
  const provider = createTwilioWhatsAppOtpProvider(
    {
      ...baseTwilioConfig,
      otpMode: 'production',
      whatsappFrom: 'whatsapp:+972535913853',
      authContentSid: 'HX_test',
    },
    fakeClient,
  )

  await provider.sendOtpCode('+972501234567', '1234', 'register')

  assert.deepEqual(sentMessages, [
    {
      from: 'whatsapp:+972535913853',
      to: 'whatsapp:+972501234567',
      contentSid: 'HX_test',
      contentVariables: JSON.stringify({
        '1': '1234',
      }),
    },
  ])
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      sentMessages[0] as Record<string, unknown>,
      'body',
    ),
    false,
  )
})

test('missing base Twilio config causes clear provider config error', () => {
  assert.throws(
    () =>
      validateTwilioWhatsAppConfig({
        accountSid: '',
        apiKeySid: 'SK_test',
        apiKeySecret: '',
        whatsappFrom: '',
        otpMode: 'sandbox',
        authContentSid: '',
      }),
    /Missing Twilio OTP environment variables: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SECRET, TWILIO_WHATSAPP_FROM/,
  )
})

test('production Twilio mode requires authentication content SID', () => {
  assert.throws(
    () =>
      validateTwilioWhatsAppConfig({
        ...baseTwilioConfig,
        otpMode: 'production',
        authContentSid: '',
      }),
    /Missing Twilio OTP environment variables: TWILIO_WHATSAPP_AUTH_CONTENT_SID/,
  )
})

test('sandbox Twilio mode does not require authentication content SID', () => {
  assert.doesNotThrow(() =>
    validateTwilioWhatsAppConfig({
      ...baseTwilioConfig,
      otpMode: 'sandbox',
      authContentSid: '',
    }),
  )
})
