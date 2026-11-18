import type {
  AdminCandidateFollowUpStatus,
  AdminOpportunityConsentStatus,
  CandidateLeadStatus,
  RestaurantApplicationStatus,
  RestaurantRole,
} from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import {
  isAnalyticsExcludedCandidatePhone,
  isAnalyticsExcludedUser,
} from './analyticsExclusion.service.js'
import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'
import type {
  adminCandidateFollowUpFilters,
  adminCandidateFollowUpUpdateSchema,
} from '../validations/adminCandidateFollowUp.validation.js'
import type { z } from 'zod'

type FollowUpFilter = (typeof adminCandidateFollowUpFilters)[number]
type FollowUpUpdate = z.infer<typeof adminCandidateFollowUpUpdateSchema>

type RelatedApplication = {
  id: string
  source: 'qr' | 'jobBoard'
  restaurant: {
    id: string
    restaurantName: string
  }
  roles: RestaurantRole[]
  appliedAt: string
  restaurantStatus: CandidateLeadStatus | RestaurantApplicationStatus
  restaurantContactState: 'recorded' | 'notRecorded' | 'notTracked'
  restaurantContactAt: string | null
}

type FollowUpRecord = {
  id: string
  candidateUserId: string | null
  candidateName: string
  candidatePhone: string
  status: AdminCandidateFollowUpStatus
  privateNote: string
  lastAdminContactAt: Date | null
  nextFollowUpAt: Date | null
  opportunityConsent: AdminOpportunityConsentStatus
  opportunityConsentAt: Date | null
  opportunityConsentMethod: string | null
  createdAt: Date
  updatedAt: Date
}

type CandidateGroup = {
  phone: string
  names: string[]
  userIds: Set<string>
  applications: RelatedApplication[]
  followUp: FollowUpRecord | null
}

export type AdminCandidateFollowUpItem = {
  key: string
  candidate: {
    source: 'qr' | 'jobBoard' | 'followUp'
    id: string
  }
  candidateUserId: string | null
  fullName: string
  phoneNumber: string
  originalApplication: RelatedApplication | null
  relatedApplications: RelatedApplication[]
  restaurantContactState: 'recorded' | 'notRecorded' | 'notTracked'
  followUp: {
    id: string | null
    status: AdminCandidateFollowUpStatus
    privateNote: string
    lastAdminContactAt: string | null
    nextFollowUpAt: string | null
    opportunityConsent: AdminOpportunityConsentStatus
    opportunityConsentAt: string | null
    opportunityConsentMethod: string | null
    updatedAt: string | null
  }
}

type CandidateReference = FollowUpUpdate['candidate']

function normalizeCandidatePhone(phoneNumber: string) {
  const trimmedPhone = phoneNumber.trim()
  if (!trimmedPhone) return null

  try {
    return normalizeIsraeliPhoneNumber(trimmedPhone)
  } catch {
    return trimmedPhone
  }
}

function ensureCandidateGroup(
  groups: Map<string, CandidateGroup>,
  phoneNumber: string,
) {
  let group = groups.get(phoneNumber)

  if (!group) {
    group = {
      phone: phoneNumber,
      names: [],
      userIds: new Set(),
      applications: [],
      followUp: null,
    }
    groups.set(phoneNumber, group)
  }

  return group
}

function getRestaurantContactState(applications: RelatedApplication[]) {
  const qrApplications = applications.filter(
    (application) => application.source === 'qr',
  )

  if (
    qrApplications.some(
      (application) => application.restaurantContactState === 'recorded',
    )
  ) {
    return 'recorded' as const
  }

  if (qrApplications.length > 0) {
    return 'notRecorded' as const
  }

  return 'notTracked' as const
}

