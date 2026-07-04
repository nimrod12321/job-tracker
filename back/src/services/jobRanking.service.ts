import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import type { ResumeProfile } from '../generated/prisma/client.js'
import { getOpenAIConfiguration } from './ai.service.js'
import type { ExternalJobDraft } from './jobFetch.service.js'

const JOB_DESCRIPTION_LIMIT = 1_800
const AI_RANKING_TIMEOUT_MS = 15_000

const jobRankingResultSchema = z
  .object({
    rankedJobs: z
      .array(
        z
          .object({
            externalId: z.string().trim().min(1),
            aiScore: z.number().int().min(0).max(100),
            aiReason: z.string().trim().min(1).max(300),
          })
          .strict(),
      )
      .min(1)
      .max(15),
  })
  .strict()

type RankJobsWithAIInput = {
  profile: ResumeProfile
  jobs: ExternalJobDraft[]
}

function buildRankingInput(
  profile: ResumeProfile,
  jobs: ExternalJobDraft[],
) {
  return JSON.stringify({
    profile: {
      targetRole: profile.targetRole,
      skills: profile.skills,
      experienceText: profile.experienceText,
      resumeText: profile.resumeText,
      location: profile.location,
      salaryExpectation: profile.salaryExpectation,
    },
    jobs: jobs.map((job) => ({
      externalId: job.externalId,
      company: job.company,
      position: job.position,
      location: job.location,
      jobDescription: job.jobDescription.slice(
        0,
        JOB_DESCRIPTION_LIMIT,
      ),
      source: job.source,
      relevanceScore: job.relevanceScore,
      relevanceReason: job.relevanceReason,
    })),
  })
}

export async function rankJobsWithAI({
  profile,
  jobs,
}: RankJobsWithAIInput): Promise<ExternalJobDraft[]> {
  if (jobs.length === 0) {
    return []
  }

  const { client, model } = getOpenAIConfiguration()
  const response = await client.responses.parse(
    {
      model,
      instructions: [
        'You are ranking job opportunities for a user.',
        'Use only the provided user profile and job data.',
        'Do not invent facts or assume experience the user did not provide.',
        'Rank every supplied job by likelihood of being a good fit.',
        'Consider target role, skills, experience, location, salary expectations, and seniority.',
        'Penalize jobs that are clearly too senior, too junior, irrelevant, or location-mismatched.',
        'Give each job an integer aiScore from 0 to 100.',
        'Keep aiReason short, practical, and specific.',
        'Return each externalId exactly once.',
        'Return strict JSON only in the requested structure.',
      ].join(' '),
      input: buildRankingInput(profile, jobs),
      text: {
        format: zodTextFormat(
          jobRankingResultSchema,
          'job_ranking',
        ),
      },
    },
    {
      maxRetries: 0,
      timeout: AI_RANKING_TIMEOUT_MS,
    },
  )

  if (!response.output_parsed) {
    throw new Error('OpenAI returned no parsed job ranking')
  }

  const result = jobRankingResultSchema.parse(response.output_parsed)
  const jobsByExternalId = new Map(
    jobs.map((job) => [job.externalId, job]),
  )
  const rankedExternalIds = new Set<string>()

  if (
    jobsByExternalId.size !== jobs.length ||
    result.rankedJobs.length !== jobs.length
  ) {
    throw new Error('OpenAI returned an incomplete job ranking')
  }

  const rankedJobs = result.rankedJobs.map((rankedJob) => {
    const job = jobsByExternalId.get(rankedJob.externalId)

    if (!job || rankedExternalIds.has(rankedJob.externalId)) {
      throw new Error('OpenAI returned an invalid job ranking')
    }

    rankedExternalIds.add(rankedJob.externalId)

    return {
      ...job,
      aiScore: rankedJob.aiScore,
      aiReason: rankedJob.aiReason,
      relevanceScore: rankedJob.aiScore,
      relevanceReason: rankedJob.aiReason,
    }
  })

  return rankedJobs.sort(
    (first, second) =>
      (second.aiScore ?? 0) - (first.aiScore ?? 0),
  )
}
