import { useEffect, useRef, useState } from 'react'
import type { RestaurantMapEntry } from '../types/restaurant'
import { loadGoogleMaps, type GoogleMarkerInstance } from '../../../utils/googleMaps'

type JobsMapProps = {
  restaurants: RestaurantMapEntry[]
  center?: { latitude: number; longitude: number } | null
  language: 'he' | 'en'
  onSelectRestaurant: (restaurant: RestaurantMapEntry) => void
}

const TEL_AVIV_CENTER = { lat: 32.0853, lng: 34.7818 }

// Keep geographic context while removing Google's unrelated business/POI
// labels. Every visible business marker is created below from Peepss data.
const CLEAN_ROADMAP_STYLES = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
]

function JobsMap({
  restaurants,
  center,
  language,
  onSelectRestaurant,
}: JobsMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!mapElementRef.current) {
      return
    }

    let isActive = true
    const markers: GoogleMarkerInstance[] = []

    void loadGoogleMaps()
      .then((google) => {
        if (!isActive || !mapElementRef.current) {
          return
        }

        const initialCenter = center
          ? { lat: center.latitude, lng: center.longitude }
          : TEL_AVIV_CENTER
        const map = new google.maps.Map(mapElementRef.current, {
          center: initialCenter,
          zoom: center ? 13 : 12,
          mapTypeId: 'roadmap',
          styles: CLEAN_ROADMAP_STYLES,
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: true,
        })
        const bounds = new google.maps.LatLngBounds()

        restaurants.forEach((restaurant) => {
          const position = {
            lat: restaurant.latitude,
            lng: restaurant.longitude,
          }
          const marker = new google.maps.Marker({
            map,
            position,
            title: restaurant.restaurantName,
          })

          marker.addListener('click', () => onSelectRestaurant(restaurant))
          markers.push(marker)
          bounds.extend(position)
        })

        if (center) {
          bounds.extend(initialCenter)
        }

        if (restaurants.length === 1) {
          map.setCenter({
            lat: restaurants[0].latitude,
            lng: restaurants[0].longitude,
          })
          map.setZoom(14)
        } else if (restaurants.length > 1) {
          map.fitBounds(bounds, 56)
        }
      })
      .catch(() => {
        if (isActive) {
          setError(true)
        }
      })

    return () => {
      isActive = false
      markers.forEach((marker) => marker.setMap(null))
    }
  }, [center, onSelectRestaurant, restaurants])

  return (
    <div className="restaurant-jobs-map-wrap">
      <div
        ref={mapElementRef}
        className="restaurant-jobs-map"
        aria-label={language === 'he' ? 'מפת משרות' : 'Jobs map'}
      />
      {error && (
        <p className="restaurant-map-error" role="alert">
          {language === 'he'
            ? 'המפה אינה זמינה כרגע. נסו שוב.'
            : 'The map is temporarily unavailable. Please try again.'}
        </p>
      )}
    </div>
  )
}

export default JobsMap