function mapGroup(group: CandidateGroup): AdminCandidateFollowUpItem {
  const applications = [...group.applications].sort(
    (first, second) =>
      new Date(first.appliedAt).getTime() -
      new Date(second.appliedAt).getTime(),
  )
  const originalApplication = applications[0] ?? null
  const candidate = originalApplication
    ? { source: originalApplication.source, id: originalApplication.id }
    : { source: 'followUp' as const, id: group.followUp!.id }
  const userIds = [...group.userIds]
  const candidateUserId =
    userIds.length === 1
      ? (userIds[0] ?? null)
      : group.followUp?.candidateUserId ?? null
  const followUp = group.followUp

  return {
    key: followUp?.id ?? `${candidate.source}:${candidate.id}`,
    candidate,
    candidateUserId,
    fullName:
      group.names.find((name) => name.trim()) ||
      followUp?.candidateName ||
      'Candidate',
    phoneNumber: group.phone,
    originalApplication,
    relatedApplications: applications,
    restaurantContactState: getRestaurantContactState(applications),
    followUp: {
      id: followUp?.id ?? null,
      status: followUp?.status ?? 'notContacted',
      privateNote: followUp?.privateNote ?? '',
      lastAdminContactAt:
        followUp?.lastAdminContactAt?.toISOString() ?? null,
      nextFollowUpAt: followUp?.nextFollowUpAt?.toISOString() ?? null,
      opportunityConsent: followUp?.opportunityConsent ?? 'notAsked',
      opportunityConsentAt:
        followUp?.opportunityConsentAt?.toISOString() ?? null,
      opportunityConsentMethod:
        followUp?.opportunityConsentMethod ?? null,
      updatedAt: followUp?.updatedAt.toISOString() ?? null,
    },
  }
}

function matchesFilter(
  candidate: AdminCandidateFollowUpItem,
  filter: FollowUpFilter,
) {
  if (filter === 'all') return true

  if (filter === 'notContacted') {
    const isQrFollowUpCandidate =
      candidate.restaurantContactState === 'notRecorded' ||
      (candidate.restaurantContactState === 'recorded' &&
        candidate.followUp.id !== null)

    return (
      isQrFollowUpCandidate &&
      candidate.followUp.status === 'notContacted'
    )
  }

  if (filter === 'inProgress') {
    return (
      candidate.followUp.status === 'contacted' ||
      candidate.followUp.status === 'lookingForJob'
    )
  }

  return (
    candidate.followUp.status === 'foundJobElsewhere' ||
    candidate.followUp.status === 'hiredByAdmin'
  )
}

