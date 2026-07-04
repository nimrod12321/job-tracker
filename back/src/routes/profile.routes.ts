import { Router } from 'express'
import {
  getProfile,
  uploadResume,
  updateProfile,
} from '../controllers/profile.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { handleResumeUpload } from '../middleware/resumeUpload.middleware.js'

const profileRouter = Router()

profileRouter.use(requireAuth)
profileRouter.post('/resume-upload', handleResumeUpload, uploadResume)
profileRouter.get('/', getProfile)
profileRouter.put('/', updateProfile)

export default profileRouter
