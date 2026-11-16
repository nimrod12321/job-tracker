import { createContext, useContext } from 'react'
import type {
  OwnerAccessibleRestaurant,
  OwnerProfile,
} from '../types/owner'

export type ConsumedOwnerPostAuthProfile = {
  profile: OwnerProfile | null
}

export type OwnerRestaurantContextValue = {
  restaurants: OwnerAccessibleRestaurant[]
  selectedRestaurant: OwnerAccessibleRestaurant | null
  selectedRestaurantId: string | null
  isLoading: boolean
  selectRestaurant: (restaurantId: string) => void
  refreshRestaurants: (
    preferredRestaurantId?: string,
  ) => Promise<OwnerAccessibleRestaurant[]>
  consumePostAuthProfile: (
    restaurantId: string | null,
  ) => ConsumedOwnerPostAuthProfile | null
}

export const OwnerRestaurantContext =
  createContext<OwnerRestaurantContextValue | null>(null)

export function useOwnerRestaurant() {
  const context = useContext(OwnerRestaurantContext)

  if (!context) {
    throw new Error('Owner restaurant context is unavailable')
  }

  return context
}

export function useOptionalOwnerRestaurant() {
  return useContext(OwnerRestaurantContext)
}
