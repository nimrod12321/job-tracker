import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { JobDetail } from '../../../types/job'
import { analyzeJob, getJobById } from '../services/jobsApi'

function displayValue(value: string | number) {
  return value === '' || value === 0 ? 'Not provided' : value
}

function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const [job, setJob] = useState<JobDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

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

  async function handleAnalyze() {
    if (!job) {
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)

    try {
      const analysis = await analyzeJob(job.id)
      setJob((currentJob) =>
        currentJob ? { ...currentJob, analysis } : currentJob,
      )
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : 'Failed to analyze job',
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

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

      <section className="job-analysis-section">
        <div className="job-analysis-header">
          <div>
            <p className="job-analysis-label">AI career assistant</p>
            <h2>Match analysis</h2>
          </div>
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={isAnalyzing}
          >
            {isAnalyzing
              ? 'Analyzing...'
              : job.analysis
                ? 'Analyze again'
                : 'Analyze match'}
          </button>
        </div>

        {analysisError && (
          <p className="job-detail-error">{analysisError}</p>
        )}

        {job.analysis ? (
          <>
            <div className="job-analysis-score">
              <strong>{job.analysis.matchScore}</strong>
              <span>out of 100 match score</span>
            </div>

            <div className="job-analysis-grid">
              <article>
                <h3>Fit summary</h3>
                <p>{job.analysis.fitSummary}</p>
              </article>
              <article>
                <h3>Strengths</h3>
                <p>{job.analysis.strengths}</p>
              </article>
              <article>
                <h3>Missing skills</h3>
                <p>{job.analysis.missingSkills}</p>
              </article>
              <article>
                <h3>Resume suggestions</h3>
                <p>{job.analysis.resumeSuggestions}</p>
              </article>
              <article>
                <h3>Interview questions</h3>
                <p>{job.analysis.interviewQuestions}</p>
              </article>
              <article>
                <h3>Recruiter message</h3>
                <p>{job.analysis.recruiterMessage}</p>
              </article>
            </div>
          </>
        ) : (
          <p className="job-analysis-empty">
            No analysis yet. Add a resume profile and job description, then
            analyze this match.
          </p>
        )}
      </section>
    </section>
  )
}

export default JobDetailPage
