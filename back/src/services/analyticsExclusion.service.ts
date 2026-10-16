import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
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

export function isAnalyticsExcludedCandidatePhone(
  phoneNumber: string | null,
  excludedPhones: readonly string[] = env.analyticsExcludedPhones,
) {
  return isAnalyticsExcludedPhone(phoneNumber, excludedPhones)
}

export function getAnalyticsExcludedPhones() {
  return new Set(env.analyticsExcludedPhones)
}

export async function getAnalyticsExcludedUserIds() {
  if (env.analyticsExcludedPhones.length === 0) {
    return new Set<string>()
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        {
          phoneNumber: {
            not: null,
          },
        },
        {
          restaurantWorkerProfile: {
            isNot: null,
          },
        },
      ],
    },
    select: {
      id: true,
      phoneNumber: true,
      restaurantWorkerProfile: {
        select: {
          phoneNumber: true,
        },
      },
    },
  })

  return new Set(
    users
      .filter((user) => isAnalyticsExcludedUser(user))
      .map((user) => user.id),
  )
}
