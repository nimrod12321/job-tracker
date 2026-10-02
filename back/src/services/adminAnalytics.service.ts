import type { Prisma } from '../generated/prisma/client.js'
import {
  ACQUISITION_FUNNEL_STAGE_KEYS,
  RECRUITMENT_ASSET_EVENT_NAMES,
  type OwnerAcquisitionFlow,
} from '../config/analytics.js'
import { prisma } from '../lib/prisma.js'
import {
  hasCandidateReceivedFromCounts,
  isRestaurantEstablishedFromMemberships,
  isRestaurantHiringReadyFromRoles,
  type CandidateSource,
} from './analytics.service.js'
import type {
  AdminAcquisitionFunnelQuery,
  AdminAcquisitionStageQuery,
} from '../validations/adminAnalytics.validation.js'
import {
  getCurrentAcquisitionStage,
  type AcquisitionFunnelStageKey,
  type AcquisitionStageEvidence,
} from './adminAnalyticsStages.js'

export { ACQUISITION_FUNNEL_STAGE_KEYS }
export { getCurrentAcquisitionStage }
export type { AcquisitionFunnelStageKey, AcquisitionStageEvidence }

type StageCounts = Record<AcquisitionFunnelStageKey, number>
type StageEvidence = AcquisitionStageEvidence
type StageTimestamps = Record<AcquisitionFunnelStageKey, Date | null>

const FUNNEL_EVENT_NAMES = [
  'owner_signup_started',
  'owner_otp_verified',
  'hiring_roles_updated',
  'recruitment_kit_opened',
  ...RECRUITMENT_ASSET_EVENT_NAMES,
  'candidate_received',
  'candidate_card_opened',
  'candidate_contact_initiated',
] as const

type SignupFlow = OwnerAcquisitionFlow | 'unknown'

type FunnelEvent = {
  eventName: string
  occurredAt: Date
  properties: Prisma.JsonValue
}

type RestaurantSnapshot = {
  id: string
  userId: string
  restaurantName: string
  createdAt: Date
  updatedAt: Date
  qrEnabledRoles: readonly unknown[]
  claim: { claimedAt: Date | null } | null
  leads: Array<{ createdAt: Date }>
  jobs: Array<{ applications: Array<{ createdAt: Date }> }>
}

type MembershipSnapshot = {
  userId: string | null
  role: 'owner' | 'hiringManager'
  status: 'active' | 'pending' | 'removed'
  createdAt: Date
  updatedAt: Date
  restaurant: RestaurantSnapshot
}

type AcquisitionAnchor = {
  id: string
  anonymousAcquisitionId: string
  userId: string | null
  firstSource: string
  firstMedium: string
  firstCampaign: string | null
  firstTouchedAt: Date
  signupAt: Date
  flow: SignupFlow
  events: FunnelEvent[]
  historicalCandidateSources: Set<CandidateSource>
}

type AcquisitionEvaluation = {
  anchor: AcquisitionAnchor
  primaryRestaurant: RestaurantSnapshot | null
  stages: StageEvidence
  stageTimestamps: StageTimestamps
  currentStage: AcquisitionFunnelStageKey
  currentStageReachedAt: Date | null
  candidateSources: Record<CandidateSource, boolean>
}

function emptyStageCounts(): StageCounts {
  return Object.fromEntries(
    ACQUISITION_FUNNEL_STAGE_KEYS.map((key) => [key, 0]),
  ) as StageCounts
}

function eventProperties(value: Prisma.JsonValue) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {}
  }

  return value as Record<string, Prisma.JsonValue>
}

function getSignupFlow(value: Prisma.JsonValue): SignupFlow {
  const flow = eventProperties(value).flow
  return flow === 'selfServe' || flow === 'claim' || flow === 'pendingPhone'
    ? flow
    : 'unknown'
}

function isHistoricalHiringReadyEvent(event: FunnelEvent) {
  if (event.eventName !== 'hiring_roles_updated') return false
  const roleCount = eventProperties(event.properties).roleCount
  return typeof roleCount === 'number' && roleCount > 0
}

