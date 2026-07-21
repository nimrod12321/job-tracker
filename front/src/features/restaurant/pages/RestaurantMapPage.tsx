import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ENABLE_JOB_MAP } from '../../../config/env'
import JobsMap from '../components/JobsMap'
import RestaurantViewSwitcher from '../components/RestaurantViewSwitcher'
import {
  getRestaurantMapJobs,
  getRestaurantProfile,
} from '../services/restaurantApi'
import {
  getRestaurantRoleLabel,
  type RestaurantMapEntry,
  type RestaurantWorkerProfile,
} from '../types/restaurant'
import { useRestaurantLanguage } from '../utils/restaurantLanguage'

const PROFILE_REQUIRED_MESSAGE =
  'Complete your worker profile to start seeing restaurant jobs.'

function getApproximateDistanceKm(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(second.latitude - first.latitude)
  const longitudeDelta = toRadians(second.longitude - first.longitude)
  const firstLatitude = toRadians(first.latitude)
  const secondLatitude = toRadians(second.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine))
}

function RestaurantMapPage() {
  const navigate = useNavigate()
  const { direction, language } = useRestaurantLanguage()
  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([])
  const [profile, setProfile] = useState<RestaurantWorkerProfile | null>(null)
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<RestaurantMapEntry | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleSelectRestaurant = useCallback(
    (restaurant: RestaurantMapEntry) => setSelectedRestaurant(restaurant),
    [],
  )

  useEffect(() => {
    let isActive = true

    void Promise.all([getRestaurantMapJobs(), getRestaurantProfile()])
      .then(([nextRestaurants, nextProfile]) => {
        if (isActive) {
          setRestaurants(nextRestaurants)
          setProfile(nextProfile)
        }
      })
      .catch((loadError) => {
        if (isActive) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load jobs map'

          if (message === PROFILE_REQUIRED_MESSAGE) {
            navigate('/restaurant/profile', { replace: true })
            return
          }

          setError(message)
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [navigate])

  const workerLocation = useMemo(() => {
    if (
      typeof profile?.homeLatitude !== 'number' ||
      typeof profile.homeLongitude !== 'number'
    ) {
      return null
    }

    return {
      latitude: profile.homeLatitude,
      longitude: profile.homeLongitude,
    }
  }, [profile])

  const selectedDistance =
    selectedRestaurant && workerLocation
      ? getApproximateDistanceKm(workerLocation, selectedRestaurant)
      : null

  if (!ENABLE_JOB_MAP) {
    return <Navigate to="/restaurant/explore" replace />
  }

  return (
    <section className="restaurant-map-page" dir={direction}>
      <div className="restaurant-map-toolbar">
        <RestaurantViewSwitcher language={language} />
      </div>

      {!workerLocation && !isLoading && (
        <div className="restaurant-map-location-prompt">
          <p>
            {language === 'he'
              ? 'הוסיפו את הרחוב שלכם כדי לראות משרות קרובות.'
              : 'Add your street to see jobs near you.'}
          </p>
          <Link to="/restaurant/profile">
            {language === 'he' ? 'הוספת מיקום' : 'Add location'}
          </Link>
        </div>
      )}

      {error ? (
        <p className="message message-error" role="alert">
          {error}
        </p>
      ) : isLoading ? (
        <p className="status-message">
          {language === 'he' ? 'טוען מפה…' : 'Loading map…'}
        </p>
      ) : (
        <>
          <JobsMap
            center={workerLocation}
            language={language}
            restaurants={restaurants}
            onSelectRestaurant={handleSelectRestaurant}
          />
          {restaurants.length === 0 && (
            <div className="restaurant-map-empty">
              {language === 'he'
                ? 'עדיין אין מסעדות עם משרות פעילות ומיקום מאומת.'
                : 'There are no restaurants with active jobs and verified locations yet.'}
            </div>
          )}
        </>
      )}

      {selectedRestaurant && (
        <aside className="restaurant-map-sheet" aria-live="polite">
          <button
            type="button"
            className="peepss-close-button restaurant-map-sheet-close"
            aria-label={language === 'he' ? 'סגירה' : 'Close'}
            onClick={() => setSelectedRestaurant(null)}
          >
            ×
          </button>
          <h2>{selectedRestaurant.restaurantName}</h2>
          <p>{selectedRestaurant.formattedAddress}</p>
          <strong>{language === 'he' ? 'מגייסים:' : 'Hiring:'}</strong>
          <ul className="restaurant-map-job-links">
            {selectedRestaurant.jobs.map((job) => (
              <li key={job.id}>
                <Link
                  to={`/restaurant/explore?jobId=${encodeURIComponent(job.id)}`}
                >
                  {getRestaurantRoleLabel(job.role, language)}
                </Link>
              </li>
            ))}
          </ul>
          {selectedDistance !== null && (
            <p className="restaurant-map-distance">
              {language === 'he'
                ? `במרחק של כ־${selectedDistance.toFixed(1)} ק״מ`
                : `About ${selectedDistance.toFixed(1)} km away`}
            </p>
          )}
          <Link className="restaurant-map-view-jobs" to="/restaurant/explore">
            {language === 'he' ? 'צפייה במשרות' : 'View jobs'}
          </Link>
        </aside>
      )}
    </section>
  )
}

export default RestaurantMapPage
