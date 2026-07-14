import { Router } from 'express'
import {
  createPublicRestaurantLead,
  createPublicRestaurantQrEvent,
  createVerifiedPublicRestaurantLead,
  getPublicRestaurant,
  getPublicRestaurantClaim,
} from '../controllers/publicRestaurant.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { createInMemoryRateLimit } from '../middleware/rateLimit.middleware.js'

const publicRestaurantRouter = Router()
const publicRestaurantLeadRateLimit = createInMemoryRateLimit({
  maxRequests: 30,
  message: 'too many applications submitted. Please try again later.',
  windowMs: 15 * 60 * 1000,
})
const publicRestaurantQrEventRateLimit = createInMemoryRateLimit({
  maxRequests: 120,
  message: 'too many QR events. Please try again later.',
  windowMs: 15 * 60 * 1000,
})
const publicRestaurantClaimRateLimit = createInMemoryRateLimit({
  maxRequests: 60,
  message: 'too many activation link requests. Please try again later.',
  windowMs: 15 * 60 * 1000,
})

publicRestaurantRouter.get('/restaurants/:slug', getPublicRestaurant)
publicRestaurantRouter.get(
  '/restaurants/:slug/claim',
  publicRestaurantClaimRateLimit,
  getPublicRestaurantClaim,
)
publicRestaurantRouter.post(
  '/restaurants/:slug/qr-events',
  publicRestaurantQrEventRateLimit,
  createPublicRestaurantQrEvent,
)
publicRestaurantRouter.post(
  '/restaurants/:slug/leads',
  publicRestaurantLeadRateLimit,
  createPublicRestaurantLead,
)
publicRestaurantRouter.post(
  '/restaurants/:slug/verified-leads',
  requireAuth,
  publicRestaurantLeadRateLimit,
  createVerifiedPublicRestaurantLead,
)

export default publicRestaurantRouter
