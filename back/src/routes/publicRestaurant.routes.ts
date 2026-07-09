import { Router } from 'express'
import {
  createPublicRestaurantLead,
  createVerifiedPublicRestaurantLead,
  getPublicRestaurant,
} from '../controllers/publicRestaurant.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { createInMemoryRateLimit } from '../middleware/rateLimit.middleware.js'

const publicRestaurantRouter = Router()
const publicRestaurantLeadRateLimit = createInMemoryRateLimit({
  maxRequests: 30,
  message: 'too many applications submitted. Please try again later.',
  windowMs: 15 * 60 * 1000,
})

publicRestaurantRouter.get('/restaurants/:slug', getPublicRestaurant)
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
