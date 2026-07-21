import { useState, type FormEvent } from 'react'
import type {
  ExternalJobDraft,
  Job,
} from '../../../types/job'
import {
  createJob,
  fetchExternalJobs,
} from '../services/jobsApi'

type ExternalJobsPanelProps = {
  jobs: Job[]
  onJobSaved: (job: Job) => void
}

function ExternalJobsPanel({
  jobs,
  onJobSaved,
}: ExternalJobsPanelProps) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [limit, setLimit] = useState(5)
  const [drafts, setDrafts] = useState<ExternalJobDraft[]>([])
  const [hasFetched, setHasFetched] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [savingIds, setSavingIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [savedExternalIds, setSavedExternalIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function handleFetch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsFetching(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const results = await fetchExternalJobs({
        query,
        location,
        limit,
      })

      setDrafts(results)
      setHasFetched(true)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to fetch external jobs',
      )
    } finally {
      setIsFetching(false)
    }
  }

  function isAlreadySaved(draft: ExternalJobDraft) {
    if (savedExternalIds.has(draft.externalId)) {
      return true
    }

    return Boolean(
      draft.jobUrl &&
        jobs.some((savedJob) => savedJob.jobUrl === draft.jobUrl),
    )
  }

  async function handleSave(draft: ExternalJobDraft) {
    setError(null)
    setSuccessMessage(null)
    setSavingIds((currentIds) => new Set(currentIds).add(draft.externalId))

    try {
      const createdJob = await createJob({
        company: draft.company,
        position: draft.position,
        status: 'applied',
        wantedSalary: draft.wantedSalary,
        location: draft.location || 'Not specified',
        notes: draft.notes,
        jobDescription: draft.jobDescription,
        jobUrl: draft.jobUrl,
        companyUrl: draft.companyUrl,
        source: draft.source,
        priority: draft.priority,
        dateApplied: '',
        salaryMin: draft.salaryMin,
        salaryMax: draft.salaryMax,
      })

      onJobSaved(createdJob)
      setSavedExternalIds((currentIds) =>
        new Set(currentIds).add(draft.externalId),
      )
      setSuccessMessage(`${draft.position} saved successfully.`)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to save job',
      )
    } finally {
      setSavingIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.delete(draft.externalId)
        return nextIds
      })
    }
  }

  return (
    <section className="external-jobs-panel job-browser">
      <div className="job-browser-topbar" aria-hidden="true">
        <div className="job-browser-dots">
          <span />
          <span />
          <span />
        </div>
        <div className="job-browser-tabs">
          <span className="job-browser-tab active">Search</span>
          <span className="job-browser-tab">Matches</span>
          <span className="job-browser-tab">Saved</span>
        </div>
      </div>

      <div className="job-browser-body">
        <div className="external-jobs-heading">
          <div>
            <h2>Find jobs</h2>
            <p>
              Leave search empty to use your profile target role and skills.
            </p>
          </div>
          <span>Arbeitnow + Greenhouse</span>
        </div>

        <form
          className="external-jobs-form job-browser-controls"
          onSubmit={handleFetch}
        >
          <label className="job-browser-address">
            <span className="sr-only">Search query</span>
            <svg
              className="job-browser-search-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M10.5 18a7.5 7.5 0 1 1 5.3-12.8 7.5 7.5 0 0 1-5.3 12.8Zm8.5 1-3.8-3.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search roles or skills"
            />
          </label>
          <label className="job-browser-field">
            Location
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Berlin"
            />
          </label>
          <label className="job-browser-field">
            Results
            <input
              type="number"
              min={1}
              max={10}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
            />
          </label>
          <button
            className="ui-button ui-button--primary"
            type="submit"
            disabled={isFetching}
          >
            {isFetching ? 'Finding and ranking jobs...' : 'Find jobs'}
          </button>
        </form>

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

        {hasFetched && drafts.length === 0 && (
          <div className="empty-state empty-state-compact">
            <h3>No relevant jobs found.</h3>
            <p>Try a broader search query or location.</p>
          </div>
        )}

        {drafts.length > 0 && (
          <div className="external-jobs-results">
            <h3>Fetched job drafts</h3>
            <div className="external-jobs-list">
              {drafts.map((draft) => {
                const alreadySaved = isAlreadySaved(draft)
                const isSaving = savingIds.has(draft.externalId)

                return (
                  <article
                    className="external-job-card"
                    key={draft.externalId}
                  >
                    <div className="external-job-card-header">
                      <div>
                        <p>{draft.company}</p>
                        <h4>{draft.position}</h4>
                      </div>
                      <strong className="relevance-badge">
                        {draft.aiScore !== undefined
                          ? `AI match: ${draft.aiScore}%`
                          : `${draft.relevanceScore}% match`}
                      </strong>
                    </div>

                    <div className="external-job-meta">
                      <span>
                        {draft.location || 'Location not provided'}
                      </span>
                      <span>{draft.source}</span>
                    </div>

                    <p className="external-job-reason">
                      {draft.aiReason ?? draft.relevanceReason}
                    </p>
                    <p className="external-job-description">
                      {draft.jobDescription || 'No description provided.'}
                    </p>

                    <div className="external-job-actions">
                      {draft.jobUrl && (
                        <a
                          href={draft.jobUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View external job
                        </a>
                      )}
                      <button
                        className="ui-button ui-button--primary"
                        type="button"
                        disabled={alreadySaved || isSaving}
                        onClick={() => void handleSave(draft)}
                      >
                        {alreadySaved
                          ? 'Already saved'
                          : isSaving
                            ? 'Saving...'
                            : 'Save job'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default ExternalJobsPanel
