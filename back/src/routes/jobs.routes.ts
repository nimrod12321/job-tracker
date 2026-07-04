import { Router } from 'express'
import { analyzeJob } from '../controllers/jobAnalysis.controller.js'
import { fetchJobs } from '../controllers/jobFetch.controller.js'
import { importJob } from '../controllers/jobImport.controller.js'
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

router.post('/fetch', fetchJobs)
router.post('/import', importJob)
router.get('/', getJobs)
router.post('/', createJob)
router.patch('/:id/status', updateJobStatus)
router.post('/:id/analyze', analyzeJob)
router.get('/:id', getJob)
router.delete('/:id', deleteJob)
router.put('/:id', updateJob)

export default router
