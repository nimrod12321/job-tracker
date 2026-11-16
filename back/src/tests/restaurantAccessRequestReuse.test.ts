import assert from 'node:assert/strict'
import test from 'node:test'
import type { NextFunction, Request, Response } from 'express'
import type { RestaurantOwnerProfile } from '../generated/prisma/client.js'
import {
  createRestaurantAccessMiddleware,
  getRequestRestaurantAccess,
  setRequestRestaurantAccesses,
  type RestaurantScopedRequest,
} from '../middleware/restaurantAccess.middleware.js'
import type { RestaurantAccess } from '../services/restaurantAccess.service.js'

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111'

function createAccess(role: RestaurantAccess['role']): RestaurantAccess {
  return {
    restaurant: { id: RESTAURANT_ID } as RestaurantOwnerProfile,
    role,
    membershipId: '22222222-2222-4222-8222-222222222222',
    isLegacyOwner: false,
  }
}

function createResponse() {
  let statusCode = 200
  let responseBody: unknown
  const response = {
    status(code: number) {
      statusCode = code
      return response
    },
    json(body: unknown) {
      responseBody = body
      return response
    },
  } as unknown as Response

  return {
    response,
    getStatusCode: () => statusCode,
    getResponseBody: () => responseBody,
  }
}

test('restaurant access middleware reuses request-scoped discovery', async () => {
  const access = createAccess('hiringManager')
  const request = {
    userId: '33333333-3333-4333-8333-333333333333',
    get(header: string) {
      return header === 'X-Restaurant-Id' ? RESTAURANT_ID : undefined
    },
  } as unknown as RestaurantScopedRequest
  setRequestRestaurantAccesses(request as Request, [access])
  const { response } = createResponse()
  let nextCalls = 0
  let nextError: unknown
  const next: NextFunction = (error?: unknown) => {
    nextCalls += 1
    nextError = error
  }

  await createRestaurantAccessMiddleware()(
    request as Request,
    response,
    next,
  )

  assert.equal(nextCalls, 1)
  assert.equal(nextError, undefined)
  assert.equal(getRequestRestaurantAccess(request as Request), access)
  assert.equal(
    getRequestRestaurantAccess(request as Request)?.role,
    'hiringManager',
  )
})

test('request-scoped reuse still rejects another restaurant', async () => {
  const request = {
    userId: '33333333-3333-4333-8333-333333333333',
    get(header: string) {
      return header === 'X-Restaurant-Id'
        ? '44444444-4444-4444-8444-444444444444'
        : undefined
    },
  } as unknown as RestaurantScopedRequest
  setRequestRestaurantAccesses(request as Request, [createAccess('owner')])
  const { response, getStatusCode, getResponseBody } = createResponse()
  let nextCalls = 0

  await createRestaurantAccessMiddleware()(
    request as Request,
    response,
    () => {
      nextCalls += 1
    },
  )

  assert.equal(nextCalls, 0)
  assert.equal(getStatusCode(), 403)
  assert.deepEqual(getResponseBody(), {
    code: 'restaurant_access_denied',
    message: 'restaurant access required',
  })
})
