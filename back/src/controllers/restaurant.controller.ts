import type { Request, Response } from 'express'
import type {
  RestaurantJob,
  RestaurantWorkerProfile,
} from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { getValidationErrorMessage } from '../utils/validation.js'
import {
  GooglePlacesError,
  verifyWorkerStreetPlaceId,
} from '../services/googlePlaces.service.js'
import {
  restaurantApplicationSchema,
  restaurantExploreSchema,
  restaurantProfileSchema,
  workerAvailabilityOptions,
  workerExperienceLevels,
} from '../validations/restaurant.validation.js'

const PROFILE_REQUIRED_MESSAGE =
  'Complete your worker profile to start seeing restaurant jobs.'

function getUserId(req: Request) {
  return (req as AuthenticatedRequest).userId
}

function mapRestaurantProfile(
  profile: RestaurantWorkerProfile,
  locationRequired: boolean,
) {
  return {
    id: profile.id,
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber,
    location: profile.location,
    wantedRoles: profile.wantedRoles,
    experienceText: profile.experienceText,
    availability: profile.availability,
    age: profile.age,
    homeStreetName: profile.homeStreetName,
    homeAreaFormatted: profile.homeAreaFormatted,
    homeGooglePlaceId: profile.homeGooglePlaceId,
    homeLatitude: profile.homeLatitude,
    homeLongitude: profile.homeLongitude,
    homeLocationUpdatedAt:
      profile.homeLocationUpdatedAt?.toISOString() ?? null,
    locationRequired,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }
}

function mapRestaurantJob(job: RestaurantJob) {
  return {
    id: job.id,
    restaurantName: job.restaurantName,
    role: job.role,
    city: job.location,
    street: job.area,
    description: job.description,
    requirements: job.requirements,
    shiftInfo: job.shiftInfo,
  }
}

function isRestaurantWorkerProfileComplete(
  profile: RestaurantWorkerProfile | null,
  user: {
    workerLocationRequired: boolean
    phoneNumber: string | null
    phoneVerifiedAt: Date | null
  },
): profile is RestaurantWorkerProfile {
  if (!profile) {
    return false
  }

  const [experienceLevel = ''] = profile.experienceText
    .trim()
    .split(/\n{2,}/)
  const selectedAvailability = profile.availability
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const requiredFieldsComplete = Boolean(
    profile.fullName.trim() &&
      profile.phoneNumber.trim() &&
      profile.age >= 16 &&
      profile.age <= 80 &&
      profile.wantedRoles.length > 0 &&
      workerExperienceLevels.includes(
        experienceLevel.trim() as (typeof workerExperienceLevels)[number],
      ) &&
      selectedAvailability.length > 0 &&
      selectedAvailability.every((item) =>
        workerAvailabilityOptions.includes(
          item as (typeof workerAvailabilityOptions)[number],
        ),
      ),
  )

  if (!requiredFieldsComplete) {
    return false
  }

  if (!user.workerLocationRequired) {
    return true
  }

  return Boolean(
    user.phoneNumber &&
      user.phoneVerifiedAt &&
      profile.homeGooglePlaceId,
  )
}

function isLocationMatch(job: RestaurantJob, profileLocation: string) {
  const normalizedProfileLocation = profileLocation.trim().toLowerCase()

  if (!normalizedProfileLocation) {
    return false
  }

  const jobLocation = `${job.location} ${job.area}`.toLowerCase()

  return (
    jobLocation.includes(normalizedProfileLocation) ||
    normalizedProfileLocation.includes(job.location.toLowerCase()) ||
    (job.area.length > 0 &&
      normalizedProfileLocation.includes(job.area.toLowerCase()))
  )
}

export async function getRestaurantProfile(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        restaurantWorkerProfile: true,
      },
    })

    if (!user) {
      return res.status(404).json({
        message: 'user not found',
      })
    }

    return res.json(
      user.restaurantWorkerProfile
        ? mapRestaurantProfile(
            user.restaurantWorkerProfile,
            user.workerLocationRequired,
          )
        : null,
    )
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch worker profile',
    })
  }
}

export async function updateRestaurantProfile(
  req: Request,
  res: Response,
) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const result = restaurantProfileSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        restaurantWorkerProfile: true,
      },
    })

    if (!user) {
      return res.status(404).json({
        message: 'user not found',
      })
    }

    const { homePlaceId, ...profileInput } = result.data

    if (
      user.workerLocationRequired &&
      (!user.phoneNumber || !user.phoneVerifiedAt)
    ) {
      return res.status(400).json({
        message: 'Verify your phone number before completing your profile.',
      })
    }

    if (
      user.workerLocationRequired &&
      !user.restaurantWorkerProfile?.homeGooglePlaceId &&
      !homePlaceId
    ) {
      return res.status(400).json({
        message: 'Choose a valid street in Tel Aviv–Yafo.',
      })
    }

    const verifiedStreet = homePlaceId
      ? await verifyWorkerStreetPlaceId({ placeId: homePlaceId })
      : null
    const homeLocationData = verifiedStreet
      ? {
          homeStreetName: verifiedStreet.streetName,
          homeAreaFormatted: verifiedStreet.formattedAddress,
          homeGooglePlaceId: verifiedStreet.googlePlaceId,
          homeLatitude: verifiedStreet.latitude,
          homeLongitude: verifiedStreet.longitude,
          homeLocationUpdatedAt: new Date(),
        }
      : {}

    const profile = await prisma.restaurantWorkerProfile.upsert({
      where: {
        userId,
      },
      update: {
        ...profileInput,
        ...(user.workerLocationRequired && user.phoneNumber
          ? { phoneNumber: user.phoneNumber }
          : {}),
        ...homeLocationData,
      },
      create: {
        ...profileInput,
        ...(user.workerLocationRequired && user.phoneNumber
          ? { phoneNumber: user.phoneNumber }
          : {}),
        ...homeLocationData,
        userId,
      },
    })

    return res.json(
      mapRestaurantProfile(profile, user.workerLocationRequired),
    )
  } catch (error) {
    if (error instanceof GooglePlacesError) {
      return res.status(error.status).json({
        message: error.message,
      })
    }

    console.error(error)

    return res.status(500).json({
      message: 'failed to save worker profile',
    })
  }
}

