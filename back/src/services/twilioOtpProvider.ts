import twilio from 'twilio'

type OtpPurpose = 'login' | 'register' | 'qrApply'

export type OtpProviderKind = 'test' | 'twilio-whatsapp' | 'console'

export type TwilioWhatsAppConfig = {
  accountSid: string
  apiKeySid: string
  apiKeySecret: string
  whatsappFrom: string
}

export type TwilioMessagesClient = {
  messages: {
    create(message: {
      from: string
      to: string
      body: string
    }): Promise<unknown>
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

  return 'console'
}

export function validateTwilioWhatsAppConfig(
  config: TwilioWhatsAppConfig,
) {
  const missingVariables = [
    { name: 'TWILIO_ACCOUNT_SID', value: config.accountSid },
    { name: 'TWILIO_API_KEY_SID', value: config.apiKeySid },
    { name: 'TWILIO_API_KEY_SECRET', value: config.apiKeySecret },
    { name: 'TWILIO_WHATSAPP_FROM', value: config.whatsappFrom },
  ]
    .filter(({ value }) => !value.trim())
    .map(({ name }) => name)

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing Twilio OTP environment variables: ${missingVariables.join(
        ', ',
      )}`,
    )
  }
}

export function formatTwilioWhatsAppRecipient(phoneNumber: string) {
  return `whatsapp:${phoneNumber}`
}

function createTwilioClient(config: TwilioWhatsAppConfig) {
  return twilio(config.apiKeySid, config.apiKeySecret, {
    accountSid: config.accountSid,
  }) as TwilioMessagesClient
}

function buildOtpMessage(code: string) {
  return `Peepss verification code: ${code}`
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
  const twilioClient = client ?? createTwilioClient(config)

  return {
    async sendOtpCode(
      phoneNumber: string,
      code: string,
      _purpose: OtpPurpose,
    ) {
      try {
        await twilioClient.messages.create({
          from: config.whatsappFrom,
          to: formatTwilioWhatsAppRecipient(phoneNumber),
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
