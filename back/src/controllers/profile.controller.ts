import type { Request, Response } from 'express'
import type { ResumeProfile as PrismaResumeProfile } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import {
  extractResumeText,
  ResumeParseError,
} from '../services/resumeParser.service.js'
import { parseResumeProfile } from '../services/resumeProfileParser.service.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import { updateProfileSchema } from '../validations/profile.validation.js'

type ProfileResponse = {
  id: string
  fullName: string
  targetRole: string
  location: string
  salaryExpectation: number
  skills: string
  experienceText: string
  resumeText: string
  createdAt: string
  updatedAt: string
}

function getUserId(req: Request) {
  return (req as AuthenticatedRequest).userId
}

function mapProfileToResponse(profile: PrismaResumeProfile): ProfileResponse {
  return {
    id: profile.id,
    fullName: profile.fullName,
    targetRole: profile.targetRole,
    location: profile.location,
    salaryExpectation: profile.salaryExpectation,
    skills: profile.skills,
    experienceText: profile.experienceText,
    resumeText: profile.resumeText,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const profile = await prisma.resumeProfile.findUnique({
      where: {
        userId,
      },
    })

    return res.json(profile ? mapProfileToResponse(profile) : null)
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch profile',
    })
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const result = updateProfileSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const profile = await prisma.resumeProfile.upsert({
      where: {
        userId,
      },
      update: result.data,
      create: {
        ...result.data,
        userId,
      },
    })

    return res.json(mapProfileToResponse(profile))
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to save profile',
    })
  }
}

export async function uploadResume(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({
      message: 'resume PDF is required',
    })
  }

  try {
    const resumeText = await extractResumeText(req.file.buffer)

    try {
      const parsedProfile = await parseResumeProfile(resumeText)

      return res.json({
        resumeText,
        profileDraft: {
          ...parsedProfile,
          resumeText,
        },
      })
    } catch {
      return res.json({
        resumeText,
        profileDraft: {
          fullName: '',
          targetRole: '',
          location: '',
          salaryExpectation: 0,
          skills: '',
          experienceText: '',
          resumeText,
        },
        warning:
          'Resume text was extracted, but automatic profile parsing failed. You can still review and save manually.',
      })
    }
  } catch (error) {
    console.error(error)

    return res.status(error instanceof ResumeParseError ? 400 : 500).json({
      message:
        error instanceof ResumeParseError
          ? error.message
          : 'failed to process resume',
    })
  }
}
