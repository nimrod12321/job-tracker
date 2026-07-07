import type { RequestHandler } from 'express'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from './auth.middleware.js'

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId

  if (!userId) {
    res.status(401).json({
      message: 'unauthorized',
    })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        email: true,
      },
    })

    if (
      !user ||
      !env.adminEmails.includes(user.email.trim().toLowerCase())
    ) {
      res.status(403).json({
        message: 'admin access required',
      })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
}
