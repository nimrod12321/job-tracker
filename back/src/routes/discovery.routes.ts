import { Router } from 'express'
import {
  getLikedDiscoveryJobs,
  recordDiscoveryDecision,
} from '../controllers/discovery.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const discoveryRouter = Router()

discoveryRouter.use(requireAuth)
discoveryRouter.post('/decisions', recordDiscoveryDecision)
discoveryRouter.get('/liked', getLikedDiscoveryJobs)

export default discoveryRouter
