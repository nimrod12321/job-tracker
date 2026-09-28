import { Router } from 'express'
import {
  createAnalyticsAcquisition,
  createAnalyticsEvent,
  createOwnerActivityEvent,
  linkOwnerAcquisition,
} from '../controllers/analytics.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { createInMemoryRateLimit } from '../middleware/rateLimit.middleware.js'

const analyticsRouter = Router()
const acquisitionRateLimit = createInMemoryRateLimit({
  maxRequests: 60,
  message: 'too many analytics acquisition requests. Please try again later.',
  windowMs: 15 * 60 * 1000,
})
const eventRateLimit = createInMemoryRateLimit({
  maxRequests: 300,
  message: 'too many analytics event requests. Please try again later.',
  windowMs: 15 * 60 * 1000,
})

analyticsRouter.post(
  '/acquisition',
  acquisitionRateLimit,
  createAnalyticsAcquisition,
)
analyticsRouter.post('/events', eventRateLimit, createAnalyticsEvent)
analyticsRouter.post(
  '/owner-events',
  eventRateLimit,
  requireAuth,
  createOwnerActivityEvent,
)
analyticsRouter.post('/link', eventRateLimit, requireAuth, linkOwnerAcquisition)

export default analyticsRouter
