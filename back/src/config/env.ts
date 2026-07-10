import 'dotenv/config'
import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'

function getRequiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is not set`)
  }

  return value
}

function getPort() {
  const port = Number(process.env.PORT ?? 4000)

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be a valid port number')
  }

  return port
}

function getPositiveIntegerEnvironmentVariable(
  name: string,
  defaultValue: number,
) {
  const rawValue = process.env[name]?.trim()

  if (!rawValue) {
    return defaultValue
  }

  const value = Number(rawValue)

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`)
  }

  return value
}

function getOptionalEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim()

  return value || ''
}

function getDatabaseTarget(databaseUrl: string) {
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase()

    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1'
    ) {
      return 'local'
    }

    if (host.includes('neon.tech')) {
      return 'prod'
    }
  } catch {
    return 'unknown'
  }

  return 'unknown'
}

const nodeEnv = process.env.NODE_ENV?.trim() || 'development'
const databaseUrl = getRequiredEnvironmentVariable('DATABASE_URL')
const databaseTarget = getDatabaseTarget(databaseUrl)
const configuredFrontendUrl = process.env.FRONTEND_URL?.trim()
const otpProvider = process.env.OTP_PROVIDER?.trim() || 'console'
const otpChannel = process.env.OTP_CHANNEL?.trim() || 'whatsapp'
const otpMode = process.env.OTP_MODE?.trim() || 'sandbox'
const otpRuntimeProvider = nodeEnv === 'test' ? 'fake' : otpProvider
const otpRuntimeChannel = otpRuntimeProvider === 'fake' ? 'none' : otpChannel
const twilioAccountSid = getOptionalEnvironmentVariable(
  'TWILIO_ACCOUNT_SID',
)
const twilioApiKeySid = getOptionalEnvironmentVariable(
  'TWILIO_API_KEY_SID',
)
const twilioApiKeySecret = getOptionalEnvironmentVariable(
  'TWILIO_API_KEY_SECRET',
)
const twilioWhatsappFrom = getOptionalEnvironmentVariable(
  'TWILIO_WHATSAPP_FROM',
)
const twilioWhatsappAuthContentSid = getOptionalEnvironmentVariable(
  'TWILIO_WHATSAPP_AUTH_CONTENT_SID',
)
const twilioMessagingServiceSid = getOptionalEnvironmentVariable(
  'TWILIO_MESSAGING_SERVICE_SID',
)

if (nodeEnv === 'production' && !configuredFrontendUrl) {
  throw new Error('FRONTEND_URL is not set')
}

if (nodeEnv === 'production' && databaseTarget === 'local') {
  throw new Error('Production must not use a local DATABASE_URL')
}

if (nodeEnv === 'production' && otpProvider === 'console') {
  throw new Error('Production must not use OTP_PROVIDER=console')
}

if (otpProvider === 'twilio' && nodeEnv !== 'test') {
  if (otpChannel !== 'whatsapp' && otpChannel !== 'sms') {
    throw new Error(
      'OTP_CHANNEL must be whatsapp or sms when OTP_PROVIDER=twilio',
    )
  }

  const missingTwilioVariables = [
    { name: 'TWILIO_ACCOUNT_SID', value: twilioAccountSid },
    { name: 'TWILIO_API_KEY_SID', value: twilioApiKeySid },
    { name: 'TWILIO_API_KEY_SECRET', value: twilioApiKeySecret },
    ...(otpChannel === 'whatsapp'
      ? [
          { name: 'TWILIO_WHATSAPP_FROM', value: twilioWhatsappFrom },
          ...(otpMode === 'production'
            ? [
                {
                  name: 'TWILIO_WHATSAPP_AUTH_CONTENT_SID',
                  value: twilioWhatsappAuthContentSid,
                },
              ]
            : []),
        ]
      : [
          {
            name: 'TWILIO_MESSAGING_SERVICE_SID',
            value: twilioMessagingServiceSid,
          },
        ]),
  ]
    .filter(({ value }) => !value)
    .map(({ name }) => name)

  if (missingTwilioVariables.length > 0) {
    throw new Error(
      `Missing Twilio OTP environment variables: ${missingTwilioVariables.join(
        ', ',
      )}`,
    )
  }

  if (otpMode !== 'sandbox' && otpMode !== 'production') {
    throw new Error('OTP_MODE must be sandbox or production')
  }
}

export const env = {
  databaseUrl,
  databaseTarget,
  jwtSecret: getRequiredEnvironmentVariable('JWT_SECRET'),
  port: getPort(),
  frontendUrl:
    configuredFrontendUrl?.replace(/\/+$/, '') ||
    'http://localhost:5173',
  nodeEnv,
  adminEmails: (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  adminPhones: (process.env.ADMIN_PHONES ?? '')
    .split(',')
    .map((phoneNumber) => phoneNumber.trim())
    .filter(Boolean)
    .flatMap((phoneNumber) => {
      try {
        return [normalizeIsraeliPhoneNumber(phoneNumber)]
      } catch {
        return []
      }
    }),
  otpCodeLength: getPositiveIntegerEnvironmentVariable(
    'OTP_CODE_LENGTH',
    4,
  ),
  otpExpiresMinutes: getPositiveIntegerEnvironmentVariable(
    'OTP_EXPIRES_MINUTES',
    5,
  ),
  otpMaxAttempts: getPositiveIntegerEnvironmentVariable(
    'OTP_MAX_ATTEMPTS',
    5,
  ),
  otpProvider,
  otpChannel,
  otpMode,
  otpRuntimeProvider,
  otpRuntimeChannel,
  twilioAccountSid,
  twilioApiKeySid,
  twilioApiKeySecret,
  twilioWhatsappFrom,
  twilioWhatsappAuthContentSid,
  twilioMessagingServiceSid,
}
