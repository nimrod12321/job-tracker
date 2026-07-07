import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  applyToRestaurantJob,
  getRestaurantExploreJobs,
} from '../services/restaurantApi'
import RestaurantLanguageToggle from '../components/RestaurantLanguageToggle'
import RestaurantSwipeCard from '../components/RestaurantSwipeCard'
import type { RestaurantExploreJob } from '../types/restaurant'
import { useRestaurantLanguage } from '../utils/restaurantLanguage'

const PROFILE_REQUIRED_MESSAGE =
  'Complete your restaurant profile to start exploring jobs.'

function RestaurantExplorePage() {
  const { direction, language } = useRestaurantLanguage()
  const [jobs, setJobs] = useState<RestaurantExploreJob[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [excludeJobIds, setExcludeJobIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const text = {
    title: language === 'he' ? 'משמרות סביבך' : 'Jobs near you',
    subtitle:
      language === 'he'
        ? 'החלק ימינה כדי להגיש בקשה, שמאלה כדי לדלג.'
        : 'Swipe right to apply, left to skip.',
    loading:
      language === 'he'
        ? 'מחפש משמרות במסעדות...'
        : 'Finding restaurant jobs...',
    completeProfile:
      language === 'he'
        ? 'צריך להשלים פרופיל'
        : 'Complete your restaurant profile',
    completeProfileMessage:
      language === 'he'
        ? 'השלים פרופיל קצר כדי להתחיל לראות משמרות.'
        : PROFILE_REQUIRED_MESSAGE,
    goToProfile: language === 'he' ? 'לפרופיל' : 'Go to Profile',
    tryAgain: language === 'he' ? 'נסה שוב' : 'Try again',
    noMore:
      language === 'he'
        ? 'אין עוד משמרות כרגע.'
        : 'No more restaurant jobs right now.',
    noMoreHint:
      language === 'he'
        ? 'אפשר לבדוק שוב מאוחר יותר או לעדכן תפקידים ומיקום.'
        : 'Check again later or update your wanted roles and location.',
    updateProfile: language === 'he' ? 'עדכון פרופיל' : 'Update profile',
    findMore: language === 'he' ? 'חפש עוד משמרות' : 'Find more jobs',
    skipped: language === 'he' ? 'דילגת' : 'Skipped',
    applied: language === 'he' ? 'הבקשה נשלחה' : 'Application sent',
  }

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
    setFeedback(text.skipped)
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
      setFeedback(text.applied)
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
      <section className="restaurant-explore-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
          <RestaurantLanguageToggle />
        </div>
        <p className="status-message">{text.loading}</p>
      </section>
    )
  }

  if (needsProfile) {
    return (
      <section className="restaurant-explore-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
          <RestaurantLanguageToggle />
        </div>
        <div className="empty-state restaurant-empty-state">
          <h2>{text.completeProfile}</h2>
          <p>{text.completeProfileMessage}</p>
          <Link to="/restaurant/profile">{text.goToProfile}</Link>
        </div>
      </section>
    )
  }

  if (error && jobs.length === 0) {
    return (
      <section className="restaurant-explore-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
          <RestaurantLanguageToggle />
        </div>
        <p className="message message-error" role="alert">
          {error}
        </p>
        <button
          className="restaurant-retry-button"
          type="button"
          onClick={() => void loadJobs(excludeJobIds)}
        >
          {text.tryAgain}
        </button>
      </section>
    )
  }

  if (!activeJob) {
    return (
      <section className="restaurant-explore-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
          <RestaurantLanguageToggle />
        </div>
        <div className="empty-state restaurant-empty-state">
          <h2>{text.noMore}</h2>
          <p>{text.noMoreHint}</p>
          <div className="restaurant-empty-actions">
            <Link to="/restaurant/profile">{text.updateProfile}</Link>
            <button
              type="button"
              onClick={() => void loadJobs(excludeJobIds)}
            >
              {text.findMore}
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
    <section className="restaurant-explore-page" dir={direction}>
      <div className="page-header restaurant-explore-header">
        <div>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
        <RestaurantLanguageToggle />
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
        language={language}
        onApply={handleApply}
        onSkip={handleSkip}
      />
    </section>
  )
}

export default RestaurantExplorePage
