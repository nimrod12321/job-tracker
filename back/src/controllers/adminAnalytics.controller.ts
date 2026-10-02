import type { Request, Response } from 'express'
import {
  getAdminAcquisitionFunnelReport,
  getAdminAcquisitionStageDetails,
} from '../services/adminAnalytics.service.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  adminAcquisitionFunnelQuerySchema,
  adminAcquisitionStageParamsSchema,
  adminAcquisitionStageQuerySchema,
} from '../validations/adminAnalytics.validation.js'

export async function getAdminAcquisitionFunnel(
  req: Request,
  res: Response,
) {
  try {
    const result = adminAcquisitionFunnelQuerySchema.safeParse(req.query)
    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    return res.json(await getAdminAcquisitionFunnelReport(result.data))
  } catch (error) {
    console.error('Failed to build Admin acquisition funnel:', error)
    return res.status(500).json({
      message: 'failed to load acquisition funnel',
    })
  }
}

export async function getAdminAcquisitionFunnelStage(
  req: Request,
  res: Response,
) {
  try {
    const paramsResult = adminAcquisitionStageParamsSchema.safeParse(req.params)
    const queryResult = adminAcquisitionStageQuerySchema.safeParse(req.query)

    if (!paramsResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(paramsResult.error),
      })
    }

    if (!queryResult.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(queryResult.error),
      })
    }

    return res.json(
      await getAdminAcquisitionStageDetails(
        paramsResult.data.stage,
        queryResult.data,
      ),
    )
  } catch (error) {
    console.error('Failed to build Admin acquisition stage details:', error)
    return res.status(500).json({
      message: 'failed to load acquisition stage details',
    })
  }
}
