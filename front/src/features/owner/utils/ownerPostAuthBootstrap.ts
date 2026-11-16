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

export function getOwnerPostAuthBootstrap(
  state: unknown,
): OwnerPostAuthBootstrap | null {
  if (!state || typeof state !== 'object' || !('ownerBootstrap' in state)) {
    return null
  }

  const bootstrap = (state as { ownerBootstrap?: unknown }).ownerBootstrap

  if (
    !bootstrap ||
    typeof bootstrap !== 'object' ||
    !Array.isArray((bootstrap as OwnerPostAuthBootstrap).restaurants)
  ) {
    return null
  }

  return bootstrap as OwnerPostAuthBootstrap
}
