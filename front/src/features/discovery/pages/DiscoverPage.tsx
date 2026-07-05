import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getDiscoveryJobs,
  recordDiscoveryDecision,
} from '../services/discoveryApi'
import SwipeJobCard from '../components/SwipeJobCard'
import type {
  DiscoveryDecisionValue,
  DiscoveryJob,
} from '../types/discovery'

const PROFILE_REQUIRED_MESSAGE =
  'Upload your resume or complete your profile before using Discover.'

function DiscoverPage() {
  const [jobs, setJobs] = useState<DiscoveryJob[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [excludeExternalIds, setExcludeExternalIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const loadJobs = useCallback(async (excludedIds: string[]) => {
    setIsLoading(true)
    setNeedsProfile(false)
    setError(null)
    setFeedback(null)

    try {
      const recommendations = await getDiscoveryJobs({
        limit: 10,
        excludeExternalIds: excludedIds,
      })

      setJobs(recommendations)
      setActiveIndex(0)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load discovery jobs'

      setJobs([])
      setActiveIndex(0)
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
        const recommendations = await getDiscoveryJobs({
          limit: 10,
          excludeExternalIds: [],
        })

        if (isActive) {
          setJobs(recommendations)
          setActiveIndex(0)
        }
      } catch (error) {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load discovery jobs'

        setJobs([])
        setActiveIndex(0)
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

  async function handleDecision(
    decision: DiscoveryDecisionValue,
  ): Promise<boolean> {
    if (!activeJob || isRecording) {
      return false
    }

    setIsRecording(true)
    setError(null)
    setFeedback(null)

    try {
      await recordDiscoveryDecision({
        externalId: activeJob.externalId,
        jobUrl: activeJob.jobUrl,
        company: activeJob.company,
        position: activeJob.position,
        location: activeJob.location,
        source: activeJob.source,
        jobDescription: activeJob.jobDescription,
        salaryText: activeJob.salaryText,
        estimatedSalary: activeJob.estimatedSalary,
        summary: activeJob.summary,
        fitScore: activeJob.fitScore,
        fitReason: activeJob.fitReason,
        decision,
      })

      setExcludeExternalIds((currentIds) =>
        currentIds.includes(activeJob.externalId)
          ? currentIds
          : [...currentIds, activeJob.externalId],
      )
      setFeedback(decision === 'liked' ? 'Liked' : 'Skipped')
      setActiveIndex((currentIndex) => currentIndex + 1)
      return true
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to record discovery decision',
      )
      return false
    } finally {
      setIsRecording(false)
    }
  }

  if (isLoading) {
    return (
      <section className="discover-page">
        <div className="page-header">
          <div>
            <h1>Discover</h1>
            <p>Personalized opportunities, selected from your profile.</p>
          </div>
        </div>
        <p className="status-message">Finding recommended jobs...</p>
      </section>
    )
  }

  if (needsProfile) {
    return (
      <section className="discover-page">
        <div className="page-header">
          <div>
            <h1>Discover</h1>
            <p>Personalized opportunities, selected from your profile.</p>
          </div>
        </div>
        <div className="empty-state discover-empty-state">
          <h2>Complete your profile first</h2>
          <p>{PROFILE_REQUIRED_MESSAGE}</p>
          <Link to="/profile">Go to Profile</Link>
        </div>
      </section>
    )
  }

  if (error && jobs.length === 0) {
    return (
      <section className="discover-page">
        <div className="page-header">
          <div>
            <h1>Discover</h1>
            <p>Personalized opportunities, selected from your profile.</p>
          </div>
        </div>
        <p className="message message-error" role="alert">
          {error}
        </p>
        <button
          className="discover-retry-button"
          type="button"
          onClick={() => void loadJobs(excludeExternalIds)}
        >
          Try again
        </button>
      </section>
    )
  }

  if (jobs.length === 0) {
    return (
      <section className="discover-page">
        <div className="page-header">
          <div>
            <h1>Discover</h1>
            <p>Personalized opportunities, selected from your profile.</p>
          </div>
        </div>
        <div className="empty-state discover-empty-state">
          <h2>No recommendations found right now.</h2>
          <p>Try again later after updating your profile.</p>
        </div>
      </section>
    )
  }

  if (!activeJob) {
    return (
      <section className="discover-page">
        <div className="page-header">
          <div>
            <h1>Discover</h1>
            <p>Personalized opportunities, selected from your profile.</p>
          </div>
        </div>
        <div className="empty-state discover-empty-state">
          <h2>You're done for now.</h2>
          <p>Review liked jobs soon or fetch another batch.</p>
          <div className="discover-end-actions">
            <Link to="/discover/liked">View liked jobs</Link>
            <button
              type="button"
              onClick={() => void loadJobs(excludeExternalIds)}
            >
              Find another batch
            </button>
          </div>
        </div>
        {feedback && (
          <p className="discover-feedback" aria-live="polite">
            {feedback}
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="discover-page">
      <div className="page-header discover-page-header">
        <div>
          <h1>Discover</h1>
          <p>This is the best next job Peepss found for you.</p>
        </div>
        <div className="discover-header-actions">
          <Link className="secondary-action-link" to="/discover/liked">
            View liked jobs
          </Link>
          <span>
            {activeIndex + 1} of {jobs.length}
          </span>
        </div>
      </div>

      {feedback && (
        <p className="discover-feedback" aria-live="polite">
          {feedback}
        </p>
      )}

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      <SwipeJobCard
        key={`${activeJob.source}-${activeJob.externalId}`}
        job={activeJob}
        isRecording={isRecording}
        onDecision={handleDecision}
      />
    </section>
  )
}

export default DiscoverPage
