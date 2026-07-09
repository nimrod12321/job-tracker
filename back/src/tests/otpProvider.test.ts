import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTwilioSmsOtpProvider,
  createTwilioWhatsAppOtpProvider,
  formatTwilioWhatsAppRecipient,
  resolveOtpProviderKind,
  validateTwilioSmsConfig,
  validateTwilioWhatsAppConfig,
  type TwilioMessagesClient,
  type TwilioSmsConfig,
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

const baseTwilioSmsConfig: TwilioSmsConfig = {
  accountSid: 'AC_test',
  apiKeySid: 'SK_test',
  apiKeySecret: 'secret',
  messagingServiceSid: 'MG_test',
}

async function captureConsoleLogs(action: () => Promise<void>) {
  const logs: string[] = []
  const originalLog = console.log

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '))
  }

  try {
    await action()
  } finally {
    console.log = originalLog
  }

  return logs
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

test('OTP provider selection uses Twilio SMS when configured outside tests', () => {
  assert.equal(
    resolveOtpProviderKind({
      nodeEnv: 'development',
      otpProvider: 'twilio',
      otpChannel: 'sms',
    }),
    'twilio-sms',
  )
})

test('Twilio WhatsApp recipient is formatted with whatsapp prefix', () => {
  assert.equal(
    formatTwilioWhatsAppRecipient('+972501234567'),
    'whatsapp:+972501234567',
  )
})

test('Twilio SMS provider sends raw phone number, messaging service, and OTP body', async () => {
  const sentMessages: unknown[] = []
  const fakeClient: TwilioMessagesClient = {
    messages: {
      async create(message) {
        sentMessages.push(message)
      },
    },
  }
  const logs = await captureConsoleLogs(async () => {
    const provider = createTwilioSmsOtpProvider(
      baseTwilioSmsConfig,
      fakeClient,
    )

    await provider.sendOtpCode('+972501234567', '1234', 'login')
  })

  assert.deepEqual(sentMessages, [
    {
      messagingServiceSid: 'MG_test',
      to: '+972501234567',
      body: 'Peepss verification code: 1234',
    },
  ])
  assert.equal(
    (sentMessages[0] as { to: string }).to.startsWith('whatsapp:'),
    false,
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      sentMessages[0] as Record<string, unknown>,
      'contentSid',
    ),
    false,
  )
  assert.ok(logs.includes('OTP provider selected: twilio'))
  assert.ok(logs.includes('OTP channel selected: sms'))
  assert.ok(logs.includes('SMS messaging service configured: true'))
  assert.ok(logs.includes('Sending OTP via Twilio SMS'))
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
  const logs = await captureConsoleLogs(async () => {
    const provider = createTwilioWhatsAppOtpProvider(
      baseTwilioConfig,
      fakeClient,
    )

    await provider.sendOtpCode('+972501234567', '1234', 'login')
  })

  assert.deepEqual(sentMessages, [
    {
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+972501234567',
      body: 'Peepss verification code: 1234',
    },
  ])
  assert.ok(logs.includes('OTP provider selected: twilio'))
  assert.ok(logs.includes('OTP channel selected: whatsapp'))
  assert.ok(logs.includes('OTP mode selected: sandbox'))
  assert.ok(
    logs.includes(
      'WhatsApp production template configured: false',
    ),
  )
  assert.ok(
    logs.includes('Sending OTP via Twilio WhatsApp sandbox body'),
  )
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
  const logs = await captureConsoleLogs(async () => {
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
  })

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
  assert.ok(logs.includes('OTP provider selected: twilio'))
  assert.ok(logs.includes('OTP channel selected: whatsapp'))
  assert.ok(logs.includes('OTP mode selected: production'))
  assert.ok(
    logs.includes(
      'WhatsApp production template configured: true',
    ),
  )
  assert.ok(
    logs.includes(
      'Sending OTP via Twilio WhatsApp production template',
    ),
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

test('SMS Twilio mode requires messaging service SID', () => {
  assert.throws(
    () =>
      validateTwilioSmsConfig({
        ...baseTwilioSmsConfig,
        messagingServiceSid: '',
      }),
    /Missing Twilio OTP environment variables: TWILIO_MESSAGING_SERVICE_SID/,
  )
})
