import type {
  OwnerAccessibleRestaurant,
  OwnerProfile,
} from '../types/owner.ts'
import { resolveValidOwnerRestaurantId } from './ownerRestaurantSelection.ts'

export type OwnerPostAuthBootstrap = {
  restaurants: OwnerAccessibleRestaurant[]
  selectedRestaurantId: string | null
  profile: OwnerProfile | null
}

export type OwnerPostAuthBootstrapHandoff = {
  authSessionId: string
  userId: string
  bootstrap: OwnerPostAuthBootstrap
}

type OwnerPostAuthDependencies = {
  getRestaurants: () => Promise<OwnerAccessibleRestaurant[]>
  getProfile: (restaurantId?: string) => Promise<OwnerProfile | null>
}

export async function loadOwnerPostAuthBootstrap(
  preferredRestaurantId: string | null | undefined,
  dependencies: OwnerPostAuthDependencies,
): Promise<OwnerPostAuthBootstrap> {
  const restaurants = await dependencies.getRestaurants()
  const selectedRestaurantId = resolveValidOwnerRestaurantId(
    restaurants,
    preferredRestaurantId,
  )
  const profile = await dependencies.getProfile(
    selectedRestaurantId ?? undefined,
  )

  return {
    restaurants,
    selectedRestaurantId,
    profile,
  }
}

export function createOwnerPostAuthBootstrapHandoff(
  authSessionId: string,
  userId: string,
  bootstrap: OwnerPostAuthBootstrap,
): OwnerPostAuthBootstrapHandoff {
  return {
    authSessionId,
    userId,
    bootstrap,
  }
}

export function resolveOwnerPostAuthBootstrap(
  handoff: OwnerPostAuthBootstrapHandoff | null,
  authSessionId: string,
  userId: string | null | undefined,
): OwnerPostAuthBootstrap | null {
  if (
    !handoff ||
    !userId ||
    handoff.authSessionId !== authSessionId ||
    handoff.userId !== userId
  ) {
    return null
  }

  return handoff.bootstrap
}
