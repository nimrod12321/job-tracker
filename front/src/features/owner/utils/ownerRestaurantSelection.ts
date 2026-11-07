import type { OwnerAccessibleRestaurant } from '../types/owner'

const OWNER_RESTAURANT_SELECTION_KEY =
  'peepss_selected_owner_restaurant_id'

export function getStoredOwnerRestaurantId() {
  return sessionStorage.getItem(OWNER_RESTAURANT_SELECTION_KEY)
}

export function storeOwnerRestaurantId(restaurantId: string) {
  sessionStorage.setItem(OWNER_RESTAURANT_SELECTION_KEY, restaurantId)
}

export function clearStoredOwnerRestaurantId() {
  sessionStorage.removeItem(OWNER_RESTAURANT_SELECTION_KEY)
}

export function resolveValidOwnerRestaurantId(
  restaurants: OwnerAccessibleRestaurant[],
) {
  const storedRestaurantId = getStoredOwnerRestaurantId()
  const selectedRestaurant = restaurants.find(
    (restaurant) => restaurant.restaurantId === storedRestaurantId,
  )
  const restaurantId =
    selectedRestaurant?.restaurantId ?? restaurants[0]?.restaurantId ?? null

  if (restaurantId) {
    storeOwnerRestaurantId(restaurantId)
  } else {
    clearStoredOwnerRestaurantId()
  }

  return restaurantId
}
