import { Router, type RequestHandler } from 'express'
import {
  createOwnerJob,
  deleteOwnerApplication,
  deleteOwnerJob,
  deleteOwnerLead,
  addOwnerTeamMember,
  getOwnerApplications,
  getOwnerJobs,
  getOwnerLeads,
  getOwnerProfile,
  getOwnerTeam,
  publishOwnerJob,
  removeOwnerTeamMember,
  setOwnerJobActive,
  updateOwnerApplicationStatus,
  updateOwnerJob,
  updateOwnerLeadStatus,
  updateOwnerProfile,
  updateOwnerQrRoles,
} from '../controllers/owner.controller.js'
import { prisma } from '../lib/prisma.js'
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth.middleware.js'
import { getRestaurantAccessForUser } from '../services/restaurantAccess.service.js'

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

    const access = await getRestaurantAccessForUser(userId)

    if (user?.track !== 'restaurantOwner' && !access) {
      res.status(403).json({
        message: 'restaurant access required',
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
ownerRouter.patch('/qr-roles', updateOwnerQrRoles)
ownerRouter.get('/team', getOwnerTeam)
ownerRouter.post('/team/members', addOwnerTeamMember)
ownerRouter.delete('/team/members/:memberId', removeOwnerTeamMember)
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
