import { Router, type Request } from 'express'
import {
  getMe,
  login,
  register,
  requestCode,
  verifyCode,
} from '../controllers/auth.controller.js'
import {
  createInMemoryRateLimit,
  getClientIp,
} from '../middleware/rateLimit.middleware.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'


export const authRouter = Router()
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

function getClientIdentifier(req: Request) {
  const ip = getClientIp(req)
  const body = req.body as { phoneNumber?: unknown }
  const rawPhoneNumber =
    typeof body.phoneNumber === 'string' ? body.phoneNumber : ''

  try {
    return `${ip}:${normalizeIsraeliPhoneNumber(rawPhoneNumber)}`
  } catch {
    return `${ip}:${rawPhoneNumber.trim()}`
  }
}

function getEmailClientIdentifier(req: Request) {
  const ip = getClientIp(req)
  const body = req.body as { email?: unknown }
  const rawEmail =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  return `${ip}:${rawEmail}`
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

// Legacy email/password auth. The current UI only exposes phone-OTP, but
// these endpoints are still live in the backend, so they still need
// brute-force protection.
const loginRateLimit = createInMemoryRateLimit({
  keyGenerator: (req) => `login:${getEmailClientIdentifier(req)}`,
  maxRequests: 10,
  message: 'too many login attempts. please try again later.',
  windowMs: OTP_RATE_LIMIT_WINDOW_MS,
})

const registerRateLimit = createInMemoryRateLimit({
  keyGenerator: (req) => `register:${getEmailClientIdentifier(req)}`,
  maxRequests: 10,
  message: 'too many registration attempts. please try again later.',
  windowMs: OTP_RATE_LIMIT_WINDOW_MS,
})

authRouter.post('/register', registerRateLimit, register)
authRouter.post('/login', loginRateLimit, login)
authRouter.post('/request-code', requestCodeRateLimit, requestCode)
authRouter.post('/verify-code', verifyCodeRateLimit, verifyCode)
authRouter.get('/me', requireAuth, getMe)
