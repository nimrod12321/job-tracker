import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import type {
  Job,
  ResumeProfile,
} from '../generated/prisma/client.js'
import {
  jobAnalysisResultSchema,
  type JobAnalysisResult,
} from '../validations/analysis.validation.js'

export type { JobAnalysisResult }

export class AiServiceError extends Error {}

function getRequiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new AiServiceError(`${name} is not set`)
  }

  return value
}

function buildAnalysisInput(profile: ResumeProfile, job: Job) {
  return JSON.stringify(
    {
      resumeProfile: {
        targetRole: profile.targetRole,
        skills: profile.skills,
        experienceText: profile.experienceText,
        resumeText: profile.resumeText,
      },
      job: {
        company: job.company,
        position: job.position,
        location: job.location,
        jobDescription: job.jobDescription,
        salaryMin: job.salaryMin || null,
        salaryMax: job.salaryMax || null,
      },
    },
    null,
    2,
  )
}

export async function analyzeJobMatch(
  profile: ResumeProfile,
  job: Job,
): Promise<JobAnalysisResult> {
  const apiKey = getRequiredEnvironmentVariable('OPENAI_API_KEY')
  const model = getRequiredEnvironmentVariable('OPENAI_MODEL')
  const openai = new OpenAI({ apiKey })

  try {
    const response = await openai.responses.parse({
      model,
      instructions: [
        'You are a practical career assistant.',
        'Compare the supplied resume profile with the job.',
        'Be honest and constructive. Never invent experience or skills.',
        'Resume suggestions may improve framing but must not encourage lying.',
        'Keep each text field useful and concise.',
        'Make interview questions relevant to the job description.',
        'Keep the recruiter message professional and short.',
      ].join(' '),
      input: buildAnalysisInput(profile, job),
      text: {
        format: zodTextFormat(jobAnalysisResultSchema, 'job_analysis'),
      },
    })

    if (!response.output_parsed) {
      throw new Error('OpenAI returned no parsed analysis')
    }

    return jobAnalysisResultSchema.parse(response.output_parsed)
  } catch (error) {
    console.error('OpenAI job analysis failed:', error)
    throw new AiServiceError('failed to generate job analysis')
  }
}