export async function getAdminCandidateFollowUps(input: {
  filter: FollowUpFilter
  search: string
  page: number
  pageSize: number
}) {
  const [qrLeads, jobApplications, followUps] = await Promise.all([
    prisma.restaurantCandidateLead.findMany({
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        wantedRoles: true,
        status: true,
        firstContactInitiatedAt: true,
        createdAt: true,
        ownerProfile: {
          select: {
            id: true,
            restaurantName: true,
          },
        },
      },
    }),
    prisma.restaurantApplication.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            restaurantWorkerProfile: {
              select: {
                fullName: true,
                phoneNumber: true,
              },
            },
          },
        },
        restaurantJob: {
          select: {
            role: true,
            restaurantName: true,
            ownerProfile: {
              select: {
                id: true,
                restaurantName: true,
              },
            },
          },
        },
      },
    }),
    prisma.adminCandidateFollowUp.findMany(),
  ])
  const groups = new Map<string, CandidateGroup>()

  for (const lead of qrLeads) {
    if (isAnalyticsExcludedCandidatePhone(lead.phoneNumber)) continue

    const phoneNumber = normalizeCandidatePhone(lead.phoneNumber)
    if (!phoneNumber) continue

    const group = ensureCandidateGroup(groups, phoneNumber)
    group.names.push(lead.fullName)
    group.applications.push({
      id: lead.id,
      source: 'qr',
      restaurant: {
        id: lead.ownerProfile.id,
        restaurantName: lead.ownerProfile.restaurantName,
      },
      roles: lead.wantedRoles,
      appliedAt: lead.createdAt.toISOString(),
      restaurantStatus: lead.status,
      restaurantContactState:
        lead.firstContactInitiatedAt || lead.status === 'contacted'
          ? 'recorded'
          : 'notRecorded',
      restaurantContactAt:
        lead.firstContactInitiatedAt?.toISOString() ?? null,
    })
  }

  for (const application of jobApplications) {
    if (isAnalyticsExcludedUser(application.user)) continue

    const profile = application.user.restaurantWorkerProfile
    const phoneNumber = normalizeCandidatePhone(
      profile?.phoneNumber || application.user.phoneNumber || '',
    )
    if (!phoneNumber) continue

    const group = ensureCandidateGroup(groups, phoneNumber)
    group.names.push(profile?.fullName || application.user.fullName)
    group.userIds.add(application.user.id)
    group.applications.push({
      id: application.id,
      source: 'jobBoard',
      restaurant: {
        id: application.restaurantJob.ownerProfile?.id ?? '',
        restaurantName:
          application.restaurantJob.ownerProfile?.restaurantName ||
          application.restaurantJob.restaurantName,
      },
      roles: [application.restaurantJob.role],
      appliedAt: application.createdAt.toISOString(),
      restaurantStatus: application.status,
      restaurantContactState: 'notTracked',
      restaurantContactAt: null,
    })
  }

  for (const followUp of followUps) {
    if (isAnalyticsExcludedCandidatePhone(followUp.candidatePhone)) continue

    const phoneNumber =
      normalizeCandidatePhone(followUp.candidatePhone) ||
      followUp.candidatePhone
    const group = ensureCandidateGroup(groups, phoneNumber)
    group.followUp = followUp
    group.names.push(followUp.candidateName)
    if (followUp.candidateUserId) {
      group.userIds.add(followUp.candidateUserId)
    }
  }

  const normalizedSearch = input.search.trim().toLowerCase()
  const normalizedSearchPhone = normalizeCandidatePhone(input.search)
  const searchedCandidates = [...groups.values()]
    .map(mapGroup)
    .filter((candidate) => {
      if (!normalizedSearch) return true

      return (
        `${candidate.fullName} ${candidate.phoneNumber}`
          .toLowerCase()
          .includes(normalizedSearch) ||
        (normalizedSearchPhone !== null &&
          candidate.phoneNumber.includes(normalizedSearchPhone))
      )
    })
  const counts = {
    notContacted: searchedCandidates.filter((candidate) =>
      matchesFilter(candidate, 'notContacted'),
    ).length,
    inProgress: searchedCandidates.filter((candidate) =>
      matchesFilter(candidate, 'inProgress'),
    ).length,
    closed: searchedCandidates.filter((candidate) =>
      matchesFilter(candidate, 'closed'),
    ).length,
    all: searchedCandidates.length,
  }
  const matchingCandidates = searchedCandidates
    .filter((candidate) => matchesFilter(candidate, input.filter))
    .sort((first, second) => {
      if (input.filter === 'notContacted') {
        return (
          new Date(first.originalApplication?.appliedAt ?? 0).getTime() -
          new Date(second.originalApplication?.appliedAt ?? 0).getTime()
        )
      }

      return (
        new Date(
          second.followUp.lastAdminContactAt ??
            second.originalApplication?.appliedAt ??
            0,
        ).getTime() -
        new Date(
          first.followUp.lastAdminContactAt ??
            first.originalApplication?.appliedAt ??
            0,
        ).getTime()
      )
    })
  const total = matchingCandidates.length
  const start = (input.page - 1) * input.pageSize

  return {
    items: matchingCandidates.slice(start, start + input.pageSize),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    },
    counts,
  }
}

