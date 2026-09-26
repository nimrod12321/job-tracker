import type { Request, RequestHandler } from 'express'
import { verifyAuthToken } from '../lib/jwt.js'

export interface AuthenticatedRequest extends Request {
  userId?: string
  authMethod?: 'otp'
  ownerAcquisitionId?: string
  ownerAcquisitionFlow?: 'selfServe' | 'claim' | 'pendingPhone'
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

    const authenticatedRequest = req as AuthenticatedRequest
    authenticatedRequest.userId = payload.userId
    if (payload.authMethod) {
      authenticatedRequest.authMethod = payload.authMethod
    }
    if (payload.ownerAcquisitionId) {
      authenticatedRequest.ownerAcquisitionId = payload.ownerAcquisitionId
    }
    if (payload.ownerAcquisitionFlow) {
      authenticatedRequest.ownerAcquisitionFlow =
        payload.ownerAcquisitionFlow
    }

    return next()
  } catch (error) {
    return res.status(401).json({
      message: 'invalid or expired token',
    })
  }
}
