import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  applyToRestaurantJob,
  getRestaurantJobBoardRestaurant,
  getRestaurantProfile,
} from '../services/restaurantApi'
import {
  getRestaurantEmploymentScopeLabel,
  getRestaurantRoleLabel,
  getRestaurantVenueTypeLabel,
  type RestaurantExploreJob,
  type RestaurantJobBoardRestaurant,
  type RestaurantRole,
} from '../types/restaurant'
import { useRestaurantLanguage } from '../utils/restaurantLanguage'

function RestaurantJobBoardDetailPage() {
  const { restaurantId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { direction, language } = useRestaurantLanguage()
  const [restaurant, setRestaurant] =
    useState<RestaurantJobBoardRestaurant | null>(null)
  const [jobs, setJobs] = useState<RestaurantExploreJob[]>([])
  const [wantedRoles, setWantedRoles] = useState<RestaurantRole[]>([])
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([])
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const text = {
    back: language === 'he' ? 'חזרה' : 'Back',
    loading: language === 'he' ? 'טוען משרות...' : 'Loading jobs...',
    openJobs: language === 'he' ? 'משרות פתוחות' : 'Open jobs',
    noJobs:
      language === 'he'
        ? 'אין כרגע משרות פעילות במסעדה הזו.'
        : 'This restaurant has no active jobs right now.',
    scope: language === 'he' ? 'היקף משרה' : 'Employment scope',
    salary: language === 'he' ? 'שכר שעתי' : 'Hourly wage',
    description:
      language === 'he' ? 'הגדרת תפקיד' : 'Job description',
    requirements: language === 'he' ? 'דרישות' : 'Requirements',
    apply: language === 'he' ? 'הגש בקשה' : 'Apply',
    applying: language === 'he' ? 'שולח...' : 'Applying...',
    applied: language === 'he' ? 'הבקשה נשלחה' : 'Application sent',
    updatePreferences:
      language === 'he' ? 'עדכון העדפות להגשה' : 'Update preferences to apply',
  }

  useEffect(() => {
    let isActive = true

    async function loadRestaurant() {
      setIsLoading(true)
      setError(null)

      try {
        const [response, profile] = await Promise.all([
          getRestaurantJobBoardRestaurant(restaurantId),
          getRestaurantProfile(),
        ])

        if (isActive) {
          setRestaurant(response.restaurant)
          setJobs(response.jobs)
          setWantedRoles(profile?.wantedRoles ?? [])
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load restaurant jobs',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadRestaurant()

    return () => {
      isActive = false
    }
  }, [restaurantId])

  async function handleApply(job: RestaurantExploreJob) {
    if (busyJobId || appliedJobIds.includes(job.id)) {
      return
    }

    setBusyJobId(job.id)
    setError(null)

    try {
      await applyToRestaurantJob(job.id)
      setAppliedJobIds((currentIds) => [...currentIds, job.id])
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : 'Failed to apply to restaurant job',
      )
    } finally {
      setBusyJobId(null)
    }
  }

  function openPreferences(role: RestaurantRole) {
    const returnTo = encodeURIComponent(location.pathname)
    navigate(`/restaurant/profile?returnTo=${returnTo}&role=${role}`)
  }

  if (isLoading) {
    return <p className="status-message">{text.loading}</p>
  }

  return (
    <section className="restaurant-board-detail-page" dir={direction}>
      <button
        className="restaurant-board-detail-back ui-button ui-button--tertiary"
        type="button"
        onClick={() =>
          location.key === 'default'
            ? navigate('/restaurant/explore')
            : navigate(-1)
        }
      >
        {text.back}
      </button>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      {restaurant && (
        <header className="restaurant-board-detail-header">
          <h1>{restaurant.restaurantName}</h1>
          <p>{[restaurant.city, restaurant.street].filter(Boolean).join(' · ')}</p>
          {restaurant.venueTypes.length > 0 && (
            <div className="restaurant-board-venue-types">
              {restaurant.venueTypes.map((venueType) => (
                <span key={venueType}>
                  {getRestaurantVenueTypeLabel(venueType, language)}
                </span>
              ))}
            </div>
          )}
          {restaurant.description && <p dir="auto">{restaurant.description}</p>}
        </header>
      )}

      <div className="restaurant-board-detail-heading">
        <h2>{text.openJobs}</h2>
      </div>

      {jobs.length === 0 ? (
        <p className="empty-state">{text.noJobs}</p>
      ) : (
        <div className="restaurant-board-job-list">
          {jobs.map((job) => {
            const canApply = wantedRoles.includes(job.role)
            const wasApplied = appliedJobIds.includes(job.id)

            return (
              <article className="restaurant-board-job-card" key={job.id}>
                <h3>{getRestaurantRoleLabel(job.role, language)}</h3>
                <section>
                  <h4>{text.scope}</h4>
                  <p>
                    {getRestaurantEmploymentScopeLabel(
                      job.employmentScope,
                      language,
                    )}
                  </p>
                </section>
                {job.hourlyWage !== null && (
                  <section>
                    <h4>{text.salary}</h4>
                    <p>
                      {language === 'he'
                        ? `₪${job.hourlyWage} לשעה`
                        : `₪${job.hourlyWage}/hour`}
                    </p>
                  </section>
                )}
                {job.description && (
                  <section>
                    <h4>{text.description}</h4>
                    <p dir="auto">{job.description}</p>
                  </section>
                )}
                {job.requirements && (
                  <section>
                    <h4>{text.requirements}</h4>
                    <p dir="auto">{job.requirements}</p>
                  </section>
                )}
                {canApply ? (
                  <button
                    className="ui-button ui-button--primary"
                    type="button"
                    disabled={busyJobId !== null || wasApplied}
                    onClick={() => void handleApply(job)}
                  >
                    {wasApplied
                      ? text.applied
                      : busyJobId === job.id
                        ? text.applying
                        : text.apply}
                  </button>
                ) : (
                  <button
                    className="ui-button ui-button--secondary"
                    type="button"
                    onClick={() => openPreferences(job.role)}
                  >
                    {text.updatePreferences}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default RestaurantJobBoardDetailPage
