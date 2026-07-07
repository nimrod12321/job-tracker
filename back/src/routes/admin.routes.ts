import { Router } from 'express'
import {
  getAdminRestaurantLeads,
  updateAdminRestaurantLeadStatus,
} from '../controllers/admin.controller.js'
import { requireAdmin } from '../middleware/admin.middleware.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)
adminRouter.get('/restaurant-leads', getAdminRestaurantLeads)
adminRouter.patch(
  '/restaurant-leads/:id/status',
  updateAdminRestaurantLeadStatus,
)

export default adminRouter
