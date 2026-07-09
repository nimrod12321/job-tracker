import twilio from 'twilio'

type OtpPurpose = 'login' | 'register' | 'qrApply'

export type OtpProviderKind =
  | 'test'
  | 'twilio-whatsapp'
  | 'twilio-sms'
  | 'console'

type TwilioBaseConfig = {
  accountSid: string
  apiKeySid: string
  apiKeySecret: string
}

export type TwilioWhatsAppConfig = TwilioBaseConfig & {
  whatsappFrom: string
  otpMode: string
  authContentSid: string
}

export type TwilioSmsConfig = TwilioBaseConfig & {
  messagingServiceSid: string
}

type TwilioWhatsAppMessage =
  | {
      from: string
      to: string
      body: string
    }
  | {
      from: string
      to: string
      contentSid: string
      contentVariables: string
    }

type TwilioSmsMessage = {
  messagingServiceSid: string
  to: string
  body: string
}

type TwilioMessage = TwilioWhatsAppMessage | TwilioSmsMessage

export type TwilioMessagesClient = {
  messages: {
    create(message: TwilioMessage): Promise<unknown>
  }
}

export function resolveOtpProviderKind(config: {
  nodeEnv: string
  otpProvider: string
  otpChannel: string
}): OtpProviderKind {
  if (config.nodeEnv === 'test') {
    return 'test'
  }

  if (
    config.otpProvider === 'twilio' &&
    config.otpChannel === 'whatsapp'
  ) {
    return 'twilio-whatsapp'
  }

  if (config.otpProvider === 'twilio' && config.otpChannel === 'sms') {
    return 'twilio-sms'
  }

  return 'console'
}

function getMissingBaseTwilioVariables(config: TwilioBaseConfig) {
  return [
    { name: 'TWILIO_ACCOUNT_SID', value: config.accountSid },
    { name: 'TWILIO_API_KEY_SID', value: config.apiKeySid },
    { name: 'TWILIO_API_KEY_SECRET', value: config.apiKeySecret },
  ]
    .filter(({ value }) => !value.trim())
    .map(({ name }) => name)
}

function throwIfMissingTwilioVariables(missingVariables: string[]) {
  if (missingVariables.length === 0) {
    return
  }

  throw new Error(
    `Missing Twilio OTP environment variables: ${missingVariables.join(
      ', ',
    )}`,
  )
}

export function validateTwilioWhatsAppConfig(config: TwilioWhatsAppConfig) {
  const missingVariables = [
    ...getMissingBaseTwilioVariables(config),
    ...[
      { name: 'TWILIO_WHATSAPP_FROM', value: config.whatsappFrom },
      ...(config.otpMode === 'production'
        ? [
            {
              name: 'TWILIO_WHATSAPP_AUTH_CONTENT_SID',
              value: config.authContentSid,
            },
          ]
        : []),
    ]
      .filter(({ value }) => !value.trim())
      .map(({ name }) => name),
  ]

  throwIfMissingTwilioVariables(missingVariables)

  if (config.otpMode !== 'sandbox' && config.otpMode !== 'production') {
    throw new Error('OTP_MODE must be sandbox or production')
  }
}

export function validateTwilioSmsConfig(config: TwilioSmsConfig) {
  const missingVariables = [
    ...getMissingBaseTwilioVariables(config),
    ...[
      {
        name: 'TWILIO_MESSAGING_SERVICE_SID',
        value: config.messagingServiceSid,
      },
    ]
      .filter(({ value }) => !value.trim())
      .map(({ name }) => name),
  ]

  throwIfMissingTwilioVariables(missingVariables)
}

export function formatTwilioWhatsAppRecipient(phoneNumber: string) {
  return `whatsapp:${phoneNumber}`
}

function createTwilioClient(config: TwilioBaseConfig) {
  return twilio(config.apiKeySid, config.apiKeySecret, {
    accountSid: config.accountSid,
  }) as TwilioMessagesClient
}

function buildOtpMessage(code: string) {
  return `Peepss verification code: ${code}`
}

function buildTwilioWhatsAppMessage(
  config: TwilioWhatsAppConfig,
  phoneNumber: string,
  code: string,
): TwilioWhatsAppMessage {
  const baseMessage = {
    from: config.whatsappFrom,
    to: formatTwilioWhatsAppRecipient(phoneNumber),
  }

  if (config.otpMode === 'production') {
    return {
      ...baseMessage,
      contentSid: config.authContentSid,
      contentVariables: JSON.stringify({
        '1': code,
      }),
    }
  }

  return {
    ...baseMessage,
    body: buildOtpMessage(code),
  }
}

function logTwilioWhatsAppProviderConfig(config: TwilioWhatsAppConfig) {
  console.log('OTP provider selected: twilio')
  console.log('OTP channel selected: whatsapp')
  console.log(`OTP mode selected: ${config.otpMode}`)
  console.log(
    `WhatsApp production template configured: ${Boolean(
      config.authContentSid,
    )}`,
  )
}

function logTwilioSmsProviderConfig(config: TwilioSmsConfig) {
  console.log('OTP provider selected: twilio')
  console.log('OTP channel selected: sms')
  console.log(
    `SMS messaging service configured: ${Boolean(
      config.messagingServiceSid,
    )}`,
  )
}

function getSafeTwilioErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      message: 'Unknown Twilio error',
    }
  }

  const details = error as Error & {
    code?: unknown
    status?: unknown
  }

  return {
    message: details.message,
    code: details.code,
    status: details.status,
  }
}

export function createTwilioWhatsAppOtpProvider(
  config: TwilioWhatsAppConfig,
  client?: TwilioMessagesClient,
) {
  validateTwilioWhatsAppConfig(config)
  logTwilioWhatsAppProviderConfig(config)
  const twilioClient = client ?? createTwilioClient(config)

  return {
    async sendOtpCode(
      phoneNumber: string,
      code: string,
      _purpose: OtpPurpose,
    ) {
      try {
        if (config.otpMode === 'production') {
          console.log(
            'Sending OTP via Twilio WhatsApp production template',
          )
        } else {
          console.log('Sending OTP via Twilio WhatsApp sandbox body')
        }

        await twilioClient.messages.create(
          buildTwilioWhatsAppMessage(config, phoneNumber, code),
        )
      } catch (error) {
        console.error(
          'Failed to send OTP with Twilio',
          getSafeTwilioErrorDetails(error),
        )

        throw new Error('Failed to send verification code')
      }
    },
  }
}

export function createTwilioSmsOtpProvider(
  config: TwilioSmsConfig,
  client?: TwilioMessagesClient,
) {
  validateTwilioSmsConfig(config)
  logTwilioSmsProviderConfig(config)
  const twilioClient = client ?? createTwilioClient(config)

  return {
    async sendOtpCode(
      phoneNumber: string,
      code: string,
      _purpose: OtpPurpose,
    ) {
      try {
        console.log('Sending OTP via Twilio SMS')

        await twilioClient.messages.create({
          messagingServiceSid: config.messagingServiceSid,
          to: phoneNumber,
          body: buildOtpMessage(code),
        })
      } catch (error) {
        console.error(
          'Failed to send OTP with Twilio',
          getSafeTwilioErrorDetails(error),
        )

        throw new Error('Failed to send verification code')
      }
    },
  }
}
