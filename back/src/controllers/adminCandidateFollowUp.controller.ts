import type { Request, Response } from 'express'
import {
  AdminCandidateFollowUpError,
  getAdminCandidateFollowUps,
  updateAdminCandidateFollowUp,
} from '../services/adminCandidateFollowUp.service.js'
import {
  adminCandidateFollowUpQuerySchema,
  adminCandidateFollowUpUpdateSchema,
} from '../validations/adminCandidateFollowUp.validation.js'
import { getValidationErrorMessage } from '../utils/validation.js'

export async function getAdminCandidateFollowUpList(
  req: Request,
  res: Response,
) {
  try {
    const result = adminCandidateFollowUpQuerySchema.safeParse(req.query)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    return res.json(await getAdminCandidateFollowUps(result.data))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch Admin candidate follow-ups',
    })
  }
}

export async function saveAdminCandidateFollowUp(
  req: Request,
  res: Response,
) {
  try {
    const result = adminCandidateFollowUpUpdateSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const followUp = await updateAdminCandidateFollowUp(result.data)

    return res.json({
      id: followUp.id,
      status: followUp.status,
      privateNote: followUp.privateNote,
      lastAdminContactAt:
        followUp.lastAdminContactAt?.toISOString() ?? null,
      nextFollowUpAt: followUp.nextFollowUpAt?.toISOString() ?? null,
      opportunityConsent: followUp.opportunityConsent,
      opportunityConsentAt:
        followUp.opportunityConsentAt?.toISOString() ?? null,
      opportunityConsentMethod: followUp.opportunityConsentMethod,
      updatedAt: followUp.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof AdminCandidateFollowUpError) {
      return res.status(error.status).json({ message: error.message })
    }

    console.error(error)

    return res.status(500).json({
      message: 'failed to save Admin candidate follow-up',
    })
  }
}
