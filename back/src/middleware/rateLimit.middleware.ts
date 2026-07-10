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

// Only safe to call after `app.set('trust proxy', ...)` is configured to
// match the real number of reverse proxies in front of this server. With
// that set, Express computes `req.ip` by trusting only that many hops from
// the socket's own address, so a client cannot spoof it by sending a fake
// X-Forwarded-For header — the proxy-appended (trusted) segment always wins.
// Without trust proxy configured, req.ip falls back to the raw socket
// address, which is still safe (just not proxy-aware), never the spoofable
// header.
export function getClientIp(req: Parameters<RequestHandler>[0]) {
  return req.ip || req.socket.remoteAddress || 'unknown'
}

function getClientKey(req: Parameters<RequestHandler>[0]) {
  return getClientIp(req)
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
