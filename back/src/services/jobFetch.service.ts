import type { ResumeProfile } from '../generated/prisma/client.js'
import { z } from 'zod'

const ARBEITNOW_API_URL =
  'https://www.arbeitnow.com/api/job-board-api'
const PROVIDER_PAGE_COUNT = 5

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

type ProviderJob = z.infer<typeof arbeitnowJobSchema>

type JobProvider = {
  name: string
  fetchJobs: () => Promise<ProviderJob[]>
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
}

type FetchExternalJobsInput = {
  query: string
  location: string
  limit: number
  profile: ResumeProfile | null
}

type RelevanceContext = {
  query: string
  location: string
  targetRole: string
  skills: string[]
  profileText: string
}

export class JobFetchError extends Error {}

function htmlToText(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
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

function scoreRelevance(
  job: ProviderJob,
  context: RelevanceContext,
) {
  const title = normalize(job.title ?? '')
  const description = normalize(job.description ?? '')
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
  const jobLocation = normalize(job.location ?? '')

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
  const jobSeniority = findSeniority(job.title ?? '')

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

async function fetchArbeitnowJobs() {
  try {
    const requests = Array.from(
      { length: PROVIDER_PAGE_COUNT },
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

        return result.data.data
      },
    )

    return (await Promise.all(requests)).flat()
  } catch (error) {
    console.error('Arbeitnow job fetch failed:', error)
    throw new JobFetchError('failed to fetch jobs from external provider')
  }
}

const arbeitnowProvider: JobProvider = {
  name: 'Arbeitnow',
  fetchJobs: fetchArbeitnowJobs,
}

export async function fetchExternalJobs({
  query,
  location,
  limit,
  profile,
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
  const providerJobs = await arbeitnowProvider.fetchJobs()

  return providerJobs
    .map((job) => {
      const relevance = scoreRelevance(job, context)

      return {
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
        source: arbeitnowProvider.name,
        salaryMin: 0,
        salaryMax: 0,
        wantedSalary: 0,
        priority: 'medium' as const,
        notes: 'Fetched from external job source',
        ...relevance,
      }
    })
    .filter((job) => job.hasTextMatch)
    .sort((first, second) => second.relevanceScore - first.relevanceScore)
    .slice(0, limit)
    .map(({ hasTextMatch: _hasTextMatch, ...job }) => job)
}
