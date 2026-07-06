import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  applyToRestaurantJob,
  getRestaurantExploreJobs,
} from '../services/restaurantApi'
import RestaurantSwipeCard from '../components/RestaurantSwipeCard'
import type { RestaurantExploreJob } from '../types/restaurant'

const PROFILE_REQUIRED_MESSAGE =
  'Complete your restaurant profile to start exploring jobs.'

function RestaurantExplorePage() {
  const [jobs, setJobs] = useState<RestaurantExploreJob[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [excludeJobIds, setExcludeJobIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const loadJobs = useCallback(async (excludedIds: string[]) => {
    setIsLoading(true)
    setNeedsProfile(false)
    setError(null)
    setFeedback(null)

    try {
      const nextJobs = await getRestaurantExploreJobs({
        limit: 10,
        excludeJobIds: excludedIds,
      })

      setJobs(nextJobs)
      setActiveIndex(0)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load restaurant jobs'

      setJobs([])
      setNeedsProfile(message === PROFILE_REQUIRED_MESSAGE)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isActive = true

    async function loadInitialJobs() {
      try {
        const initialJobs = await getRestaurantExploreJobs({
          limit: 10,
          excludeJobIds: [],
        })

        if (isActive) {
          setJobs(initialJobs)
          setActiveIndex(0)
        }
      } catch (error) {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load restaurant jobs'

        setJobs([])
        setNeedsProfile(message === PROFILE_REQUIRED_MESSAGE)
        setError(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadInitialJobs()

    return () => {
      isActive = false
    }
  }, [])

  const activeJob = jobs[activeIndex]

  function rememberJob(jobId: string) {
    setExcludeJobIds((currentIds) =>
      currentIds.includes(jobId) ? currentIds : [...currentIds, jobId],
    )
  }

  function handleSkip(): boolean {
    if (!activeJob || isApplying) {
      return false
    }

    rememberJob(activeJob.id)
    setError(null)
    setFeedback('Skipped')
    setActiveIndex((currentIndex) => currentIndex + 1)
    return true
  }

  async function handleApply(): Promise<boolean> {
    if (!activeJob || isApplying) {
      return false
    }

    setIsApplying(true)
    setError(null)
    setFeedback(null)

    try {
      await applyToRestaurantJob(activeJob.id)
      rememberJob(activeJob.id)
      setFeedback('Application sent')
      setActiveIndex((currentIndex) => currentIndex + 1)
      return true
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to apply to restaurant job',
      )
      return false
    } finally {
      setIsApplying(false)
    }
  }

  if (isLoading) {
    return (
      <section className="restaurant-explore-page">
        <div className="page-header">
          <div>
            <h1>Explore</h1>
            <p>Simple restaurant jobs picked for your profile.</p>
          </div>
        </div>
        <p className="status-message">Finding restaurant jobs...</p>
      </section>
    )
  }

  if (needsProfile) {
    return (
      <section className="restaurant-explore-page">
        <div className="page-header">
          <div>
            <h1>Explore</h1>
            <p>Simple restaurant jobs picked for your profile.</p>
          </div>
        </div>
        <div className="empty-state restaurant-empty-state">
          <h2>Complete your restaurant profile</h2>
          <p>{PROFILE_REQUIRED_MESSAGE}</p>
          <Link to="/restaurant/profile">Go to Profile</Link>
        </div>
      </section>
    )
  }

  if (error && jobs.length === 0) {
    return (
      <section className="restaurant-explore-page">
        <div className="page-header">
          <div>
            <h1>Explore</h1>
            <p>Simple restaurant jobs picked for your profile.</p>
          </div>
        </div>
        <p className="message message-error" role="alert">
          {error}
        </p>
        <button
          className="restaurant-retry-button"
          type="button"
          onClick={() => void loadJobs(excludeJobIds)}
        >
          Try again
        </button>
      </section>
    )
  }

  if (!activeJob) {
    return (
      <section className="restaurant-explore-page">
        <div className="page-header">
          <div>
            <h1>Explore</h1>
            <p>Simple restaurant jobs picked for your profile.</p>
          </div>
        </div>
        <div className="empty-state restaurant-empty-state">
          <h2>No more restaurant jobs right now.</h2>
          <p>Check again later or update your wanted roles and location.</p>
          <div className="restaurant-empty-actions">
            <Link to="/restaurant/profile">Update profile</Link>
            <button
              type="button"
              onClick={() => void loadJobs(excludeJobIds)}
            >
              Find more jobs
            </button>
          </div>
        </div>
        {feedback && (
          <p className="restaurant-feedback" aria-live="polite">
            {feedback}
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="restaurant-explore-page">
      <div className="page-header restaurant-explore-header">
        <div>
          <h1>Explore</h1>
          <p>Like means apply. Skip moves to the next job.</p>
        </div>
        <span>
          {activeIndex + 1} of {jobs.length}
        </span>
      </div>

      {feedback && (
        <p className="restaurant-feedback" aria-live="polite">
          {feedback}
        </p>
      )}

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      <RestaurantSwipeCard
        key={activeJob.id}
        job={activeJob}
        isApplying={isApplying}
        onApply={handleApply}
        onSkip={handleSkip}
      />
    </section>
  )
}

export default RestaurantExplorePage