async function resolveCandidateReference(candidate: CandidateReference) {
  if (candidate.source === 'followUp') {
    const followUp = await prisma.adminCandidateFollowUp.findUnique({
      where: { id: candidate.id },
    })

    if (!followUp) return null

    return {
      candidateName: followUp.candidateName,
      candidatePhone: followUp.candidatePhone,
      candidateUserId: followUp.candidateUserId,
      existingFollowUpId: followUp.id,
    }
  }

  if (candidate.source === 'qr') {
    const lead = await prisma.restaurantCandidateLead.findUnique({
      where: { id: candidate.id },
      select: { fullName: true, phoneNumber: true },
    })

    if (!lead || isAnalyticsExcludedCandidatePhone(lead.phoneNumber)) {
      return null
    }

    const candidatePhone = normalizeCandidatePhone(lead.phoneNumber)
    if (!candidatePhone) return null

    const matchingUsers = await prisma.user.findMany({
      where: {
        OR: [
          { phoneNumber: candidatePhone },
          {
            restaurantWorkerProfile: {
              is: { phoneNumber: candidatePhone },
            },
          },
        ],
      },
      select: { id: true },
      take: 2,
    })

    return {
      candidateName: lead.fullName,
      candidatePhone,
      candidateUserId:
        matchingUsers.length === 1 ? (matchingUsers[0]?.id ?? null) : null,
      existingFollowUpId: null,
    }
  }

  const application = await prisma.restaurantApplication.findUnique({
    where: { id: candidate.id },
    select: {
      user: {
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          restaurantWorkerProfile: {
            select: { fullName: true, phoneNumber: true },
          },
        },
      },
    },
  })

  if (!application || isAnalyticsExcludedUser(application.user)) return null

  const profile = application.user.restaurantWorkerProfile
  const candidatePhone = normalizeCandidatePhone(
    profile?.phoneNumber || application.user.phoneNumber || '',
  )
  if (!candidatePhone) return null

  return {
    candidateName: profile?.fullName || application.user.fullName,
    candidatePhone,
    candidateUserId: application.user.id,
    existingFollowUpId: null,
  }
}

export class AdminCandidateFollowUpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export async function updateAdminCandidateFollowUp(input: FollowUpUpdate) {
  const identity = await resolveCandidateReference(input.candidate)

  if (!identity) {
    throw new AdminCandidateFollowUpError('candidate not found', 404)
  }

  return prisma.$transaction(async (tx) => {
    const matches = await tx.adminCandidateFollowUp.findMany({
      where: {
        OR: [
          { candidatePhone: identity.candidatePhone },
          ...(identity.candidateUserId
            ? [{ candidateUserId: identity.candidateUserId }]
            : []),
          ...(identity.existingFollowUpId
            ? [{ id: identity.existingFollowUpId }]
            : []),
        ],
      },
      take: 2,
    })

    if (matches.length > 1) {
      throw new AdminCandidateFollowUpError(
        'candidate follow-up identity is ambiguous',
        409,
      )
    }

    const existing = matches[0] ?? null
    const now = new Date()
    const opportunityConsentChanged =
      input.opportunityConsent !== undefined &&
      input.opportunityConsent !== existing?.opportunityConsent
    const previousStatus = existing?.status ?? 'notContacted'
    const recordsFirstAdminContact =
      previousStatus === 'notContacted' && input.status === 'contacted'
    const data = {
      candidateName: identity.candidateName,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.privateNote !== undefined
        ? { privateNote: input.privateNote }
        : {}),
      ...(input.nextFollowUpAt !== undefined
        ? {
            nextFollowUpAt: input.nextFollowUpAt
              ? new Date(input.nextFollowUpAt)
              : null,
          }
        : {}),
      ...(recordsFirstAdminContact ? { lastAdminContactAt: now } : {}),
      ...(input.opportunityConsent !== undefined
        ? {
            opportunityConsent: input.opportunityConsent,
            opportunityConsentAt:
              input.opportunityConsent === 'notAsked'
                ? null
                : opportunityConsentChanged ||
                    !existing?.opportunityConsentAt
                  ? now
                  : existing.opportunityConsentAt,
          }
        : {}),
      ...(input.opportunityConsentMethod !== undefined
        ? {
            opportunityConsentMethod:
              input.opportunityConsent === 'notAsked'
                ? null
                : input.opportunityConsentMethod || null,
          }
        : input.opportunityConsent === 'notAsked'
          ? { opportunityConsentMethod: null }
          : {}),
    }

    if (existing) {
      return tx.adminCandidateFollowUp.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(!existing.candidateUserId && identity.candidateUserId
            ? { candidateUserId: identity.candidateUserId }
            : {}),
        },
      })
    }

    return tx.adminCandidateFollowUp.create({
      data: {
        candidatePhone: identity.candidatePhone,
        candidateUserId: identity.candidateUserId,
        ...data,
      },
    })
  })
}
