import { Router, type RequestHandler } from 'express'
import {
  createOwnerJob,
  deleteOwnerApplication,
  deleteOwnerJob,
  deleteOwnerLead,
  getOwnerApplications,
  getOwnerJobs,
  getOwnerLeads,
  getOwnerProfile,
  publishOwnerJob,
  setOwnerJobActive,
  updateOwnerApplicationStatus,
  updateOwnerJob,
  updateOwnerLeadStatus,
  updateOwnerProfile,
} from '../controllers/owner.controller.js'
import { prisma } from '../lib/prisma.js'
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth.middleware.js'

const ownerRouter = Router()

const requireRestaurantOwner: RequestHandler = async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId

  if (!userId) {
    res.status(401).json({
      message: 'unauthorized',
    })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        track: true,
      },
    })

    if (user?.track !== 'restaurantOwner') {
      res.status(403).json({
        message: 'restaurant owner access required',
      })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
}

ownerRouter.use(requireAuth, requireRestaurantOwner)
ownerRouter.get('/profile', getOwnerProfile)
ownerRouter.put('/profile', updateOwnerProfile)
ownerRouter.get('/jobs', getOwnerJobs)
ownerRouter.post('/jobs', createOwnerJob)
ownerRouter.put('/jobs/:id', updateOwnerJob)
ownerRouter.post('/jobs/:id/publish', publishOwnerJob)
ownerRouter.patch('/jobs/:id/active', setOwnerJobActive)
ownerRouter.delete('/jobs/:id', deleteOwnerJob)
ownerRouter.get('/applications', getOwnerApplications)
ownerRouter.patch(
  '/applications/:id/status',
  updateOwnerApplicationStatus,
)
ownerRouter.delete('/applications/:id', deleteOwnerApplication)
ownerRouter.get('/leads', getOwnerLeads)
ownerRouter.patch('/leads/:id/status', updateOwnerLeadStatus)
ownerRouter.delete('/leads/:id', deleteOwnerLead)

export default ownerRouter
