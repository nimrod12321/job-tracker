import type { Request, Response } from 'express'
import { AiServiceError } from '../services/ai.service.js'
import { extractJobFields } from '../services/jobImport.service.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import { jobImportRequestSchema } from '../validations/jobImport.validation.js'

export async function importJob(req: Request, res: Response) {
  try {
    const result = jobImportRequestSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const { jobDescription, jobUrl, source } = result.data
    const extractedFields = await extractJobFields(jobDescription)

    return res.json({
      ...extractedFields,
      status: 'applied',
      jobDescription,
      jobUrl,
      source,
      priority: 'medium',
      dateApplied: '',
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message:
        error instanceof AiServiceError
          ? error.message
          : 'failed to import job',
    })
  }
}
