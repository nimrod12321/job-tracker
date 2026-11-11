import { Router } from 'express'
import {
  createAdminRestaurant,
  deleteAdminRestaurant,
  getAdminCandidates,
  getAdminRestaurantDetail,
  getAdminRestaurantLeads,
  getAdminRestaurants,
  markAdminRestaurantSeen,
  regenerateAdminRestaurantClaim,
  updateAdminRestaurant,
  updateAdminRestaurantJobBoardRoles,
  updateAdminRestaurantLocation,
  updateAdminRestaurantLeadStatus,
  updateAdminRestaurantQrRoles,
} from '../controllers/admin.controller.js'
import { requireAdmin } from '../middleware/admin.middleware.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
  getAdminAcquisitionFunnel,
  getAdminAcquisitionFunnelStage,
  getAdminWantedRoleDrilldown,
} from '../controllers/adminAnalytics.controller.js'
import {
  addAdminRestaurantHiringManager,
  getAdminRestaurantTeam,
  removeAdminRestaurantHiringManager,
  replaceAdminRestaurantOwner,
} from '../controllers/adminRestaurantTeam.controller.js'

const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)
adminRouter.get('/analytics/acquisition-funnel', getAdminAcquisitionFunnel)
adminRouter.get(
  '/analytics/acquisition-funnel/stage/:stage',
  getAdminAcquisitionFunnelStage,
)
adminRouter.get(
  '/analytics/user-insights/wanted-roles/:role',
  getAdminWantedRoleDrilldown,
)
adminRouter.get('/restaurants', getAdminRestaurants)
adminRouter.get('/candidates', getAdminCandidates)
adminRouter.post('/restaurants', createAdminRestaurant)
adminRouter.post('/restaurants/:id/mark-seen', markAdminRestaurantSeen)
adminRouter.get('/restaurants/:id', getAdminRestaurantDetail)
adminRouter.get('/restaurants/:id/team', getAdminRestaurantTeam)
adminRouter.post(
  '/restaurants/:id/team/hiring-managers',
  addAdminRestaurantHiringManager,
)
adminRouter.delete(
  '/restaurants/:id/team/members/:memberId',
  removeAdminRestaurantHiringManager,
)
adminRouter.post(
  '/restaurants/:id/team/owners/:memberId/replace',
  replaceAdminRestaurantOwner,
)
adminRouter.patch('/restaurants/:id', updateAdminRestaurant)
adminRouter.patch(
  '/restaurants/:id/qr-roles',
  updateAdminRestaurantQrRoles,
)
adminRouter.patch(
  '/restaurants/:id/job-board-roles',
  updateAdminRestaurantJobBoardRoles,
)
adminRouter.patch(
  '/restaurants/:id/location',
  updateAdminRestaurantLocation,
)
adminRouter.post(
  '/restaurants/:id/claim/regenerate',
  regenerateAdminRestaurantClaim,
)
adminRouter.delete('/restaurants/:id', deleteAdminRestaurant)
adminRouter.get('/restaurant-leads', getAdminRestaurantLeads)
adminRouter.patch(
  '/restaurant-leads/:id/status',
  updateAdminRestaurantLeadStatus,
)

export default adminRouter