export async function getRestaurantMapJobs(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        track: true,
        workerLocationRequired: true,
        phoneNumber: true,
        phoneVerifiedAt: true,
        restaurantWorkerProfile: true,
      },
    })

    if (user?.track !== 'restaurant') {
      return res.status(403).json({
        message: 'restaurant worker access required',
      })
    }

    if (
      !isRestaurantWorkerProfileComplete(
        user.restaurantWorkerProfile,
        user,
      )
    ) {
      return res.status(400).json({
        message: PROFILE_REQUIRED_MESSAGE,
      })
    }

    const wantedRoles = user.restaurantWorkerProfile?.wantedRoles ?? []

    const restaurants = await prisma.restaurantOwnerProfile.findMany({
      where: {
        locationStatus: 'verified',
        latitude: {
          not: null,
        },
        longitude: {
          not: null,
        },
        jobs: {
          some: {
            kind: 'posted',
            isActive: true,
            ...(wantedRoles.length > 0
              ? {
                  role: {
                    in: wantedRoles,
                  },
                }
              : {}),
          },
        },
      },
      select: {
        id: true,
        restaurantName: true,
        formattedAddress: true,
        latitude: true,
        longitude: true,
        jobs: {
          where: {
            kind: 'posted',
            isActive: true,
            ...(wantedRoles.length > 0
              ? {
                  role: {
                    in: wantedRoles,
                  },
                }
              : {}),
          },
          select: {
            id: true,
            role: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        restaurantName: 'asc',
      },
    })

    return res.json(
      restaurants.map((restaurant) => ({
        restaurantId: restaurant.id,
        restaurantName: restaurant.restaurantName,
        formattedAddress: restaurant.formattedAddress ?? '',
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        jobs: restaurant.jobs.map((job) => ({
          id: job.id,
          role: job.role,
          title: job.role,
        })),
      })),
    )
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to load restaurant map jobs',
    })
  }
}

export async function getRestaurantExploreJobs(
  req: Request,
  res: Response,
) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const result = restaurantExploreSchema.safeParse(req.body ?? {})

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        restaurantWorkerProfile: true,
      },
    })
    const profile = user?.restaurantWorkerProfile ?? null

    if (!user || !isRestaurantWorkerProfileComplete(profile, user)) {
      return res.status(400).json({
        message: PROFILE_REQUIRED_MESSAGE,
      })
    }

    const jobs = await prisma.restaurantJob.findMany({
      where: {
        kind: 'posted',
        isActive: true,
        role: {
          in: profile.wantedRoles,
        },
        id: {
          notIn: result.data.excludeJobIds,
        },
        applications: {
          none: {
            userId,
          },
        },
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'asc',
        },
      ],
    })

    jobs.sort((firstJob, secondJob) => {
      const focusDifference =
        Number(secondJob.id === result.data.focusJobId) -
        Number(firstJob.id === result.data.focusJobId)

      if (focusDifference !== 0) {
        return focusDifference
      }

      return (
        Number(isLocationMatch(secondJob, profile.location)) -
        Number(isLocationMatch(firstJob, profile.location))
      )
    })

    return res.json({
      jobs: jobs.slice(0, result.data.limit).map(mapRestaurantJob),
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to load restaurant jobs',
    })
  }
}

export async function createRestaurantApplication(
  req: Request,
  res: Response,
) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const result = restaurantApplicationSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: getValidationErrorMessage(result.error),
      })
    }

    const restaurantJob = await prisma.restaurantJob.findFirst({
      where: {
        id: result.data.restaurantJobId,
        kind: 'posted',
        isActive: true,
      },
      select: {
        id: true,
      },
    })

    if (!restaurantJob) {
      return res.status(404).json({
        message: 'restaurant job not found',
      })
    }

    const application = await prisma.restaurantApplication.upsert({
      where: {
        userId_restaurantJobId: {
          userId,
          restaurantJobId: restaurantJob.id,
        },
      },
      create: {
        userId,
        restaurantJobId: restaurantJob.id,
      },
      update: {},
    })

    return res.status(201).json({
      application: {
        id: application.id,
        restaurantJobId: application.restaurantJobId,
        status: application.status,
      },
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to apply to restaurant job',
    })
  }
}

export async function getRestaurantMatches(req: Request, res: Response) {
  try {
    const userId = getUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'unauthorized',
      })
    }

    const matches = await prisma.restaurantApplication.findMany({
      where: {
        userId,
        status: 'selected',
      },
      include: {
        restaurantJob: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return res.json(
      matches.map((match) => ({
        id: match.id,
        createdAt: match.createdAt.toISOString(),
        job: {
          id: match.restaurantJob.id,
          restaurantName: match.restaurantJob.restaurantName,
          role: match.restaurantJob.role,
          city: match.restaurantJob.location,
          street: match.restaurantJob.area,
          description: match.restaurantJob.description,
          requirements: match.restaurantJob.requirements,
          shiftInfo: match.restaurantJob.shiftInfo,
          contactPhone: match.restaurantJob.contactPhone,
          contactWhatsapp: match.restaurantJob.contactWhatsapp,
        },
      })),
    )
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to fetch restaurant matches',
    })
  }
}
