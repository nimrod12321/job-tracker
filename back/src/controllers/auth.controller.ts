import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { signAuthToken } from '../lib/jwt.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  loginSchema,
  registerSchema,
} from '../validations/auth.validation.js'

function isAdminEmail(email: string) {
  return env.adminEmails.includes(email.trim().toLowerCase())
}

function mapAuthUser(user: {
  id: string
  email: string
  track: 'highTech' | 'restaurant' | 'restaurantOwner'
  createdAt?: Date
}) {
  return {
    id: user.id,
    email: user.email,
    track: user.track,
    isAdmin: isAdminEmail(user.email),
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

    if (!user) {
      return res.status(401).json({
        message: 'invalid email or password',
      })
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'invalid email or password',
      })
    }

    const token = signAuthToken(user.id)

    return res.json({
      token,
      user: mapAuthUser(user),
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
        track: true,
        createdAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({
        message: 'user not found',
      })
    }

    return res.json(mapAuthUser(user))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch current user',
    })
  }
}
