import { env } from '../config/env.js'
import {
  createTwilioWhatsAppOtpProvider,
  resolveOtpProviderKind,
} from './twilioOtpProvider.js'

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
  const providerKind = resolveOtpProviderKind({
    nodeEnv: env.nodeEnv,
    otpProvider: env.otpProvider,
    otpChannel: env.otpChannel,
  })

  if (providerKind === 'test') {
    testOtpCodes.set(getOtpKey(phoneNumber, purpose), code)
    return
  }

  if (providerKind === 'twilio-whatsapp') {
    const provider = createTwilioWhatsAppOtpProvider({
      accountSid: env.twilioAccountSid,
      apiKeySid: env.twilioApiKeySid,
      apiKeySecret: env.twilioApiKeySecret,
      whatsappFrom: env.twilioWhatsappFrom,
    })

    await provider.sendOtpCode(phoneNumber, code, purpose)
    return
  }

  if (providerKind === 'console') {
    console.log(`OTP code for ${phoneNumber}: ${code}`)
    return
  }
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
