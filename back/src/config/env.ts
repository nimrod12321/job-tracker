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

const nodeEnv = process.env.NODE_ENV?.trim() || 'development'
const configuredFrontendUrl = process.env.FRONTEND_URL?.trim()

if (nodeEnv === 'production' && !configuredFrontendUrl) {
  throw new Error('FRONTEND_URL is not set')
}

export const env = {
  databaseUrl: getRequiredEnvironmentVariable('DATABASE_URL'),
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
}
