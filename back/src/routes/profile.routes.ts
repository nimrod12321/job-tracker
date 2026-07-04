import { Router } from 'express'
import {
  getProfile,
  updateProfile,
} from '../controllers/profile.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const profileRouter = Router()

profileRouter.use(requireAuth)
profileRouter.get('/', getProfile)
profileRouter.put('/', updateProfile)

export default profileRouter
