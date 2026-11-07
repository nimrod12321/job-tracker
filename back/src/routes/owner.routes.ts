import { Router, type RequestHandler } from 'express'
import {
  createOwnerJob,
  completeOwnerRestaurantClaim,
  deleteOwnerApplication,
  deleteOwnerJob,
  deleteOwnerLead,
  addOwnerTeamMember,
  getAllOwnerApplications,
  getAllOwnerLeads,
  getOwnerApplications,
  getOwnerJobs,
  getOwnerLeads,
  getOwnerProfile,
  getOwnerRestaurants,
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
import {
  requireRestaurantAccess,
  resolveOwnerProfileRestaurantAccess,
} from '../middleware/restaurantAccess.middleware.js'
import { getAccessibleRestaurantsForUser } from '../services/restaurantAccess.service.js'

const ownerRouter = Router()

ownerRouter.post(
  '/claims/:slug/complete',
  requireAuth,
  completeOwnerRestaurantClaim,
)

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

    const accesses = await getAccessibleRestaurantsForUser(userId)

    if (user?.track !== 'restaurantOwner' && accesses.length === 0) {
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
ownerRouter.get('/restaurants', getOwnerRestaurants)
ownerRouter.get('/applications/all', getAllOwnerApplications)
ownerRouter.get('/leads/all', getAllOwnerLeads)
ownerRouter.get(
  '/profile',
  resolveOwnerProfileRestaurantAccess,
  getOwnerProfile,
)
ownerRouter.put(
  '/profile',
  resolveOwnerProfileRestaurantAccess,
  updateOwnerProfile,
)
ownerRouter.use(requireRestaurantAccess)
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
