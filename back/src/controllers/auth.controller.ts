import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { signAuthToken } from '../lib/jwt.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { requestOtpCode, verifyOtpCode } from '../services/otp.service.js'
import {
  getPrimaryRestaurantMembershipRole,
  linkPendingRestaurantMemberships,
} from '../services/restaurantAccess.service.js'
import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  loginSchema,
  registerSchema,
  requestCodeSchema,
  verifyCodeSchema,
} from '../validations/auth.validation.js'

type AuthUserRecord = {
  id: string
  email: string | null
  phoneNumber: string | null
  phoneVerifiedAt: Date | null
  fullName: string
  track: 'highTech' | 'restaurant' | 'restaurantOwner'
  workerLocationRequired: boolean
  createdAt?: Date
}

function isAdminUser(user: {
  email: string | null
  phoneNumber: string | null
}) {
  const normalizedEmail = user.email?.trim().toLowerCase()

  return Boolean(
    (normalizedEmail && env.adminEmails.includes(normalizedEmail)) ||
      (user.phoneNumber && env.adminPhones.includes(user.phoneNumber)),
  )
}

function mapAuthUser(user: AuthUserRecord) {
  return mapAuthUserWithRestaurantRole(user, null)
}

function mapAuthUserWithRestaurantRole(
  user: AuthUserRecord,
  restaurantMemberRole: 'owner' | 'hiringManager' | null,
) {
  return {
    id: user.id,
    ...(user.email ? { email: user.email } : {}),
    phoneNumber: user.phoneNumber,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    fullName: user.fullName,
    track: user.track,
    workerLocationRequired: user.workerLocationRequired,
    restaurantMemberRole,
    isAdmin: isAdminUser(user),
    ...(user.createdAt
      ? {
          createdAt: user.createdAt.toISOString(),
        }
      : {}),
  }
}

export async function register(req: Request, res: Response) {
  try {
    const result = registerSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const { email, password, track } = result.data
    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    })

    if (existingUser) {
      return res.status(409).json({
        message: 'user already exists',
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        track,
        workerLocationRequired: track === 'restaurant',
      },
    })

    return res.status(201).json(mapAuthUser(user))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to register user',
    })
  }
}

export async function login(req: Request, res: Response) {
  try {
    const result = loginSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const { email, password } = result.data
    const normalizedEmail = email.trim().toLowerCase()

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    })

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        message: 'invalid email or password',
      })
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash,
    )

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'invalid email or password',
      })
    }

    const token = signAuthToken(user.id)
    const restaurantMemberRole =
      await getPrimaryRestaurantMembershipRole(user.id)

    return res.json({
      token,
      user: mapAuthUserWithRestaurantRole(user, restaurantMemberRole),
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to login',
    })
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const userId = (req as AuthenticatedRequest).userId

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        phoneVerifiedAt: true,
        fullName: true,
        track: true,
        workerLocationRequired: true,
        createdAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({
        message: 'user not found',
      })
    }

    const restaurantMemberRole =
      await getPrimaryRestaurantMembershipRole(user.id)

    return res.json(mapAuthUserWithRestaurantRole(user, restaurantMemberRole))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch current user',
    })
  }
}

export async function requestCode(req: Request, res: Response) {
  try {
    const result = requestCodeSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    let phoneNumber: string

    try {
      phoneNumber = normalizeIsraeliPhoneNumber(result.data.phoneNumber)
    } catch {
      return res.status(400).json({
        message: 'phone number is invalid',
      })
    }

    try {
      await requestOtpCode(phoneNumber, result.data.purpose)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Failed to send verification code'
      ) {
        return res.status(503).json({
          message: 'Failed to send verification code',
        })
      }

      throw error
    }

    return res.json({
      ok: true,
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to request code',
    })
  }
}

export async function verifyCode(req: Request, res: Response) {
  try {
    const result = verifyCodeSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    if (
      result.data.purpose === 'register' ||
      result.data.purpose === 'qrApply'
    ) {
      if (!result.data.fullName?.trim()) {
        return res.status(400).json({
          message: 'full name is required',
        })
      }

      if (result.data.purpose === 'register' && !result.data.track) {
        return res.status(400).json({
          message: 'track is required',
        })
      }
    }

    let phoneNumber: string

    try {
      phoneNumber = normalizeIsraeliPhoneNumber(result.data.phoneNumber)
    } catch {
      return res.status(400).json({
        message: 'phone number is invalid',
      })
    }

    try {
      await verifyOtpCode(
        phoneNumber,
        result.data.purpose,
        result.data.code,
      )
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : 'invalid or expired code',
      })
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        phoneNumber,
      },
    })

    if (result.data.purpose === 'login') {
      if (!existingUser) {
        return res.status(404).json({
          message: 'account not found. please register first.',
        })
      }

      const token = signAuthToken(existingUser.id)
      await linkPendingRestaurantMemberships(
        existingUser.id,
        existingUser.phoneNumber,
      )
      const restaurantMemberRole =
        await getPrimaryRestaurantMembershipRole(existingUser.id)

      return res.json({
        token,
        user: mapAuthUserWithRestaurantRole(
          existingUser,
          restaurantMemberRole,
        ),
      })
    }

    const now = new Date()
    const fullName = result.data.fullName?.trim() ?? ''
    const track =
      result.data.purpose === 'qrApply'
        ? 'restaurant'
        : result.data.track ?? 'restaurant'
    const user = existingUser
      ? await prisma.user.update({
          where: {
            id: existingUser.id,
          },
          data: {
            fullName: existingUser.fullName || fullName,
            phoneVerifiedAt: existingUser.phoneVerifiedAt ?? now,
            track:
              result.data.purpose === 'qrApply'
                ? existingUser.track
                : track,
          },
        })
      : await prisma.user.create({
          data: {
            phoneNumber,
            phoneVerifiedAt: now,
            fullName,
            track,
            workerLocationRequired: track === 'restaurant',
          },
        })

    await linkPendingRestaurantMemberships(user.id, user.phoneNumber)
    const restaurantMemberRole =
      await getPrimaryRestaurantMembershipRole(user.id)
    const token = signAuthToken(user.id)

    return res.json({
      token,
      user: mapAuthUserWithRestaurantRole(user, restaurantMemberRole),
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to verify code',
    })
  }
}
