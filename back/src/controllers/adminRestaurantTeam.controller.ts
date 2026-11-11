import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import {
  addRestaurantHiringManager,
  getRestaurantTeam,
  removeRestaurantHiringManager,
  replaceRestaurantOwner,
  RestaurantTeamError,
} from '../services/restaurantTeam.service.js'
import {
  adminRestaurantIdSchema,
  adminRestaurantMemberIdSchema,
  adminRestaurantTeamMemberSchema,
} from '../validations/admin.validation.js'
import { getValidationErrorMessage } from '../utils/validation.js'

function mapAdminRestaurantTeamMember(member: {
  id: string
  phoneNumber: string
  displayName: string
  role: 'owner' | 'hiringManager'
  status: 'active' | 'pending' | 'removed'
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    fullName: string
    phoneNumber: string | null
  } | null
}) {
  return {
    id: member.id,
    phoneNumber: member.phoneNumber,
    displayName: member.displayName,
    role: member.role,
    status: member.status,
    user: member.user,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  }
}

function sendTeamError(res: Response, error: unknown, fallback: string) {
  if (error instanceof RestaurantTeamError) {
    return res.status(error.status).json({
      code: error.code,
      message: error.message,
    })
  }

  console.error(error)
  return res.status(500).json({ message: fallback })
}

function parseRestaurantId(req: Request, res: Response) {
  const result = adminRestaurantIdSchema.safeParse(req.params.id)

  if (!result.success) {
    res.status(400).json({
      message: getValidationErrorMessage(result.error),
    })
    return null
  }

  return result.data
}

export async function getAdminRestaurantTeam(
  req: Request,
  res: Response,
) {
  try {
    const restaurantId = parseRestaurantId(req, res)

    if (!restaurantId) {
      return
    }

    const members = await getRestaurantTeam(restaurantId)

    return res.json({
      restaurantId,
      members: members.map(mapAdminRestaurantTeamMember),
    })
  } catch (error) {
    return sendTeamError(res, error, 'failed to fetch restaurant team')
  }
}

export async function addAdminRestaurantHiringManager(
  req: Request,
  res: Response,
) {
  try {
    const adminUserId = (req as AuthenticatedRequest).userId
    const restaurantId = parseRestaurantId(req, res)
    const bodyResult = adminRestaurantTeamMemberSchema.safeParse(req.body)

    if (!adminUserId) {
      return res.status(401).json({ message: 'unauthorized' })
    }

    if (!restaurantId) {
      return
    }

    if (!bodyResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(bodyResult.error),
      })
    }

    const result = await addRestaurantHiringManager({
      restaurantId,
      phoneNumber: bodyResult.data.phoneNumber,
      ...(bodyResult.data.displayName !== undefined
        ? { displayName: bodyResult.data.displayName }
        : {}),
      invitedByUserId: adminUserId,
    })

    return res
      .status(result.created ? 201 : 200)
      .json(mapAdminRestaurantTeamMember(result.member))
  } catch (error) {
    return sendTeamError(res, error, 'failed to add hiring manager')
  }
}

export async function removeAdminRestaurantHiringManager(
  req: Request,
  res: Response,
) {
  try {
    const restaurantId = parseRestaurantId(req, res)
    const memberIdResult = adminRestaurantMemberIdSchema.safeParse(
      req.params.memberId,
    )

    if (!restaurantId) {
      return
    }

    if (!memberIdResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(memberIdResult.error),
      })
    }

    await removeRestaurantHiringManager({
      restaurantId,
      memberId: memberIdResult.data,
    })

    return res.status(204).send()
  } catch (error) {
    return sendTeamError(res, error, 'failed to remove hiring manager')
  }
}

export async function replaceAdminRestaurantOwner(
  req: Request,
  res: Response,
) {
  try {
    const adminUserId = (req as AuthenticatedRequest).userId
    const restaurantId = parseRestaurantId(req, res)
    const memberIdResult = adminRestaurantMemberIdSchema.safeParse(
      req.params.memberId,
    )
    const bodyResult = adminRestaurantTeamMemberSchema.safeParse(req.body)

    if (!adminUserId) {
      return res.status(401).json({ message: 'unauthorized' })
    }

    if (!restaurantId) {
      return
    }

    if (!memberIdResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(memberIdResult.error),
      })
    }

    if (!bodyResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(bodyResult.error),
      })
    }

    const member = await replaceRestaurantOwner({
      restaurantId,
      selectedOwnerMemberId: memberIdResult.data,
      phoneNumber: bodyResult.data.phoneNumber,
      ...(bodyResult.data.displayName !== undefined
        ? { displayName: bodyResult.data.displayName }
        : {}),
      changedByUserId: adminUserId,
    })

    return res.json(mapAdminRestaurantTeamMember(member))
  } catch (error) {
    return sendTeamError(res, error, 'failed to replace restaurant owner')
  }
}
