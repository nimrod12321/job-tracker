import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getDiscoveryJobs,
  recordDiscoveryDecision,
} from '../services/discoveryApi'
import type {
  DiscoveryDecisionValue,
  DiscoveryJob,
} from '../types/discovery'

const PROFILE_REQUIRED_MESSAGE =
  'Upload your resume or complete your profile before using Discover.'

function getSalaryDisplay(job: DiscoveryJob) {
  const confirmedSalary = job.salaryText.trim()

  if (confirmedSalary && confirmedSalary !== 'Salary not listed') {
    return confirmedSalary
  }

  if (job.estimatedSalary.trim()) {
    return `${job.estimatedSalary} (estimated)`
  }

  return confirmedSalary || 'Salary not listed'
}

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

  async function handleDecision(decision: DiscoveryDecisionValue) {
    if (!activeJob || isRecording) {
      return
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
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to record discovery decision',
      )
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
          <button
            type="button"
            onClick={() => void loadJobs(excludeExternalIds)}
          >
            Find another batch
          </button>
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
        <span>
          {activeIndex + 1} of {jobs.length}
        </span>
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

      <article className="discover-card">
        <div className="discover-card-topline">
          <div>
            <p className="discover-company">{activeJob.company}</p>
            <h2>{activeJob.position}</h2>
          </div>
          <span className={`discover-priority ${activeJob.priority}`}>
            {activeJob.priority}
          </span>
        </div>

        <div className="discover-meta">
          <span>{activeJob.location || 'Location not listed'}</span>
          <span>{activeJob.source}</span>
        </div>

        <div className="discover-fit">
          <strong>{activeJob.fitScore}% fit</strong>
          <p>{activeJob.fitReason}</p>
        </div>

        <p className="discover-summary">{activeJob.summary}</p>

        <ul className="discover-key-details">
          {activeJob.keyDetails.slice(0, 4).map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>

        <div className="discover-salary">
          <span>Salary</span>
          <strong>{getSalaryDisplay(activeJob)}</strong>
        </div>

        {activeJob.concerns.length > 0 && (
          <div className="discover-concerns">
            <strong>
              {activeJob.concerns.length === 1 ? 'Concern' : 'Concerns'}
            </strong>
            <ul>
              {activeJob.concerns.map((concern) => (
                <li key={concern}>{concern}</li>
              ))}
            </ul>
          </div>
        )}

        {activeJob.jobDescription && (
          <details className="discover-details">
            <summary>More details</summary>
            <p>{activeJob.jobDescription}</p>
          </details>
        )}

        <div className="discover-actions">
          <button
            className="discover-dislike-button"
            type="button"
            disabled={isRecording}
            onClick={() => void handleDecision('disliked')}
          >
            {isRecording ? 'Saving...' : 'Dislike'}
          </button>

          {activeJob.jobUrl && (
            <a
              className="discover-open-link"
              href={activeJob.jobUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open job
            </a>
          )}

          <button
            className="discover-like-button"
            type="button"
            disabled={isRecording}
            onClick={() => void handleDecision('liked')}
          >
            {isRecording ? 'Saving...' : 'Like'}
          </button>
        </div>
      </article>
    </section>
  )
}

export default DiscoverPage
