import { Router } from 'express'
import {
  createAdminRestaurant,
  deleteAdminRestaurant,
  getAdminRestaurantDetail,
  getAdminRestaurantLeads,
  getAdminRestaurants,
  markAdminRestaurantSeen,
  regenerateAdminRestaurantClaim,
  updateAdminRestaurant,
  updateAdminRestaurantLeadStatus,
} from '../controllers/admin.controller.js'
import { requireAdmin } from '../middleware/admin.middleware.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)
adminRouter.get('/restaurants', getAdminRestaurants)
adminRouter.post('/restaurants', createAdminRestaurant)
adminRouter.post('/restaurants/:id/mark-seen', markAdminRestaurantSeen)
adminRouter.get('/restaurants/:id', getAdminRestaurantDetail)
adminRouter.patch('/restaurants/:id', updateAdminRestaurant)
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
