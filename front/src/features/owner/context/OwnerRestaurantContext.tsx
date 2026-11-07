import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Navigate } from 'react-router-dom'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import { getOwnerRestaurants } from '../services/ownerApi'
import type { OwnerAccessibleRestaurant } from '../types/owner'
import {
  resolveValidOwnerRestaurantId,
  storeOwnerRestaurantId,
} from '../utils/ownerRestaurantSelection'
import {
  OwnerRestaurantContext,
  type OwnerRestaurantContextValue,
  useOwnerRestaurant,
} from './ownerRestaurantState'

export function OwnerRestaurantProvider({ children }: { children: ReactNode }) {
  const { language } = useRestaurantLanguage()
  const [restaurants, setRestaurants] = useState<OwnerAccessibleRestaurant[]>([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<
    string | null
  >(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshRestaurants = useCallback(async () => {
    try {
      const nextRestaurants = await getOwnerRestaurants()
      const nextRestaurantId =
        resolveValidOwnerRestaurantId(nextRestaurants)

      setRestaurants(nextRestaurants)
      setSelectedRestaurantId(nextRestaurantId)
      setError(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load restaurants',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isActive = true

    void getOwnerRestaurants()
      .then((nextRestaurants) => {
        if (!isActive) return

        setRestaurants(nextRestaurants)
        setSelectedRestaurantId(
          resolveValidOwnerRestaurantId(nextRestaurants),
        )
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (!isActive) return

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load restaurants',
        )
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  const selectedRestaurant = useMemo(
    () =>
      restaurants.find(
        (restaurant) => restaurant.restaurantId === selectedRestaurantId,
      ) ?? null,
    [restaurants, selectedRestaurantId],
  )

  const value = useMemo<OwnerRestaurantContextValue>(
    () => ({
      restaurants,
      selectedRestaurant,
      selectedRestaurantId,
      isLoading,
      selectRestaurant(restaurantId: string) {
        if (
          !restaurants.some(
            (restaurant) => restaurant.restaurantId === restaurantId,
          )
        ) {
          return
        }

        storeOwnerRestaurantId(restaurantId)
        setSelectedRestaurantId(restaurantId)
      },
      refreshRestaurants,
    }),
    [
      isLoading,
      refreshRestaurants,
      restaurants,
      selectedRestaurant,
      selectedRestaurantId,
    ],
  )

  if (isLoading) {
    return (
      <p className="status-message" aria-live="polite">
        {language === 'he' ? 'טוען מסעדות…' : 'Loading restaurants…'}
      </p>
    )
  }

  if (error) {
    return (
      <p className="message message-error" role="alert">
        {error}
      </p>
    )
  }

  return (
    <OwnerRestaurantContext.Provider value={value}>
      {children}
    </OwnerRestaurantContext.Provider>
  )
}

export function OwnerOnlyRestaurantRoute({ children }: { children: ReactNode }) {
  const { selectedRestaurant } = useOwnerRestaurant()

  if (selectedRestaurant?.membershipRole === 'hiringManager') {
    return <Navigate to="/owner/jobs" replace />
  }

  return children
}
