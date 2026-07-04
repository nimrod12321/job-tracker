import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Job } from '../../../types/job'
import { getJobById } from '../services/jobsApi'

function displayValue(value: string | number) {
  return value === '' || value === 0 ? 'Not provided' : value
}

function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadJob() {
      if (!jobId) {
        return
      }

      try {
        const loadedJob = await getJobById(jobId)

        if (isActive) {
          setJob(loadedJob)
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error ? error.message : 'Failed to load job',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadJob()

    return () => {
      isActive = false
    }
  }, [jobId])

  if (!jobId) {
    return (
      <section className="job-detail-page">
        <Link className="back-link" to="/jobs">
          ← Back to jobs
        </Link>
        <p className="job-detail-error">Job ID is missing.</p>
      </section>
    )
  }

  if (isLoading) {
    return <p>Loading job...</p>
  }

  if (error || !job) {
    return (
      <section className="job-detail-page">
        <Link className="back-link" to="/jobs">
          ← Back to jobs
        </Link>
        <p className="job-detail-error">{error ?? 'Job not found.'}</p>
      </section>
    )
  }

  return (
    <section className="job-detail-page">
      <Link className="back-link" to="/jobs">
        ← Back to jobs
      </Link>

      <div className="job-detail-header">
        <div>
          <p className="job-detail-company">{job.company}</p>
          <h1>{job.position}</h1>
        </div>
        <span className="job-detail-status">{job.status}</span>
      </div>

      <dl className="job-detail-grid">
        <div>
          <dt>Location</dt>
          <dd>{displayValue(job.location)}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd className="job-detail-priority">{job.priority}</dd>
        </div>
        <div>
          <dt>Wanted salary</dt>
          <dd>{displayValue(job.wantedSalary)}</dd>
        </div>
        <div>
          <dt>Salary minimum</dt>
          <dd>{displayValue(job.salaryMin)}</dd>
        </div>
        <div>
          <dt>Salary maximum</dt>
          <dd>{displayValue(job.salaryMax)}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{displayValue(job.source)}</dd>
        </div>
        <div>
          <dt>Date applied</dt>
          <dd>{displayValue(job.dateApplied)}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{job.createdAt}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{job.updatedAt}</dd>
        </div>
      </dl>

      <div className="job-detail-links">
        <div>
          <h2>Job posting</h2>
          {job.jobUrl ? (
            <a href={job.jobUrl} target="_blank" rel="noreferrer">
              Open job posting
            </a>
          ) : (
            <p>Not provided</p>
          )}
        </div>
        <div>
          <h2>Company website</h2>
          {job.companyUrl ? (
            <a href={job.companyUrl} target="_blank" rel="noreferrer">
              Open company website
            </a>
          ) : (
            <p>Not provided</p>
          )}
        </div>
      </div>

      <section className="job-detail-section">
        <h2>Notes</h2>
        <p>{job.notes || 'No notes provided.'}</p>
      </section>

      <section className="job-detail-section">
        <h2>Job description</h2>
        <p className="job-description">
          {job.jobDescription || 'No job description provided.'}
        </p>
      </section>
    </section>
  )
}

export default JobDetailPage
