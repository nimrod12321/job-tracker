import { Router } from 'express'
import {
  createJob,
  deleteJob,
  getJobs,
  updateJobStatus,
  updateJob,
} from '../controllers/jobs.controller.js'

const router = Router()

router.get('/', getJobs)
router.post('/', createJob)
router.patch('/:id/status', updateJobStatus)
router.delete('/:id', deleteJob)
router.put('/:id', updateJob)

export default router