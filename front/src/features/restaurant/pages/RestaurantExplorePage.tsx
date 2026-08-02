import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import PeepssLogo from '../../../components/brand/PeepssLogo'
import {
  applyToRestaurantJob,
  getRestaurantExploreJobs,
} from '../services/restaurantApi'
import RestaurantSwipeCard from '../components/RestaurantSwipeCard'
import type { RestaurantExploreJob } from '../types/restaurant'
import { useRestaurantLanguage } from '../utils/restaurantLanguage'

const PROFILE_REQUIRED_MESSAGE =
  'Complete your worker profile to start seeing restaurant jobs.'
const CARD_ANIMATION_MS = 260

type CardAnimationDirection = 'left' | 'right'

function RestaurantExplorePage() {
  const { direction, language } = useRestaurantLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusJobId = searchParams.get('jobId') || undefined
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
        : 'Complete your worker profile',
    completeProfileMessage:
      language === 'he'
        ? 'השלימו פרופיל קצר כדי להתחיל לראות משרות במסעדות.'
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
    exitSwipe: language === 'he' ? 'יציאה מהחלקה' : 'Exit swipe',
  }

  const handleExitSwipe = useCallback(() => {
    const routeState = location.state as
      | { swipeReturnTo?: unknown }
      | null
    const returnTo = routeState?.swipeReturnTo

    if (
      typeof returnTo === 'string' &&
      returnTo.startsWith('/restaurant/') &&
      returnTo !== location.pathname
    ) {
      navigate(returnTo)
      return
    }

    navigate('/restaurant/matches', { replace: true })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    const body = document.body
    const root = document.documentElement
    const previousBodyOverflow = body.style.overflow
    const previousBodyOverscroll = body.style.overscrollBehavior
    const previousRootOverflow = root.style.overflow
    const previousRootOverscroll = root.style.overscrollBehavior

    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleExitSwipe()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      body.style.overflow = previousBodyOverflow
      body.style.overscrollBehavior = previousBodyOverscroll
      root.style.overflow = previousRootOverflow
      root.style.overscrollBehavior = previousRootOverscroll
    }
  }, [handleExitSwipe])

  const loadJobs = useCallback(async (excludedIds: string[]) => {
    setIsLoading(true)
    setNeedsProfile(false)
    setError(null)
    setFeedback(null)

    try {
      const nextJobs = await getRestaurantExploreJobs({
        limit: 10,
        excludeJobIds: excludedIds,
        focusJobId,
      })

      setJobs(nextJobs)
      setActiveIndex(0)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load restaurant jobs'

      setJobs([])
      if (message === PROFILE_REQUIRED_MESSAGE) {
        navigate('/restaurant/profile', { replace: true })
        return
      }

      setNeedsProfile(false)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [focusJobId, navigate])

  useEffect(() => {
    let isActive = true

    async function loadInitialJobs() {
      try {
        const initialJobs = await getRestaurantExploreJobs({
          limit: 10,
          excludeJobIds: [],
          focusJobId,
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
        if (message === PROFILE_REQUIRED_MESSAGE) {
          navigate('/restaurant/profile', { replace: true })
          return
        }

        setNeedsProfile(false)
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
  }, [focusJobId, navigate])

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
    setFeedback(null)
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

  function renderSwipePage(content: ReactNode) {
    return (
      <section className="restaurant-explore-page swipe-immersive-page" dir={direction}>
        <header className="swipe-immersive-topbar">
          <PeepssLogo className="swipe-immersive-logo" />
          <button
            type="button"
            className="swipe-immersive-exit peepss-close-button"
            aria-label={text.exitSwipe}
            onClick={handleExitSwipe}
          >
            ×
          </button>
        </header>
        <div className="swipe-immersive-content">{content}</div>
        <p className="swipe-action-announcer" aria-live="polite">
          {feedback || ''}
        </p>
      </section>
    )
  }

  if (isLoading) {
    return renderSwipePage(
      <div className="swipe-immersive-state">
        <p className="status-message">{text.loading}</p>
      </div>,
    )
  }

  if (needsProfile) {
    return renderSwipePage(
      <div className="swipe-immersive-state">
        <div className="empty-state restaurant-empty-state">
          <h2>{text.completeProfile}</h2>
          <p>{text.completeProfileMessage}</p>
          <Link
            className="ui-button ui-button--primary"
            to="/restaurant/profile"
          >
            {text.goToProfile}
          </Link>
        </div>
      </div>,
    )
  }

  if (error && jobs.length === 0) {
    return renderSwipePage(
      <div className="swipe-immersive-state">
        <p className="message message-error" role="alert">
          {error}
        </p>
        <button
          className="restaurant-retry-button ui-button ui-button--primary"
          type="button"
          onClick={() => void loadJobs(excludeJobIds)}
        >
          {text.tryAgain}
        </button>
      </div>,
    )
  }

  if (!activeJob) {
    return renderSwipePage(
      <div className="swipe-immersive-state">
        <div className="empty-state restaurant-empty-state">
          <h2>{text.noMore}</h2>
          <p>{text.noMoreHint}</p>
          <div className="restaurant-empty-actions">
            <Link
              className="ui-button ui-button--secondary"
              to="/restaurant/profile"
            >
              {text.updateProfile}
            </Link>
            <button
              className="ui-button ui-button--primary"
              type="button"
              onClick={() => void loadJobs(excludeJobIds)}
            >
              {text.findMore}
            </button>
          </div>
        </div>
      </div>,
    )
  }

  return renderSwipePage(
    <>
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
    </>,
  )
}

export default RestaurantExplorePage
