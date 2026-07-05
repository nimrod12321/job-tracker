import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import type { ResumeProfile } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import { getOpenAIConfiguration } from './ai.service.js'
import {
  fetchExternalJobs,
  type ExternalJobDraft,
} from './jobFetch.service.js'

const DISCOVERY_CANDIDATE_LIMIT = 15
const JOB_DESCRIPTION_LIMIT = 1_800
const DISCOVERY_AI_TIMEOUT_MS = 20_000

export type DiscoveryJob = {
  externalId: string
  company: string
  position: string
  location: string
  source: string
  jobUrl: string
  companyUrl: string
  jobDescription: string
  summary: string
  keyDetails: string[]
  salaryText: string
  estimatedSalary: string
  salaryIsEstimated: boolean
  fitScore: number
  fitReason: string
  concerns: string[]
  priority: 'low' | 'medium' | 'high'
}

type GetDiscoveryFeedInput = {
  userId: string
  profile: ResumeProfile
  limit: number
  excludeExternalIds: string[]
}

const discoveryRankingResultSchema = z
  .object({
    jobs: z
      .array(
        z
          .object({
            externalId: z.string().trim().min(1),
            summary: z.string().trim().min(1).max(220),
            keyDetails: z
              .array(z.string().trim().min(1).max(120))
              .min(2)
              .max(4),
            estimatedSalary: z.string().trim().max(200),
            salaryIsEstimated: z.boolean(),
            fitScore: z.number().int().min(0).max(100),
            fitReason: z.string().trim().min(1).max(300),
            concerns: z
              .array(z.string().trim().min(1).max(160))
              .max(4),
          })
          .strict(),
      )
      .min(1)
      .max(DISCOVERY_CANDIDATE_LIMIT),
  })
  .strict()

function getProfileSkills(profile: ResumeProfile) {
  return profile.skills
    .split(/[,;\n]/)
    .map((skill) => skill.trim())
    .filter((skill) => skill.length >= 2)
    .slice(0, 4)
}

export function hasUsefulDiscoveryProfile(
  profile: ResumeProfile | null,
): profile is ResumeProfile {
  return Boolean(
    profile &&
      (profile.targetRole.trim() || getProfileSkills(profile).length > 0),
  )
}

function buildDiscoverySearchQuery(profile: ResumeProfile) {
  return [profile.targetRole.trim(), ...getProfileSkills(profile)]
    .filter(Boolean)
    .join(' ')
}

function truncateWords(value: string, maxWords: number) {
  const words = value.replace(/\s+/g, ' ').trim().split(' ')

  if (words.length <= maxWords) {
    return words.join(' ')
  }

  return `${words.slice(0, maxWords).join(' ')}…`
}

function getSalaryText(job: ExternalJobDraft) {
  if (job.salaryMin && job.salaryMax) {
    return `$${job.salaryMin.toLocaleString()}–$${job.salaryMax.toLocaleString()}`
  }

  if (job.salaryMin) {
    return `From $${job.salaryMin.toLocaleString()}`
  }

  if (job.salaryMax) {
    return `Up to $${job.salaryMax.toLocaleString()}`
  }

  if (job.wantedSalary) {
    return `$${job.wantedSalary.toLocaleString()}`
  }

  return 'Salary not listed'
}

function getPriority(fitScore: number): DiscoveryJob['priority'] {
  if (fitScore >= 75) {
    return 'high'
  }

  if (fitScore >= 45) {
    return 'medium'
  }

  return 'low'
}

function mapToDeterministicDiscoveryJob(
  job: ExternalJobDraft,
): DiscoveryJob {
  const fitScore = job.relevanceScore

  return {
    externalId: job.externalId,
    company: job.company,
    position: job.position,
    location: job.location,
    source: job.source,
    jobUrl: job.jobUrl,
    companyUrl: job.companyUrl,
    jobDescription: job.jobDescription.slice(0, 20_000),
    summary: truncateWords(
      `${job.position} at ${job.company}${
        job.location ? ` in ${job.location}` : ''
      }.`,
      25,
    ),
    keyDetails: [
      `Company: ${job.company}`,
      job.location
        ? `Location: ${job.location}`
        : 'Location not listed',
      `Source: ${job.source}`,
    ],
    salaryText: getSalaryText(job),
    estimatedSalary: '',
    salaryIsEstimated: false,
    fitScore,
    fitReason: job.relevanceReason,
    concerns: [],
    priority: getPriority(fitScore),
  }
}

function buildDiscoveryAiInput(
  profile: ResumeProfile,
  jobs: DiscoveryJob[],
) {
  return JSON.stringify({
    profile: {
      targetRole: profile.targetRole,
      skills: profile.skills,
      experienceText: profile.experienceText.slice(0, 4_000),
      resumeText: profile.resumeText.slice(0, 6_000),
      location: profile.location,
      salaryExpectation: profile.salaryExpectation,
    },
    jobs: jobs.map((job) => ({
      externalId: job.externalId,
      company: job.company,
      position: job.position,
      location: job.location,
      source: job.source,
      jobDescription: job.jobDescription.slice(
        0,
        JOB_DESCRIPTION_LIMIT,
      ),
      salaryText: job.salaryText,
      deterministicFitScore: job.fitScore,
      deterministicFitReason: job.fitReason,
    })),
  })
}

