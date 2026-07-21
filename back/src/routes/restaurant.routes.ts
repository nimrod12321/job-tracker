import { Router } from 'express'
import {
  createRestaurantApplication,
  getRestaurantExploreJobs,
  getRestaurantMatches,
  getRestaurantMapJobs,
  getRestaurantProfile,
  updateRestaurantProfile,
} from '../controllers/restaurant.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const restaurantRouter = Router()

restaurantRouter.use(requireAuth)
restaurantRouter.get('/profile', getRestaurantProfile)
restaurantRouter.put('/profile', updateRestaurantProfile)
restaurantRouter.post('/explore', getRestaurantExploreJobs)
restaurantRouter.get('/jobs/map', getRestaurantMapJobs)
restaurantRouter.post('/applications', createRestaurantApplication)
restaurantRouter.get('/matches', getRestaurantMatches)

export default restaurantRouter
