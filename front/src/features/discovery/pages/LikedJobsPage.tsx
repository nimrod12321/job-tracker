import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Job } from '../../../types/job'
import { createJob, getJobs } from '../../jobs/services/jobsApi'
import {
  getLikedDiscoveryJobs,
  recordDiscoveryDecision,
} from '../services/discoveryApi'
import type {
  DiscoveryDecision,
  DiscoveryDecisionInput,
} from '../types/discovery'

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function getTrackedJob(
  likedJob: DiscoveryDecision,
  trackedJobs: Job[],
) {
  return trackedJobs.find((trackedJob) => {
    const hasMatchingUrl = Boolean(
      likedJob.jobUrl &&
        trackedJob.jobUrl &&
        likedJob.jobUrl === trackedJob.jobUrl,
    )
    const hasMatchingCompanyAndPosition =
      normalize(likedJob.company) === normalize(trackedJob.company) &&
      normalize(likedJob.position) === normalize(trackedJob.position)

    return hasMatchingUrl || hasMatchingCompanyAndPosition
  })
}

function getSalaryDisplay(job: DiscoveryDecision) {
  const confirmedSalary = job.salaryText.trim()

  if (confirmedSalary && confirmedSalary !== 'Salary not listed') {
    return confirmedSalary
  }

  if (job.estimatedSalary.trim()) {
    return `${job.estimatedSalary} (estimated)`
  }

  return confirmedSalary || 'Salary not listed'
}

function getDecisionInput(
  job: DiscoveryDecision,
  decision: DiscoveryDecisionInput['decision'],
): DiscoveryDecisionInput {
  return {
    externalId: job.externalId,
    jobUrl: job.jobUrl,
    company: job.company,
    position: job.position,
    location: job.location,
    source: job.source,
    jobDescription: job.jobDescription,
    salaryText: job.salaryText,
    estimatedSalary: job.estimatedSalary,
    summary: job.summary,
    fitScore: job.fitScore,
    fitReason: job.fitReason,
    decision,
  }
}

