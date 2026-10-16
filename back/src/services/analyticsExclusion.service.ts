import { env } from '../config/env.js'
import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'

function normalizePhoneForComparison(phoneNumber: string | null) {
  if (!phoneNumber) return null

  try {
    return normalizeIsraeliPhoneNumber(phoneNumber)
  } catch {
    return phoneNumber.trim()
  }
}

export function isAnalyticsExcludedPhone(
  phoneNumber: string | null,
  excludedPhones: readonly string[] = env.analyticsExcludedPhones,
) {
  const normalizedPhoneNumber = normalizePhoneForComparison(phoneNumber)
  if (!normalizedPhoneNumber) return false

  return excludedPhones.some(
    (excludedPhone) =>
      normalizePhoneForComparison(excludedPhone) === normalizedPhoneNumber,
  )
}

export function isAnalyticsExcludedUser(
  user: {
    phoneNumber: string | null
    restaurantWorkerProfile?: { phoneNumber?: string } | null
  },
  excludedPhones: readonly string[] = env.analyticsExcludedPhones,
) {
  return (
    isAnalyticsExcludedPhone(user.phoneNumber, excludedPhones) ||
    isAnalyticsExcludedPhone(
      user.restaurantWorkerProfile?.phoneNumber ?? null,
      excludedPhones,
    )
  )
}
