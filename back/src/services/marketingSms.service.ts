import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../lib/prisma.js'

const UNSUBSCRIBE_TOKEN_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000

function hashUnsubscribeToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export type MarketingSmsProvider = {
  sendSms: (
    recipientPhone: string,
    body: string,
  ) => Promise<{ providerMessageSid: string }>
}

type MarketingSmsRepository = {
  findEligibleUser: (userId: string) => Promise<{
    id: string
    phoneNumber: string | null
    phoneVerifiedAt: Date | null
    marketingSmsEnabled: boolean
    marketingSmsConsentedAt: Date | null
  } | null>
  createUnsubscribeToken: (input: {
    userId: string
    tokenHash: string
    expiresAt: Date
  }) => Promise<void>
}

const prismaMarketingSmsRepository: MarketingSmsRepository = {
  findEligibleUser(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phoneNumber: true,
        phoneVerifiedAt: true,
        marketingSmsEnabled: true,
        marketingSmsConsentedAt: true,
      },
    })
  },
  async createUnsubscribeToken(input) {
    await prisma.marketingSmsUnsubscribeToken.create({ data: input })
  },
}

export async function sendMarketingSmsAtBoundary(
  input: {
    userId: string
    body: string
    frontendUrl: string
  },
  dependencies: {
    provider: MarketingSmsProvider
    repository?: MarketingSmsRepository
    now?: () => Date
    createToken?: () => string
  },
) {
  const repository =
    dependencies.repository ?? prismaMarketingSmsRepository
  const user = await repository.findEligibleUser(input.userId)

  if (
    !user?.phoneNumber ||
    !user.phoneVerifiedAt ||
    !user.marketingSmsEnabled ||
    !user.marketingSmsConsentedAt
  ) {
    return { sent: false as const, reason: 'not_opted_in' as const }
  }

  const now = dependencies.now?.() ?? new Date()
  const token = dependencies.createToken?.() ?? randomBytes(32).toString('base64url')
  await repository.createUnsubscribeToken({
    userId: user.id,
    tokenHash: hashUnsubscribeToken(token),
    expiresAt: new Date(now.getTime() + UNSUBSCRIBE_TOKEN_LIFETIME_MS),
  })
  const unsubscribeUrl = new URL(
    '/sms/unsubscribe',
    `${input.frontendUrl.replace(/\/+$/, '')}/`,
  )
  unsubscribeUrl.searchParams.set('token', token)
  const body = `${input.body.trim()}\n\nלהסרה מהודעות שיווקיות: ${unsubscribeUrl.toString()}`
  const result = await dependencies.provider.sendSms(user.phoneNumber, body)

  return {
    sent: true as const,
    providerMessageSid: result.providerMessageSid,
  }
}

export async function unsubscribeMarketingSms(rawToken: string) {
  const tokenHash = hashUnsubscribeToken(rawToken)
  const now = new Date()

  return prisma.$transaction(async (transaction) => {
    const token = await transaction.marketingSmsUnsubscribeToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    })

    if (!token || token.usedAt || token.expiresAt <= now) {
      return false
    }

    const claimed = await transaction.marketingSmsUnsubscribeToken.updateMany({
      where: {
        id: token.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    })

    if (claimed.count !== 1) {
      return false
    }

    await transaction.user.update({
      where: { id: token.userId },
      data: {
        marketingSmsEnabled: false,
        marketingSmsOptedOutAt: now,
      },
    })

    return true
  })
}