async function rankDiscoveryJobsWithAi(
  profile: ResumeProfile,
  jobs: DiscoveryJob[],
) {
  const { client, model } = getOpenAIConfiguration()
  const response = await client.responses.parse(
    {
      model,
      instructions: [
        'You are preparing compact job discovery cards.',
        'Use only the provided user profile and job data.',
        'Do not invent job facts or user experience.',
        'Rank every supplied job from best fit to worst fit.',
        'Consider target role, skills, experience, location, salary expectation, and seniority mismatch.',
        'Keep each summary under 25 words.',
        'Return 2 to 4 short key details for each job.',
        'Keep concerns short and practical.',
        'If salary is listed, do not estimate it and set salaryIsEstimated false.',
        'If salary is not listed, you may estimate based on role, location, and seniority, but set salaryIsEstimated true.',
        'Return every externalId exactly once.',
        'Return strict JSON only in the requested structure.',
      ].join(' '),
      input: buildDiscoveryAiInput(profile, jobs),
      text: {
        format: zodTextFormat(
          discoveryRankingResultSchema,
          'discovery_jobs',
        ),
      },
    },
    {
      maxRetries: 0,
      timeout: DISCOVERY_AI_TIMEOUT_MS,
    },
  )

  if (!response.output_parsed) {
    throw new Error('OpenAI returned no parsed discovery jobs')
  }

  const result = discoveryRankingResultSchema.parse(
    response.output_parsed,
  )
  const jobsByExternalId = new Map(
    jobs.map((job) => [job.externalId, job]),
  )
  const rankedExternalIds = new Set<string>()

  if (
    jobsByExternalId.size !== jobs.length ||
    result.jobs.length !== jobs.length
  ) {
    throw new Error('OpenAI returned an incomplete discovery ranking')
  }

  const rankedJobs = result.jobs.map((rankedJob) => {
    const job = jobsByExternalId.get(rankedJob.externalId)

    if (!job || rankedExternalIds.has(rankedJob.externalId)) {
      throw new Error('OpenAI returned an invalid discovery ranking')
    }

    rankedExternalIds.add(rankedJob.externalId)

    const hasProviderSalary = job.salaryText !== 'Salary not listed'
    const estimatedSalary =
      !hasProviderSalary &&
      rankedJob.salaryIsEstimated &&
      rankedJob.estimatedSalary
        ? rankedJob.estimatedSalary
        : ''

    return {
      ...job,
      summary: truncateWords(rankedJob.summary, 25),
      keyDetails: rankedJob.keyDetails,
      estimatedSalary,
      salaryIsEstimated: Boolean(estimatedSalary),
      fitScore: rankedJob.fitScore,
      fitReason: rankedJob.fitReason,
      concerns: rankedJob.concerns,
      priority: getPriority(rankedJob.fitScore),
    }
  })

  return rankedJobs.sort(
    (first, second) => second.fitScore - first.fitScore,
  )
}

function getDecisionKey(source: string, externalId: string) {
  return `${source}\u0000${externalId}`
}

export async function getDiscoveryFeed({
  userId,
  profile,
  limit,
  excludeExternalIds,
}: GetDiscoveryFeedInput): Promise<DiscoveryJob[]> {
  const searchQuery = buildDiscoverySearchQuery(profile)
  const candidates = await fetchExternalJobs({
    query: searchQuery,
    location: profile.location.trim(),
    limit: DISCOVERY_CANDIDATE_LIMIT,
    profile,
    useAiRanking: false,
  })
  const likedDecisions = await prisma.jobDiscoveryDecision.findMany({
    where: {
      userId,
      decision: 'liked',
    },
    select: {
      source: true,
      externalId: true,
    },
  })
  const likedKeys = new Set(
    likedDecisions.map((decision) =>
      getDecisionKey(decision.source, decision.externalId),
    ),
  )
  const excludedIds = new Set(excludeExternalIds)
  const deterministicJobs = candidates
    .filter(
      (job) =>
        !likedKeys.has(getDecisionKey(job.source, job.externalId)) &&
        !excludedIds.has(job.externalId),
    )
    .map(mapToDeterministicDiscoveryJob)

  if (deterministicJobs.length === 0) {
    return []
  }

  try {
    const rankedJobs = await rankDiscoveryJobsWithAi(
      profile,
      deterministicJobs,
    )

    return rankedJobs.slice(0, limit)
  } catch (error) {
    console.error(
      'OpenAI discovery ranking failed; using deterministic ranking:',
      error,
    )
    return deterministicJobs
      .sort((first, second) => second.fitScore - first.fitScore)
      .slice(0, limit)
  }
}
