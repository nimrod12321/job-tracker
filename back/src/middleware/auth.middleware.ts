import type { Request, RequestHandler } from 'express'
import { verifyAuthToken } from '../lib/jwt.js'

export interface AuthenticatedRequest extends Request {
  userId?: string
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'missing authorization token',
    })
  }

  const token = authHeader.slice('Bearer '.length)

  try {
    const payload = verifyAuthToken(token)

    ;(req as AuthenticatedRequest).userId = payload.userId

    return next()
  } catch (error) {
    return res.status(401).json({
      message: 'invalid or expired token',
    })
  }
}