import {
  RestaurantJobKind,
  RestaurantRole,
} from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'

const starterDraftSignatures = [
  {
    role: RestaurantRole.waiter,
    shiftInfo:
      '3–4 shifts per week, including at least one weekend shift.',
  },
  {
    role: RestaurantRole.bartender,
    shiftInfo:
      'Mostly evening shifts, 3–4 shifts per week, including at least one weekend shift.',
  },
  {
    role: RestaurantRole.host,
    shiftInfo: 'Evening and weekend shifts, 3–4 shifts per week.',
  },
  {
    role: RestaurantRole.cook,
    shiftInfo:
      '3–4 shifts per week, morning/evening depending on restaurant needs, including at least one weekend shift.',
  },
  {
    role: RestaurantRole.floorManager,
    shiftInfo:
      '3–4 shifts per week, including evening and weekend availability.',
  },
]

function isStarterDraftCandidate(job: {
  role: RestaurantRole
  shiftInfo: string
  isActive: boolean
  applications: Array<{ id: string }>
}) {
  return (
    !job.isActive &&
    job.applications.length === 0 &&
    starterDraftSignatures.some(
      (signature) =>
        signature.role === job.role &&
        signature.shiftInfo === job.shiftInfo,
    )
  )
}

async function repairOwnerStarterDrafts() {
  const ownerProfiles = await prisma.restaurantOwnerProfile.findMany({
    select: {
      id: true,
      restaurantName: true,
      jobs: {
        include: {
          applications: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  })

  let repairedOwnersCount = 0
  let repairedJobsCount = 0

  for (const profile of ownerProfiles) {
    const existingDrafts = profile.jobs.filter(
      (job) => job.kind === RestaurantJobKind.draft,
    )

    if (existingDrafts.length > 0) {
      continue
    }

    const candidates = profile.jobs.filter(
      (job) =>
        job.kind === RestaurantJobKind.posted &&
        isStarterDraftCandidate(job),
    )

    const hasEveryStarterRole = starterDraftSignatures.every(
      (signature) =>
        candidates.some(
          (job) =>
            job.role === signature.role &&
            job.shiftInfo === signature.shiftInfo,
        ),
    )

    if (!hasEveryStarterRole || candidates.length !== starterDraftSignatures.length) {
      continue
    }

    await prisma.restaurantJob.updateMany({
      where: {
        id: {
          in: candidates.map((job) => job.id),
        },
      },
      data: {
        kind: RestaurantJobKind.draft,
        isActive: false,
      },
    })

    repairedOwnersCount += 1
    repairedJobsCount += candidates.length
    console.log(
      `Repaired ${candidates.length} starter drafts for ${profile.restaurantName || profile.id}.`,
    )
  }

  console.log(
    `Owner starter draft repair complete: ${repairedOwnersCount} owners, ${repairedJobsCount} jobs repaired.`,
  )
}

try {
  await repairOwnerStarterDrafts()
} finally {
  await prisma.$disconnect()
}