function getTrackerNotes(job: DiscoveryDecision) {
  return [
    job.summary ? `Discovery summary: ${job.summary}` : '',
    job.fitReason
      ? `Discovery fit (${job.fitScore}%): ${job.fitReason}`
      : '',
    job.source ? `Source: ${job.source}` : '',
    job.estimatedSalary
      ? `Estimated salary (not confirmed): ${job.estimatedSalary}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function LikedJobsPage() {
  const [likedJobs, setLikedJobs] = useState<DiscoveryDecision[]>([])
  const [trackedJobs, setTrackedJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<{
    jobId: string
    action: 'save' | 'remove'
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadLikedJobs() {
      try {
        const [loadedLikedJobs, loadedTrackedJobs] = await Promise.all([
          getLikedDiscoveryJobs(),
          getJobs(),
        ])

        if (isActive) {
          setLikedJobs(loadedLikedJobs)
          setTrackedJobs(loadedTrackedJobs)
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error
              ? error.message
              : 'Failed to load liked jobs',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadLikedJobs()

    return () => {
      isActive = false
    }
  }, [])

  async function handleSave(job: DiscoveryDecision) {
    if (pendingAction || getTrackedJob(job, trackedJobs)) {
      return
    }

    setPendingAction({
      jobId: job.id,
      action: 'save',
    })
    setError(null)
    setSuccessMessage(null)

    try {
      const createdJob = await createJob({
        company: job.company,
        position: job.position,
        status: 'applied',
        wantedSalary: 0,
        location: job.location || 'Not specified',
        notes: getTrackerNotes(job),
        jobDescription: job.jobDescription,
        jobUrl: job.jobUrl,
        companyUrl: '',
        source: job.source,
        priority: 'medium',
        dateApplied: '',
        salaryMin: 0,
        salaryMax: 0,
      })

      setTrackedJobs((currentJobs) => [createdJob, ...currentJobs])
      setSuccessMessage(`${job.position} saved to your tracker.`)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to save job to tracker',
      )
    } finally {
      setPendingAction(null)
    }
  }

  async function handleRemove(job: DiscoveryDecision) {
    if (pendingAction) {
      return
    }

    setPendingAction({
      jobId: job.id,
      action: 'remove',
    })
    setError(null)
    setSuccessMessage(null)

    try {
      await recordDiscoveryDecision(
        getDecisionInput(job, 'disliked'),
      )
      setLikedJobs((currentJobs) =>
        currentJobs.filter((currentJob) => currentJob.id !== job.id),
      )
      setSuccessMessage(`${job.position} removed from liked jobs.`)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to remove liked job',
      )
    } finally {
      setPendingAction(null)
    }
  }

  if (isLoading) {
    return (
      <section className="liked-jobs-page">
        <div className="page-header">
          <div>
            <h1>Liked jobs</h1>
            <p>Review opportunities before adding them to your tracker.</p>
          </div>
        </div>
        <p className="status-message">Loading liked jobs...</p>
      </section>
    )
  }

  const allJobsSaved =
    likedJobs.length > 0 &&
    likedJobs.every((job) => getTrackedJob(job, trackedJobs))

  return (
    <section className="liked-jobs-page">
      <div className="page-header">
        <div>
          <h1>Liked jobs</h1>
          <p>Review opportunities before adding them to your tracker.</p>
        </div>
        <Link className="secondary-action-link" to="/discover">
          Back to Discover
        </Link>
      </div>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      {successMessage && (
        <p className="message message-success" aria-live="polite">
          {successMessage}
        </p>
      )}

      {likedJobs.length === 0 ? (
        <div className="empty-state liked-jobs-empty">
          <h2>No liked jobs yet.</h2>
          <p>Go to Discover and like jobs you want to review later.</p>
          <Link to="/discover">Go to Discover</Link>
        </div>
      ) : (
        <>
          {allJobsSaved && (
            <p className="message message-success">
              All liked jobs are already saved.
            </p>
          )}

          <div className="liked-jobs-grid">
            {likedJobs.map((job) => {
              const trackedJob = getTrackedJob(job, trackedJobs)
              const isSaving =
                pendingAction?.jobId === job.id &&
                pendingAction.action === 'save'
              const isRemoving =
                pendingAction?.jobId === job.id &&
                pendingAction.action === 'remove'

              return (
                <article className="liked-job-card" key={job.id}>
                  <div className="liked-job-card-header">
                    <div>
                      <p>{job.company}</p>
                      <h2>{job.position}</h2>
                    </div>
                    {trackedJob && (
                      <span className="liked-job-saved-badge">
                        Saved to tracker
                      </span>
                    )}
                  </div>

                  <div className="liked-job-meta">
                    <span>{job.location || 'Location not listed'}</span>
                    <span>{job.source}</span>
                  </div>

                  <div className="liked-job-fit">
                    <strong>{job.fitScore}% fit</strong>
                    <p>{job.fitReason || 'No fit reason available.'}</p>
                  </div>

                  {job.summary && (
                    <p className="liked-job-summary">{job.summary}</p>
                  )}

                  <ul className="liked-job-details">
                    <li>Company: {job.company}</li>
                    <li>Location: {job.location || 'Not listed'}</li>
                    <li>Source: {job.source}</li>
                  </ul>

                  <div className="liked-job-salary">
                    <span>Salary</span>
                    <strong>{getSalaryDisplay(job)}</strong>
                  </div>

                  {job.jobDescription && (
                    <details className="liked-job-more">
                      <summary>More details</summary>
                      <p>{job.jobDescription}</p>
                    </details>
                  )}

                  <div className="liked-job-actions">
                    {job.jobUrl && (
                      <a
                        href={job.jobUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open job
                      </a>
                    )}

                    {trackedJob ? (
                      <Link to={`/jobs/${trackedJob.id}`}>
                        View saved job
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(pendingAction)}
                        onClick={() => void handleSave(job)}
                      >
                        {isSaving ? 'Saving...' : 'Save to tracker'}
                      </button>
                    )}

                    <button
                      className="liked-job-remove-button"
                      type="button"
                      disabled={Boolean(pendingAction)}
                      onClick={() => void handleRemove(job)}
                    >
                      {isRemoving ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

export default LikedJobsPage
