import { createContext, useContext } from 'react'
import type { OwnerAccessibleRestaurant } from '../types/owner'

export type OwnerRestaurantContextValue = {
  restaurants: OwnerAccessibleRestaurant[]
  selectedRestaurant: OwnerAccessibleRestaurant | null
  selectedRestaurantId: string | null
  isLoading: boolean
  selectRestaurant: (restaurantId: string) => void
  refreshRestaurants: () => Promise<void>
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
