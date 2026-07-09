import { env } from '../config/env.js'

type OtpPurpose = 'login' | 'register' | 'qrApply'

const testOtpCodes = new Map<string, string>()

function getOtpKey(phoneNumber: string, purpose: OtpPurpose) {
  return `${purpose}:${phoneNumber}`
}

export async function sendOtpCode(
  phoneNumber: string,
  code: string,
  purpose: OtpPurpose,
) {
  if (env.nodeEnv === 'test') {
    testOtpCodes.set(getOtpKey(phoneNumber, purpose), code)
    return
  }

  if (env.nodeEnv !== 'production') {
    console.log(`OTP code for ${phoneNumber}: ${code}`)
    return
  }

  throw new Error('OTP provider is not configured')
}

export function getCapturedOtpCodeForTest(
  phoneNumber: string,
  purpose: OtpPurpose,
) {
  if (env.nodeEnv !== 'test') {
    throw new Error('captured OTP codes are only available in tests')
  }

  return testOtpCodes.get(getOtpKey(phoneNumber, purpose)) ?? null
}
