import type { ResumeProfile } from '../generated/prisma/client.js'
import { z } from 'zod'
import { rankJobsWithAI } from './jobRanking.service.js'

const ARBEITNOW_API_URL =
  'https://www.arbeitnow.com/api/job-board-api'
const GREENHOUSE_API_URL =
  'https://boards-api.greenhouse.io/v1/boards'
const ARBEITNOW_PAGE_COUNT = 5

const ATS_COMPANY_BOARDS = [
  {
    provider: 'greenhouse',
    boardToken: 'figma',
    companyName: 'Figma',
  },
] as const

const arbeitnowJobSchema = z.object({
  slug: z.string().optional().default(''),
  company_name: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
})

const arbeitnowResponseSchema = z.object({
  data: z.array(arbeitnowJobSchema),
})

const greenhouseJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string().nullable().optional(),
  location: z
    .object({
      name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  absolute_url: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
})

const greenhouseResponseSchema = z.object({
  jobs: z.array(greenhouseJobSchema),
})

type ProviderFetchInput = {
  query: string
  location: string
  limit: number
}

type ProviderJob = {
  externalId: string
  company: string
  position: string
  location: string
  jobDescription: string
  jobUrl: string
  companyUrl: string
  source: string
}

type JobProvider = {
  name: string
  fetchJobs: (input: ProviderFetchInput) => Promise<ProviderJob[]>
}

export type ExternalJobDraft = {
  externalId: string
  company: string
  position: string
  location: string
  jobDescription: string
  jobUrl: string
  companyUrl: string
  source: string
  salaryMin: number
  salaryMax: number
  wantedSalary: number
  priority: 'medium'
  notes: string
  relevanceScore: number
  relevanceReason: string
  aiScore?: number
  aiReason?: string
}

type FetchExternalJobsInput = ProviderFetchInput & {
  profile: ResumeProfile | null
  useAiRanking?: boolean
}

type RelevanceContext = {
  query: string
  location: string
  targetRole: string
  skills: string[]
  profileText: string
}

export class JobFetchError extends Error {}

class ProviderFetchError extends Error {}

function htmlToText(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const codePoint = Number(code)

      return Number.isInteger(codePoint)
        ? String.fromCodePoint(codePoint)
        : ' '
    })
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function getSkills(profile: ResumeProfile | null) {
  if (!profile) {
    return []
  }

  return profile.skills
    .split(/[,;\n]/)
    .map((skill) => skill.trim())
    .filter((skill) => skill.length >= 2)
    .slice(0, 10)
}

function buildSearchQuery(
  requestQuery: string,
  profile: ResumeProfile | null,
  skills: string[],
) {
  if (requestQuery) {
    return requestQuery
  }

  return [profile?.targetRole.trim(), ...skills.slice(0, 4)]
    .filter(Boolean)
    .join(' ')
}

function findSeniority(value: string) {
  const normalizedValue = normalize(value)
  const seniorityTerms = [
    'intern',
    'working student',
    'student',
    'junior',
    'entry level',
    'senior',
    'staff',
    'principal',
    'lead',
  ]

  return seniorityTerms.find((term) => normalizedValue.includes(term)) ?? ''
}

