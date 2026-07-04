import { Router } from 'express'
import { analyzeJob } from '../controllers/jobAnalysis.controller.js'
import {
  createJob,
  deleteJob,
  getJob,
  getJobs,
  updateJobStatus,
  updateJob,
} from '../controllers/jobs.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()
router.use(requireAuth)

router.get('/', getJobs)
router.post('/', createJob)
router.patch('/:id/status', updateJobStatus)
router.post('/:id/analyze', analyzeJob)
router.get('/:id', getJob)
router.delete('/:id', deleteJob)
router.put('/:id', updateJob)

export default router
