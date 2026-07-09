import type { RequestHandler } from 'express'

type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimitOptions = {
  keyGenerator?: (req: Parameters<RequestHandler>[0]) => string
  maxRequests: number
  message: string
  windowMs: number
}

function getClientKey(req: Parameters<RequestHandler>[0]) {
  const forwardedFor = req.headers['x-forwarded-for']

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim() || req.ip || 'unknown'
  }

  return req.ip || req.socket.remoteAddress || 'unknown'
}

export function createInMemoryRateLimit({
  keyGenerator,
  maxRequests,
  message,
  windowMs,
}: RateLimitOptions): RequestHandler {
  const entries = new Map<string, RateLimitEntry>()

  return (req, res, next) => {
    const now = Date.now()
    const key = keyGenerator
      ? keyGenerator(req)
      : `${getClientKey(req)}:${req.method}:${req.originalUrl}`
    const existingEntry = entries.get(key)

    if (!existingEntry || existingEntry.resetAt <= now) {
      entries.set(key, {
        count: 1,
        resetAt: now + windowMs,
      })
      next()
      return
    }

    if (existingEntry.count >= maxRequests) {
      res.status(429).json({
        message,
      })
      return
    }

    existingEntry.count += 1
    next()
  }
}
