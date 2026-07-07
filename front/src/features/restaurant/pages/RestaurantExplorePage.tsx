import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  applyToRestaurantJob,
  getRestaurantExploreJobs,
} from '../services/restaurantApi'
import RestaurantSwipeCard from '../components/RestaurantSwipeCard'
import type { RestaurantExploreJob } from '../types/restaurant'
import { useRestaurantLanguage } from '../utils/restaurantLanguage'

const PROFILE_REQUIRED_MESSAGE =
  'Complete your restaurant profile to start exploring jobs.'
const CARD_ANIMATION_MS = 260

type CardAnimationDirection = 'left' | 'right'

function RestaurantExplorePage() {
  const { direction, language } = useRestaurantLanguage()
  const [jobs, setJobs] = useState<RestaurantExploreJob[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [excludeJobIds, setExcludeJobIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationDirection, setAnimationDirection] =
    useState<CardAnimationDirection | null>(null)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const animationTimeout = useRef<number | null>(null)
  const activeIndexRef = useRef(0)
  const isCardActionPending = useRef(false)
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
    applied: language === 'he' ? 'נשלח' : 'Sent',
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

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  const activeJob = jobs[activeIndex]
  const nextJob = jobs[activeIndex + 1]

  function animateToNext(direction: CardAnimationDirection) {
    if (animationTimeout.current !== null) {
      window.clearTimeout(animationTimeout.current)
    }

    setAnimationDirection(direction)
    setIsAnimating(true)

    animationTimeout.current = window.setTimeout(() => {
      setActiveIndex((currentIndex) => currentIndex + 1)
      setAnimationDirection(null)
      setIsAnimating(false)
      isCardActionPending.current = false
      animationTimeout.current = null
    }, CARD_ANIMATION_MS)
  }

  function rememberJob(jobId: string) {
    setExcludeJobIds((currentIds) =>
      currentIds.includes(jobId) ? currentIds : [...currentIds, jobId],
    )
  }

  function forgetJob(jobId: string) {
    setExcludeJobIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== jobId),
    )
  }

  function handleSkip(): boolean {
    if (!activeJob || isAnimating || isCardActionPending.current) {
      return false
    }

    isCardActionPending.current = true
    rememberJob(activeJob.id)
    setError(null)
    setFeedback(text.skipped)
    animateToNext('left')
    return true
  }

  async function handleApply(): Promise<boolean> {
    if (!activeJob || isAnimating || isCardActionPending.current) {
      return false
    }

    const jobToApply = activeJob

    isCardActionPending.current = true
    setError(null)
    setFeedback(text.applied)
    rememberJob(jobToApply.id)
    animateToNext('right')

    void applyToRestaurantJob(jobToApply.id)
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to apply to restaurant job'

        if (!message.toLowerCase().includes('already')) {
          forgetJob(jobToApply.id)
          setJobs((currentJobs) => {
            const jobsWithoutFailedApply = currentJobs.filter(
              (currentJob) => currentJob.id !== jobToApply.id,
            )
            const insertAt = Math.min(
              activeIndexRef.current,
              jobsWithoutFailedApply.length,
            )

            return [
              ...jobsWithoutFailedApply.slice(0, insertAt),
              jobToApply,
              ...jobsWithoutFailedApply.slice(insertAt),
            ]
          })
        }

        setError(message)
      })

    return true
  }

  function handlePreviewApply() {
    return Promise.resolve(false)
  }

  function handlePreviewSkip() {
    return false
  }

  useEffect(() => {
    return () => {
      if (animationTimeout.current !== null) {
        window.clearTimeout(animationTimeout.current)
      }

      isCardActionPending.current = false
    }
  }, [])

  function getCardClassName() {
    if (!animationDirection) {
      return 'restaurant-card-current'
    }

    return `restaurant-card-current restaurant-card-exit-${animationDirection}`
  }

  if (isLoading) {
    return (
      <section className="restaurant-explore-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
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

      <div className="restaurant-card-stack">
        {nextJob && (
          <RestaurantSwipeCard
            className={`restaurant-card-next${
              isAnimating ? ' is-promoting' : ''
            }`}
            job={nextJob}
            isAnimating={isAnimating}
            isApplying={false}
            isPreview
            key={nextJob.id}
            language={language}
            onApply={handlePreviewApply}
            onSkip={handlePreviewSkip}
          />
        )}

        <RestaurantSwipeCard
          className={getCardClassName()}
          job={activeJob}
          isAnimating={isAnimating}
          isApplying={false}
          key={activeJob.id}
          language={language}
          onApply={handleApply}
          onSkip={handleSkip}
        />
      </div>
    </section>
  )
}

export default RestaurantExplorePage
