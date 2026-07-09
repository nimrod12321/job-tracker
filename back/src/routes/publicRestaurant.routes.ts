import { Router } from 'express'
import {
  createPublicRestaurantLead,
  getPublicRestaurant,
} from '../controllers/publicRestaurant.controller.js'
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

export default publicRestaurantRouter
