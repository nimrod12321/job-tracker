import { Router } from 'express'
import {
  createRestaurantApplication,
  getRestaurantExploreJobs,
  getRestaurantProfile,
  updateRestaurantProfile,
} from '../controllers/restaurant.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const restaurantRouter = Router()

restaurantRouter.use(requireAuth)
restaurantRouter.get('/profile', getRestaurantProfile)
restaurantRouter.put('/profile', updateRestaurantProfile)
restaurantRouter.post('/explore', getRestaurantExploreJobs)
restaurantRouter.post('/applications', createRestaurantApplication)

export default restaurantRouter
