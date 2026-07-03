import { Router } from 'express'
import {requireAuth} from '../middleware/auth.middleware.js'
import {
  createJob,
  deleteJob,
  getJobs,
  updateJobStatus,
  updateJob,
} from '../controllers/jobs.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', getJobs)
router.post('/', createJob)
router.patch('/:id/status', updateJobStatus)
router.delete('/:id', deleteJob)
router.put('/:id', updateJob)

export default router