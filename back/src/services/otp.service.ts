import { randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'
import type { OtpVerification } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import { sendOtpCode } from './otpProvider.js'

export type OtpPurpose = 'login' | 'register' | 'qrApply'

function generateOtpCode() {
  const max = 10 ** env.otpCodeLength
  const code = randomInt(0, max).toString()

  return code.padStart(env.otpCodeLength, '0')
}

export async function requestOtpCode(
  phoneNumber: string,
  purpose: OtpPurpose,
) {
  const now = new Date()
  const code = generateOtpCode()
  const codeHash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(
    now.getTime() + env.otpExpiresMinutes * 60 * 1000,
  )

  await prisma.otpVerification.updateMany({
    where: {
      phoneNumber,
      purpose,
      consumedAt: null,
    },
    data: {
      consumedAt: now,
    },
  })

  await prisma.otpVerification.create({
    data: {
      phoneNumber,
      purpose,
      codeHash,
      maxAttempts: env.otpMaxAttempts,
      expiresAt,
    },
  })

  await sendOtpCode(phoneNumber, code, purpose)
}

export async function verifyOtpCode(
  phoneNumber: string,
  purpose: OtpPurpose,
  code: string,
) {
  const otp = await prisma.otpVerification.findFirst({
    where: {
      phoneNumber,
      purpose,
      consumedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!otp) {
    throw new Error('invalid or expired code')
  }

  if (otp.expiresAt.getTime() <= Date.now()) {
    throw new Error('invalid or expired code')
  }

  if (otp.attempts >= otp.maxAttempts) {
    throw new Error('too many invalid attempts. request a new code.')
  }

  const isCodeValid = await bcrypt.compare(code, otp.codeHash)

  if (!isCodeValid) {
    await prisma.otpVerification.update({
      where: {
        id: otp.id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    })

    throw new Error('invalid or expired code')
  }

  return consumeOtpVerification(otp)
}

async function consumeOtpVerification(otp: OtpVerification) {
  return prisma.otpVerification.update({
    where: {
      id: otp.id,
    },
    data: {
      consumedAt: new Date(),
    },
  })
}
