import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type {
  ImportedJobDraft,
  Job,
} from '../../../types/job'
import JobForm from '../components/JobForm'
import {
  createJob,
  importJob,
} from '../services/jobsApi'

function ImportJobPage() {
  const navigate = useNavigate()
  const [jobDescription, setJobDescription] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [source, setSource] = useState('')
  const [draft, setDraft] = useState<ImportedJobDraft | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExtract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsExtracting(true)
    setError(null)

    try {
      const importedDraft = await importJob({
        jobDescription,
        jobUrl,
        source,
      })

      setDraft(importedDraft)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to extract job details',
      )
    } finally {
      setIsExtracting(false)
    }
  }

  async function handleSaveJob(job: Job) {
    setIsSaving(true)
    setError(null)

    try {
      const createdJob = await createJob({
        company: job.company,
        position: job.position,
        status: job.status,
        wantedSalary: job.wantedSalary,
        location: job.location,
        notes: job.notes,
        jobDescription: job.jobDescription,
        jobUrl: job.jobUrl,
        companyUrl: job.companyUrl,
        source: job.source,
        priority: job.priority,
        dateApplied: job.dateApplied,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
      })

      navigate(`/jobs/${createdJob.id}`)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to save job',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const reviewJob: Job | null = draft
    ? {
        ...draft,
        id: 'import-draft',
        createdAt: '',
        updatedAt: '',
      }
    : null

  return (
    <section className="job-import-page">
      <Link className="back-link" to="/jobs">
        ← Back to jobs
      </Link>

      <div className="page-header">
        <div>
          <h1>Import job</h1>
          <p>Paste a job description, review the details, then save it.</p>
        </div>
      </div>

      {error && <p className="job-import-error">{error}</p>}

      {!reviewJob ? (
        <form className="job-import-paste-form" onSubmit={handleExtract}>
          <h2>Paste job details</h2>
          <label>
            Job description
            <textarea
              rows={14}
              value={jobDescription}
              onChange={(event) =>
                setJobDescription(event.target.value)
              }
              required
            />
          </label>
          <label>
            Job URL <span>Optional</span>
            <input
              type="url"
              value={jobUrl}
              onChange={(event) => setJobUrl(event.target.value)}
            />
          </label>
          <label>
            Source <span>Optional</span>
            <input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="LinkedIn, company website..."
            />
          </label>
          <button type="submit" disabled={isExtracting}>
            {isExtracting ? 'Extracting...' : 'Extract job details'}
          </button>
        </form>
      ) : (
        <div className="job-import-review">
          <p>
            Review and edit every field before saving. Empty required fields
            must be completed.
          </p>
          <JobForm
            initialJob={reviewJob}
            onSaveJob={(job) => void handleSaveJob(job)}
            heading="Review imported job"
            submitLabel={isSaving ? 'Saving...' : 'Save job'}
          />
        </div>
      )}
    </section>
  )
}

export default ImportJobPage