function getHistoricalCandidateSource(
  event: FunnelEvent,
): CandidateSource | null {
  if (event.eventName !== 'candidate_received') return null
  const source = eventProperties(event.properties).candidateSource
  return source === 'external' || source === 'jobBoard' ? source : null
}

function earliestEventAt(
  events: readonly FunnelEvent[],
  eventNames: readonly string[],
  predicate: (event: FunnelEvent) => boolean = () => true,
) {
  let earliest: Date | null = null

  for (const event of events) {
    if (!eventNames.includes(event.eventName) || !predicate(event)) continue
    if (!earliest || event.occurredAt < earliest) earliest = event.occurredAt
  }

  return earliest
}

function earliestDate(values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((earliest, value) => {
    if (!value) return earliest
    return !earliest || value < earliest ? value : earliest
  }, null)
}

function matchesFilters(
  anchor: AcquisitionAnchor,
  filters: AdminAcquisitionFunnelQuery,
) {
  return (
    (!filters.source || anchor.firstSource === filters.source) &&
    (!filters.medium || anchor.firstMedium === filters.medium) &&
    (!filters.campaign || anchor.firstCampaign === filters.campaign)
  )
}

function conversionFromPrevious(count: number, previousCount: number | null) {
  if (previousCount === null || previousCount === 0) return null
  return Math.round((count / previousCount) * 1000) / 10
}

function restaurantEstablishedAt(
  anchor: AcquisitionAnchor,
  memberships: readonly MembershipSnapshot[],
) {
  if (!anchor.userId || anchor.flow === 'unknown') return null

  const qualifyingMemberships = memberships.filter(
    (membership) =>
      membership.role === 'owner' && membership.status === 'active',
  )

  if (anchor.flow === 'claim') {
    return earliestDate(
      qualifyingMemberships.map(
        (membership) => membership.restaurant.claim?.claimedAt,
      ),
    )
  }

  if (anchor.flow === 'pendingPhone') {
    return earliestDate(
      qualifyingMemberships.map((membership) => membership.updatedAt),
    )
  }

  return earliestDate(
    qualifyingMemberships
      .filter((membership) => membership.restaurant.userId === anchor.userId)
      .map((membership) =>
        new Date(
          Math.max(
            membership.createdAt.getTime(),
            membership.restaurant.createdAt.getTime(),
          ),
        ),
      ),
  )
}