function scoreJobRelevance(
  job: ProviderJob,
  context: RelevanceContext,
) {
  const title = normalize(job.position)
  const description = normalize(job.jobDescription)
  const searchableText = `${title} ${description}`
  const matchedReasons: string[] = []
  let score = 0
  let hasTextMatch = false

  const targetRole = normalize(context.targetRole)

  if (targetRole && title.includes(targetRole)) {
    score += 35
    hasTextMatch = true
    matchedReasons.push('matches your target role')
  } else if (targetRole && description.includes(targetRole)) {
    score += 20
    hasTextMatch = true
    matchedReasons.push('mentions your target role')
  }

  const queryTerms = normalize(context.query)
    .split(/\s+/)
    .filter((term) => term.length >= 3)
  const matchedQueryTerms = [
    ...new Set(queryTerms.filter((term) => searchableText.includes(term))),
  ].slice(0, 5)

  if (matchedQueryTerms.length > 0) {
    score += Math.min(25, matchedQueryTerms.length * 5)
    hasTextMatch = true
    matchedReasons.push(
      `matches ${matchedQueryTerms.join(', ')} from your search`,
    )
  }

  const matchedSkills = context.skills.filter((skill) =>
    searchableText.includes(normalize(skill)),
  )

  if (matchedSkills.length > 0) {
    score += Math.min(30, matchedSkills.length * 6)
    hasTextMatch = true
    matchedReasons.push(`includes ${matchedSkills.slice(0, 4).join(', ')}`)
  }

  const requestedLocation = normalize(context.location)
  const jobLocation = normalize(job.location)

  if (
    requestedLocation &&
    jobLocation &&
    (jobLocation.includes(requestedLocation) ||
      requestedLocation.includes(jobLocation))
  ) {
    score += 15
    matchedReasons.push(`matches ${context.location}`)
  }

  const profileSeniority = findSeniority(
    `${context.targetRole} ${context.profileText}`,
  )
  const jobSeniority = findSeniority(job.position)

  if (profileSeniority && jobSeniority) {
    if (profileSeniority === jobSeniority) {
      score += 10
      matchedReasons.push('matches your seniority')
    } else {
      score -= 10
    }
  }

  return {
    hasTextMatch,
    relevanceScore: Math.max(0, Math.min(100, score)),
    relevanceReason:
      matchedReasons.length > 0
        ? `${matchedReasons.join(' and ')}.`
        : 'Limited profile or search overlap.',
  }
}

function dedupeExternalJobs(jobs: ProviderJob[]) {
  const seenUrls = new Set<string>()
  const seenCompanyPositions = new Set<string>()
  const seenProviderIds = new Set<string>()

  return jobs.filter((job) => {
    const jobUrl = normalize(job.jobUrl)
    const companyPosition =
      `${normalize(job.company)}::${normalize(job.position)}`
    const providerId =
      `${normalize(job.source)}::${normalize(job.externalId)}`

    if (
      (jobUrl && seenUrls.has(jobUrl)) ||
      seenCompanyPositions.has(companyPosition) ||
      seenProviderIds.has(providerId)
    ) {
      return false
    }

    if (jobUrl) {
      seenUrls.add(jobUrl)
    }

    seenCompanyPositions.add(companyPosition)
    seenProviderIds.add(providerId)
    return true
  })
}

async function fetchArbeitnowJobs() {
  try {
    const requests = Array.from(
      { length: ARBEITNOW_PAGE_COUNT },
      async (_, index) => {
        const response = await fetch(
          `${ARBEITNOW_API_URL}?page=${index + 1}`,
          {
            signal: AbortSignal.timeout(12_000),
          },
        )

        if (!response.ok) {
          throw new Error(`Arbeitnow returned ${response.status}`)
        }

        const result = arbeitnowResponseSchema.safeParse(
          await response.json(),
        )

        if (!result.success) {
          throw new Error('Arbeitnow returned an invalid response')
        }

        return result.data.data.map((job): ProviderJob => ({
          externalId:
            job.slug ||
            job.url ||
            `${job.company_name ?? ''}-${job.title ?? ''}`,
          company: job.company_name?.trim() || 'Unknown company',
          position: job.title?.trim() || 'Untitled role',
          location: job.location?.trim() || '',
          jobDescription: htmlToText(job.description ?? ''),
          jobUrl: job.url?.trim() || '',
          companyUrl: '',
          source: 'Arbeitnow',
        }))
      },
    )

    return (await Promise.all(requests)).flat()
  } catch (error) {
    console.error('Arbeitnow job fetch failed:', error)
    throw new ProviderFetchError('Arbeitnow is unavailable')
  }
}

