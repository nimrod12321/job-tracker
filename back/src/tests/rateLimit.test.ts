import assert from 'node:assert/strict'
import test from 'node:test'
import type { Request, Response } from 'express'
import {
  createInMemoryRateLimit,
  getClientIp,
} from '../middleware/rateLimit.middleware.js'

function fakeReq(overrides: {
  ip?: string
  forwardedFor?: string
  body?: Record<string, unknown>
}): Request {
  return {
    ip: overrides.ip,
    socket: { remoteAddress: overrides.ip },
    headers: overrides.forwardedFor
      ? { 'x-forwarded-for': overrides.forwardedFor }
      : {},
    body: overrides.body ?? {},
  } as unknown as Request
}

function fakeRes() {
  const res: { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
  }

  return {
    status(code: number) {
      res.statusCode = code
      return this
    },
    json(body: unknown) {
      res.body = body
      return this
    },
    get result() {
      return res
    },
  } as unknown as Response & { result: typeof res }
}

test('getClientIp trusts req.ip, not the raw x-forwarded-for header', () => {
  const req = fakeReq({
    ip: '203.0.113.9',
    forwardedFor: '6.6.6.6, 203.0.113.9',
  })

  assert.equal(getClientIp(req), '203.0.113.9')
})

test('getClientIp falls back to the socket address when req.ip is unset', () => {
  const req = {
    ip: undefined,
    socket: { remoteAddress: '198.51.100.4' },
    headers: { 'x-forwarded-for': '6.6.6.6' },
    body: {},
  } as unknown as Request

  assert.equal(getClientIp(req), '198.51.100.4')
})

test('spoofing x-forwarded-for does not create fresh rate-limit buckets when the trusted IP is unchanged', () => {
  const limiter = createInMemoryRateLimit({
    maxRequests: 3,
    message: 'too many requests',
    windowMs: 60_000,
  })

  const sameClientDifferentHeaders = [
    fakeReq({ ip: '203.0.113.9', forwardedFor: '1.1.1.1' }),
    fakeReq({ ip: '203.0.113.9', forwardedFor: '2.2.2.2' }),
    fakeReq({ ip: '203.0.113.9', forwardedFor: '3.3.3.3' }),
    fakeReq({ ip: '203.0.113.9', forwardedFor: '4.4.4.4' }),
    fakeReq({ ip: '203.0.113.9' }),
  ]

  const statuses: number[] = []

  for (const req of sameClientDifferentHeaders) {
    const res = fakeRes()
    let nextCalled = false
    limiter(req, res, () => {
      nextCalled = true
    })
    statuses.push(nextCalled ? 200 : res.result.statusCode)
  }

  // First 3 requests succeed (maxRequests: 3), regardless of the spoofed
  // x-forwarded-for value on each — every request after that is blocked
  // because they all resolve to the same trusted IP.
  assert.deepEqual(statuses, [200, 200, 200, 429, 429])
})

test('different trusted IPs get independent rate-limit buckets', () => {
  const limiter = createInMemoryRateLimit({
    maxRequests: 1,
    message: 'too many requests',
    windowMs: 60_000,
  })

  const reqA = fakeReq({ ip: '203.0.113.9' })
  const reqB = fakeReq({ ip: '203.0.113.10' })

  let aAllowed = false
  let bAllowed = false

  limiter(reqA, fakeRes(), () => {
    aAllowed = true
  })
  limiter(reqB, fakeRes(), () => {
    bAllowed = true
  })

  assert.equal(aAllowed, true)
  assert.equal(bAllowed, true)
})