function evaluateAcquisition(
  anchor: AcquisitionAnchor,
  memberships: readonly MembershipSnapshot[],
  legacyRestaurant: RestaurantSnapshot | null,
): AcquisitionEvaluation {
  const primaryMembership =
    memberships.find((membership) => membership.role === 'owner') ??
    memberships[0]
  const primaryRestaurant = primaryMembership?.restaurant ?? legacyRestaurant
  const externalCandidateCount = primaryRestaurant?.leads.length ?? 0
  const jobBoardApplicationCount =
    primaryRestaurant?.jobs.reduce(
      (total, job) => total + job.applications.length,
      0,
    ) ?? 0
  const eventNames = new Set(anchor.events.map((event) => event.eventName))
  const historicalHiringReadyAt = earliestEventAt(
    anchor.events,
    ['hiring_roles_updated'],
    isHistoricalHiringReadyEvent,
  )
  const historicalCandidateAt = earliestEventAt(anchor.events, [
    'candidate_received',
  ])
  const durableCandidateAt = primaryRestaurant
    ? earliestDate([
        primaryRestaurant.leads[0]?.createdAt,
        ...primaryRestaurant.jobs.map(
          (job) => job.applications[0]?.createdAt,
        ),
      ])
    : null
  const restaurantEstablished = Boolean(
    anchor.userId &&
      anchor.flow !== 'unknown' &&
      isRestaurantEstablishedFromMemberships(
        anchor.userId,
        anchor.flow,
        memberships,
      ),
  )
  const currentHiringReady = Boolean(
    primaryRestaurant &&
      isRestaurantHiringReadyFromRoles(primaryRestaurant.qrEnabledRoles),
  )
  const candidateSources = {
    external:
      externalCandidateCount > 0 ||
      anchor.historicalCandidateSources.has('external'),
    jobBoard:
      jobBoardApplicationCount > 0 ||
      anchor.historicalCandidateSources.has('jobBoard'),
  }
  const stages: StageEvidence = {
    ownerSignupStarted: true,
    otpVerified: eventNames.has('owner_otp_verified'),
    restaurantEstablished,
    hiringReady: Boolean(historicalHiringReadyAt || currentHiringReady),
    recruitmentKitOpened: eventNames.has('recruitment_kit_opened'),
    recruitmentAssetUsed: RECRUITMENT_ASSET_EVENT_NAMES.some((eventName) =>
      eventNames.has(eventName),
    ),
    candidateReceived:
      anchor.historicalCandidateSources.size > 0 ||
      hasCandidateReceivedFromCounts({
        externalCandidateCount,
        jobBoardApplicationCount,
      }),
    candidateCardOpened: eventNames.has('candidate_card_opened'),
    contactInitiated: eventNames.has('candidate_contact_initiated'),
  }
  const stageTimestamps: StageTimestamps = {
    ownerSignupStarted: anchor.signupAt,
    otpVerified: earliestEventAt(anchor.events, ['owner_otp_verified']),
    restaurantEstablished: restaurantEstablished
      ? restaurantEstablishedAt(anchor, memberships)
      : null,
    hiringReady: historicalHiringReadyAt,
    recruitmentKitOpened: earliestEventAt(anchor.events, [
      'recruitment_kit_opened',
    ]),
    recruitmentAssetUsed: earliestEventAt(
      anchor.events,
      RECRUITMENT_ASSET_EVENT_NAMES,
    ),
    candidateReceived: historicalCandidateAt ?? durableCandidateAt,
    candidateCardOpened: earliestEventAt(anchor.events, [
      'candidate_card_opened',
    ]),
    contactInitiated: earliestEventAt(anchor.events, [
      'candidate_contact_initiated',
    ]),
  }
  const currentStage = getCurrentAcquisitionStage(stages)

  return {
    anchor,
    primaryRestaurant,
    stages,
    stageTimestamps,
    currentStage,
    currentStageReachedAt: stageTimestamps[currentStage],
    candidateSources,
  }
}

const restaurantSnapshotSelect = {
  id: true,
  userId: true,
  restaurantName: true,
  createdAt: true,
  updatedAt: true,
  qrEnabledRoles: true,
  claim: { select: { claimedAt: true } },
  leads: {
    orderBy: { createdAt: 'asc' as const },
    take: 1,
    select: { createdAt: true },
  },
  jobs: {
    select: {
      applications: {
        orderBy: { createdAt: 'asc' as const },
        take: 1,
        select: { createdAt: true },
      },
    },
  },
} satisfies Prisma.RestaurantOwnerProfileSelect

