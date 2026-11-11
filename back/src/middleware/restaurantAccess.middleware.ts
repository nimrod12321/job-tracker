import type { Request, RequestHandler } from 'express'
import type { RestaurantAccess } from '../services/restaurantAccess.service.js'
import {
  ensureOwnerMembershipForUser,
  getAccessibleRestaurantsForUser,
  hasExistingRestaurantAssociationForUser,
  resolveRestaurantAccessForUser,
} from '../services/restaurantAccess.service.js'
import type { AuthenticatedRequest } from './auth.middleware.js'

export interface RestaurantScopedRequest extends AuthenticatedRequest {
  restaurantAccess?: RestaurantAccess
}

type RestaurantAccessMiddlewareOptions = {
  allowNoRestaurant?: boolean
}

export function getRequestRestaurantAccess(req: Request) {
  return (req as RestaurantScopedRequest).restaurantAccess ?? null
}

export function createRestaurantAccessMiddleware(
  options: RestaurantAccessMiddlewareOptions = {},
): RequestHandler {
  return async (req, res, next) => {
    const scopedRequest = req as RestaurantScopedRequest
    const userId = scopedRequest.userId

    if (!userId) {
      res.status(401).json({ message: 'unauthorized' })
      return
    }

    try {
      const requestedRestaurantId = req.get('X-Restaurant-Id')?.trim()
      const resolution = await resolveRestaurantAccessForUser(
        userId,
        requestedRestaurantId,
      )

      if (resolution.status === 'resolved') {
        if (resolution.access.isLegacyOwner) {
          await ensureOwnerMembershipForUser(
            resolution.access.restaurant,
            userId,
          )

          const refreshedResolution =
            await resolveRestaurantAccessForUser(
              userId,
              requestedRestaurantId,
            )

          if (refreshedResolution.status === 'selectionRequired') {
            res.status(409).json({
              code: 'restaurant_selection_required',
              message: 'restaurant selection required',
            })
            return
          }

          if (refreshedResolution.status !== 'resolved') {
            res.status(403).json({
              code: 'restaurant_access_denied',
              message: 'restaurant access required',
            })
            return
          }

          scopedRequest.restaurantAccess = refreshedResolution.access
          next()
          return
        }

        scopedRequest.restaurantAccess = resolution.access
        next()
        return
      }

      if (resolution.status === 'selectionRequired') {
        res.status(409).json({
          code: 'restaurant_selection_required',
          message: 'restaurant selection required',
        })
        return
      }

      if (options.allowNoRestaurant && !requestedRestaurantId) {
        const accesses = await getAccessibleRestaurantsForUser(userId)

        if (
          accesses.length === 0 &&
          !(await hasExistingRestaurantAssociationForUser(userId))
        ) {
          next()
          return
        }
      }

      res.status(403).json({
        code: 'restaurant_access_denied',
        message: 'restaurant access required',
      })
    } catch (error) {
      next(error)
    }
  }
}

export const requireRestaurantAccess =
  createRestaurantAccessMiddleware()

export const resolveOwnerProfileRestaurantAccess =
  createRestaurantAccessMiddleware({ allowNoRestaurant: true })