async function fetchGreenhouseBoardJobs() {
  try {
    const requests = ATS_COMPANY_BOARDS.map(async (board) => {
      const response = await fetch(
        `${GREENHOUSE_API_URL}/${board.boardToken}/jobs?content=true`,
        {
          signal: AbortSignal.timeout(12_000),
        },
      )

      if (!response.ok) {
        throw new Error(
          `Greenhouse board ${board.boardToken} returned ${response.status}`,
        )
      }

      const result = greenhouseResponseSchema.safeParse(
        await response.json(),
      )

      if (!result.success) {
        throw new Error(
          `Greenhouse board ${board.boardToken} returned an invalid response`,
        )
      }

      return result.data.jobs.map((job): ProviderJob => ({
        externalId: `${board.boardToken}:${job.id}`,
        company: board.companyName,
        position: job.title?.trim() || 'Untitled role',
        location: job.location?.name?.trim() || '',
        jobDescription: htmlToText(job.content ?? ''),
        jobUrl: job.absolute_url?.trim() || '',
        companyUrl: '',
        source: 'Greenhouse',
      }))
    })

    return (await Promise.all(requests)).flat()
  } catch (error) {
    console.error('Greenhouse job fetch failed:', error)
    throw new ProviderFetchError('Greenhouse is unavailable')
  }
}

const jobProviders: JobProvider[] = [
  {
    name: 'Arbeitnow',
    fetchJobs: fetchArbeitnowJobs,
  },
  {
    name: 'Greenhouse',
    fetchJobs: fetchGreenhouseBoardJobs,
  },
]

export async function fetchExternalJobs({
  query,
  location,
  limit,
  profile,
  useAiRanking = true,
}: FetchExternalJobsInput): Promise<ExternalJobDraft[]> {
  const skills = getSkills(profile)
  const searchQuery = buildSearchQuery(query, profile, skills)

  if (!searchQuery) {
    throw new JobFetchError(
      'Complete your profile or enter a search query before fetching jobs.',
    )
  }

  const resolvedLocation = location || profile?.location.trim() || ''
  const context: RelevanceContext = {
    query: searchQuery,
    location: resolvedLocation,
    targetRole: profile?.targetRole.trim() ?? '',
    skills,
    profileText: `${profile?.experienceText ?? ''} ${profile?.resumeText ?? ''}`,
  }
  const providerInput: ProviderFetchInput = {
    query: searchQuery,
    location: resolvedLocation,
    limit,
  }
  const providerResults = await Promise.allSettled(
    jobProviders.map((provider) => provider.fetchJobs(providerInput)),
  )
  const providerJobs = providerResults.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    }

    console.error(
      `${jobProviders[index]?.name ?? 'Job provider'} failed:`,
      result.reason,
    )
    return []
  })

  if (providerJobs.length === 0) {
    throw new JobFetchError('failed to fetch jobs from external providers')
  }

  const candidateLimit = Math.min(15, Math.max(10, limit * 2))
  const deterministicJobs = dedupeExternalJobs(providerJobs)
    .map((job) => ({
      ...job,
      salaryMin: 0,
      salaryMax: 0,
      wantedSalary: 0,
      priority: 'medium' as const,
      notes: 'Fetched from external job source',
      ...scoreJobRelevance(job, context),
    }))
    .filter((job) => job.hasTextMatch)
    .sort((first, second) => second.relevanceScore - first.relevanceScore)
    .slice(0, candidateLimit)
    .map(({ hasTextMatch: _hasTextMatch, ...job }) => job)

  if (
    !useAiRanking ||
    !profile ||
    deterministicJobs.length === 0
  ) {
    return deterministicJobs.slice(0, limit)
  }

  try {
    const rankedJobs = await rankJobsWithAI({
      profile,
      jobs: deterministicJobs,
    })

    return rankedJobs.slice(0, limit)
  } catch (error) {
    console.error(
      'OpenAI job ranking failed; using deterministic ranking:',
      error,
    )
    return deterministicJobs.slice(0, limit)
  }
}