async function loadAcquisitionEvaluations(
  filters: AdminAcquisitionFunnelQuery,
) {
  const acquisitions = await prisma.analyticsAcquisition.findMany({
    where: {
      events: {
        some: { eventName: 'owner_signup_started' },
      },
    },
    orderBy: [{ firstTouchedAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      anonymousAcquisitionId: true,
      userId: true,
      firstSource: true,
      firstMedium: true,
      firstCampaign: true,
      firstTouchedAt: true,
      events: {
        where: { eventName: { in: [...FUNNEL_EVENT_NAMES] } },
        select: {
          eventName: true,
          occurredAt: true,
          properties: true,
        },
      },
    },
  })

  const anchors: AcquisitionAnchor[] = []
  const anchoredUserIds = new Set<string>()

  for (const acquisition of acquisitions) {
    if (acquisition.userId && anchoredUserIds.has(acquisition.userId)) {
      continue
    }

    const signupEvents = acquisition.events
      .filter((event) => event.eventName === 'owner_signup_started')
      .sort(
        (left, right) =>
          left.occurredAt.getTime() - right.occurredAt.getTime(),
      )
    const firstSignup = signupEvents[0]
    if (!firstSignup) continue

    if (acquisition.userId) anchoredUserIds.add(acquisition.userId)
    const historicalCandidateSources = new Set<CandidateSource>()
    for (const event of acquisition.events) {
      const candidateSource = getHistoricalCandidateSource(event)
      if (candidateSource) historicalCandidateSources.add(candidateSource)
    }

    anchors.push({
      id: acquisition.id,
      anonymousAcquisitionId: acquisition.anonymousAcquisitionId,
      userId: acquisition.userId,
      firstSource: acquisition.firstSource,
      firstMedium: acquisition.firstMedium,
      firstCampaign: acquisition.firstCampaign,
      firstTouchedAt: acquisition.firstTouchedAt,
      signupAt: firstSignup.occurredAt,
      flow: getSignupFlow(firstSignup.properties),
      events: acquisition.events,
      historicalCandidateSources,
    })
  }

  const linkedUserIds = anchors.flatMap((anchor) =>
    anchor.userId ? [anchor.userId] : [],
  )
  const ownerUsers = linkedUserIds.length
    ? await prisma.user.findMany({
        where: {
          id: { in: linkedUserIds },
          track: 'restaurantOwner',
        },
        select: { id: true },
      })
    : []
  const ownerUserIds = new Set(ownerUsers.map((user) => user.id))
  const eligibleAnchors = anchors.filter(
    (anchor) => !anchor.userId || ownerUserIds.has(anchor.userId),
  )
  const filteredAnchors = eligibleAnchors.filter((anchor) =>
    matchesFilters(anchor, filters),
  )
  const filteredUserIds = filteredAnchors.flatMap((anchor) =>
    anchor.userId ? [anchor.userId] : [],
  )

  const [memberships, legacyProfiles] = filteredUserIds.length
    ? await Promise.all([
        prisma.restaurantMember.findMany({
          where: {
            userId: { in: filteredUserIds },
            status: 'active',
          },
          orderBy: { createdAt: 'asc' },
          select: {
            userId: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            restaurant: { select: restaurantSnapshotSelect },
          },
        }),
        prisma.restaurantOwnerProfile.findMany({
          where: { userId: { in: filteredUserIds } },
          select: restaurantSnapshotSelect,
        }),
      ])
    : [[], []]

  const membershipsByUser = new Map<string, MembershipSnapshot[]>()
  for (const membership of memberships) {
    if (!membership.userId) continue
    const current = membershipsByUser.get(membership.userId) ?? []
    current.push(membership as MembershipSnapshot)
    membershipsByUser.set(membership.userId, current)
  }
  const legacyProfileByUser = new Map(
    legacyProfiles.map((profile) => [profile.userId, profile]),
  )

  return {
    eligibleAnchors,
    evaluations: filteredAnchors.map((anchor) =>
      evaluateAcquisition(
        anchor,
        anchor.userId ? membershipsByUser.get(anchor.userId) ?? [] : [],
        anchor.userId
          ? (legacyProfileByUser.get(anchor.userId) as RestaurantSnapshot | undefined) ?? null
          : null,
      ),
    ),
  }
}

export async function getAdminAcquisitionFunnelReport(
  filters: AdminAcquisitionFunnelQuery = {},
) {
  const { eligibleAnchors, evaluations } =
    await loadAcquisitionEvaluations(filters)
  const totals = emptyStageCounts()
  const currentStageCounts = emptyStageCounts()
  const signupFlows: Record<SignupFlow, number> = {
    selfServe: 0,
    claim: 0,
    pendingPhone: 0,
    unknown: 0,
  }
  const candidateSources = { external: 0, jobBoard: 0 }
  const attributionGroups = new Map<
    string,
    {
      source: string
      medium: string
      campaign: string | null
      stages: StageCounts
    }
  >()

  for (const evaluation of evaluations) {
    const { anchor, stages } = evaluation
    signupFlows[anchor.flow] += 1
    currentStageCounts[evaluation.currentStage] += 1
    if (evaluation.candidateSources.external) candidateSources.external += 1
    if (evaluation.candidateSources.jobBoard) candidateSources.jobBoard += 1

    const groupKey = JSON.stringify([
      anchor.firstSource,
      anchor.firstMedium,
      anchor.firstCampaign,
    ])
    const group = attributionGroups.get(groupKey) ?? {
      source: anchor.firstSource,
      medium: anchor.firstMedium,
      campaign: anchor.firstCampaign,
      stages: emptyStageCounts(),
    }

    for (const stageKey of ACQUISITION_FUNNEL_STAGE_KEYS) {
      if (!stages[stageKey]) continue
      totals[stageKey] += 1
      group.stages[stageKey] += 1
    }
    attributionGroups.set(groupKey, group)
  }

  let previousCount: number | null = null
  const funnel = ACQUISITION_FUNNEL_STAGE_KEYS.map((key) => {
    const count = totals[key]
    const stage = {
      key,
      count,
      conversionFromPrevious: conversionFromPrevious(count, previousCount),
    }
    previousCount = count
    return stage
  })

  return {
    cohort: {
      basis: 'owner_signup_started' as const,
      count: evaluations.length,
    },
    filters: {
      source: filters.source ?? null,
      medium: filters.medium ?? null,
      campaign: filters.campaign ?? null,
    },
    filterOptions: {
      sources: [
        ...new Set(eligibleAnchors.map((anchor) => anchor.firstSource)),
      ].sort(),
      mediums: [
        ...new Set(eligibleAnchors.map((anchor) => anchor.firstMedium)),
      ].sort(),
      campaigns: [
        ...new Set(
          eligibleAnchors.flatMap((anchor) =>
            anchor.firstCampaign ? [anchor.firstCampaign] : [],
          ),
        ),
      ].sort(),
    },
    funnel,
    currentStageCounts,
    byAttribution: [...attributionGroups.values()].sort(
      (left, right) =>
        right.stages.ownerSignupStarted - left.stages.ownerSignupStarted ||
        left.source.localeCompare(right.source),
    ),
    signupFlows,
    candidateSources,
  }
}

export async function getAdminAcquisitionStageDetails(
  stage: AcquisitionFunnelStageKey,
  query: AdminAcquisitionStageQuery,
) {
  const filters = {
    source: query.source,
    medium: query.medium,
    campaign: query.campaign,
  }
  const { evaluations } = await loadAcquisitionEvaluations(filters)
  const matching = evaluations
    .filter((evaluation) => evaluation.currentStage === stage)
    .sort((left, right) => {
      const leftTime =
        left.currentStageReachedAt?.getTime() ?? left.anchor.signupAt.getTime()
      const rightTime =
        right.currentStageReachedAt?.getTime() ?? right.anchor.signupAt.getTime()
      return rightTime - leftTime
    })
  const total = matching.length
  const start = (query.page - 1) * query.pageSize
  const pageEvaluations = matching.slice(start, start + query.pageSize)
  const userIds = pageEvaluations.flatMap((evaluation) =>
    evaluation.anchor.userId ? [evaluation.anchor.userId] : [],
  )
  const users = userIds.length
    ? await prisma.user.findMany({
        where: {
          id: { in: userIds },
          track: 'restaurantOwner',
        },
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          phoneVerifiedAt: true,
        },
      })
    : []
  const usersById = new Map(users.map((user) => [user.id, user]))

  return {
    stage,
    filters: {
      source: query.source ?? null,
      medium: query.medium ?? null,
      campaign: query.campaign ?? null,
    },
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
    rows: pageEvaluations.map((evaluation) => {
      const user = evaluation.anchor.userId
        ? usersById.get(evaluation.anchor.userId)
        : null
      const hasVerifiedPhone = Boolean(
        user?.phoneNumber && user.phoneVerifiedAt,
      )

      return {
        acquisitionId: evaluation.anchor.id,
        ownerName: user?.fullName.trim() || null,
        phoneNumber: hasVerifiedPhone ? user?.phoneNumber ?? null : null,
        phoneVerified: hasVerifiedPhone,
        source: evaluation.anchor.firstSource,
        medium: evaluation.anchor.firstMedium,
        campaign: evaluation.anchor.firstCampaign,
        flow: evaluation.anchor.flow,
        restaurant: evaluation.primaryRestaurant
          ? {
              id: evaluation.primaryRestaurant.id,
              restaurantName: evaluation.primaryRestaurant.restaurantName,
            }
          : null,
        currentStage: evaluation.currentStage,
        currentStageReachedAt:
          evaluation.currentStageReachedAt?.toISOString() ?? null,
        firstTouchedAt: evaluation.anchor.firstTouchedAt.toISOString(),
        signupStartedAt: evaluation.anchor.signupAt.toISOString(),
      }
    }),
  }
}
