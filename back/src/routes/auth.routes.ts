import { Router, type Request } from 'express'
import {
  getMe,
  login,
  register,
  requestCode,
  verifyCode,
} from '../controllers/auth.controller.js'
import { createInMemoryRateLimit } from '../middleware/rateLimit.middleware.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'


export const authRouter = Router()
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

function getClientIdentifier(req: Request) {
  const forwardedFor = req.headers['x-forwarded-for']
  const ip =
    typeof forwardedFor === 'string' && forwardedFor.trim()
      ? forwardedFor.split(',')[0]?.trim()
      : req.ip || req.socket.remoteAddress || 'unknown'
  const body = req.body as { phoneNumber?: unknown }
  const rawPhoneNumber =
    typeof body.phoneNumber === 'string' ? body.phoneNumber : ''

  try {
    return `${ip}:${normalizeIsraeliPhoneNumber(rawPhoneNumber)}`
  } catch {
    return `${ip}:${rawPhoneNumber.trim()}`
  }
}

const requestCodeRateLimit = createInMemoryRateLimit({
  keyGenerator: (req) => `request-code:${getClientIdentifier(req)}`,
  maxRequests: 5,
  message: 'too many code requests. please try again later.',
  windowMs: OTP_RATE_LIMIT_WINDOW_MS,
})

const verifyCodeRateLimit = createInMemoryRateLimit({
  keyGenerator: (req) => `verify-code:${getClientIdentifier(req)}`,
  maxRequests: 20,
  message: 'too many verification attempts. please try again later.',
  windowMs: OTP_RATE_LIMIT_WINDOW_MS,
})

authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.post('/request-code', requestCodeRateLimit, requestCode)
authRouter.post('/verify-code', verifyCodeRateLimit, verifyCode)
authRouter.get('/me', requireAuth, getMe)
