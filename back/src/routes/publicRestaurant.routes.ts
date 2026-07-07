import { Router } from 'express'
import {
  createPublicRestaurantLead,
  getPublicRestaurant,
} from '../controllers/publicRestaurant.controller.js'

const publicRestaurantRouter = Router()

publicRestaurantRouter.get('/restaurants/:slug', getPublicRestaurant)
publicRestaurantRouter.post(
  '/restaurants/:slug/leads',
  createPublicRestaurantLead,
)

export default publicRestaurantRouter
