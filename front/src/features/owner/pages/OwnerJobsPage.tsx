import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { RESTAURANT_ROLES } from '../../restaurant/types/restaurant'
import {
  createOwnerJob,
  deleteOwnerJob,
  getOwnerJobs,
  getOwnerProfile,
  setOwnerJobActive,
  updateOwnerJob,
} from '../services/ownerApi'
import type {
  OwnerJob,
  OwnerJobInput,
  OwnerProfile,
} from '../types/owner'

const emptyJobForm: OwnerJobInput = {
  role: 'waiter',
  description: '',
  requirements: '',
  shiftInfo: '',
  contactPhone: '',
  contactWhatsapp: '',
}

function getRoleLabel(role: OwnerJob['role']) {
  return (
    RESTAURANT_ROLES.find((option) => option.value === role)?.label ?? role
  )
}

function OwnerJobsPage() {
  const [profile, setProfile] = useState<OwnerProfile | null>(null)
  const [jobs, setJobs] = useState<OwnerJob[]>([])
  const [form, setForm] = useState<OwnerJobInput>(emptyJobForm)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadOwnerData() {
      try {
        const [ownerProfile, ownerJobs] = await Promise.all([
          getOwnerProfile(),
          getOwnerJobs(),
        ])

        if (isActive) {
          setProfile(ownerProfile)
          setJobs(ownerJobs)
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error
              ? error.message
              : 'Failed to load restaurant jobs',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadOwnerData()

    return () => {
      isActive = false
    }
  }, [])

  function updateField<K extends keyof OwnerJobInput>(
    field: K,
    value: OwnerJobInput[K],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function resetForm() {
    setForm(emptyJobForm)
    setEditingJobId(null)
  }

  function startEditing(job: OwnerJob) {
    setForm({
      role: job.role,
      description: job.description,
      requirements: job.requirements,
      shiftInfo: job.shiftInfo,
      contactPhone: job.contactPhone,
      contactWhatsapp: job.contactWhatsapp,
    })
    setEditingJobId(job.id)
    setError(null)
    setSuccess(null)
  }

  function replaceJob(updatedJob: OwnerJob) {
    setJobs((currentJobs) =>
      currentJobs.map((job) =>
        job.id === updatedJob.id ? updatedJob : job,
      ),
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      if (editingJobId) {
        const updatedJob = await updateOwnerJob(editingJobId, form)
        replaceJob(updatedJob)
        setSuccess('Job updated.')
      } else {
        const createdJob = await createOwnerJob(form)
        setJobs((currentJobs) => [createdJob, ...currentJobs])
        setSuccess('Draft job created.')
      }

      resetForm()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to save restaurant job',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleActiveChange(job: OwnerJob) {
    setBusyJobId(job.id)
    setError(null)
    setSuccess(null)

    try {
      const updatedJob = await setOwnerJobActive(job.id, !job.isActive)
      replaceJob(updatedJob)
      setSuccess(updatedJob.isActive ? 'Job activated.' : 'Job deactivated.')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update job visibility',
      )
    } finally {
      setBusyJobId(null)
    }
  }

  async function handleDelete(job: OwnerJob) {
    const shouldDelete = window.confirm(
      `Delete the ${getRoleLabel(job.role)} job?`,
    )

    if (!shouldDelete) {
      return
    }

    setBusyJobId(job.id)
    setError(null)
    setSuccess(null)

    try {
      await deleteOwnerJob(job.id)
      setJobs((currentJobs) =>
        currentJobs.filter((currentJob) => currentJob.id !== job.id),
      )

      if (editingJobId === job.id) {
        resetForm()
      }

      setSuccess('Job deleted.')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to delete restaurant job',
      )
    } finally {
      setBusyJobId(null)
    }
  }

  if (isLoading) {
    return (
      <section className="owner-jobs-page">
        <div className="page-header">
          <div>
            <h1>My jobs</h1>
            <p>Create drafts, then activate them when they are ready.</p>
          </div>
        </div>
        <p className="status-message">Loading restaurant jobs...</p>
      </section>
    )
  }

  if (error && !profile) {
    return (
      <section className="owner-jobs-page">
        <div className="page-header">
          <div>
            <h1>My jobs</h1>
            <p>Create drafts, then activate them when they are ready.</p>
          </div>
        </div>
        <p className="message message-error" role="alert">
          {error}
        </p>
      </section>
    )
  }

  if (
    !profile?.restaurantName.trim() ||
    !profile.city.trim() ||
    !profile.street.trim()
  ) {
    return (
      <section className="owner-jobs-page">
        <div className="page-header">
          <div>
            <h1>My jobs</h1>
            <p>Create drafts, then activate them when they are ready.</p>
          </div>
        </div>
        <div className="empty-state owner-profile-required">
          <h2>Complete your restaurant profile</h2>
          <p>Complete your restaurant profile before posting jobs.</p>
          <Link to="/owner/profile">Go to Restaurant profile</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="owner-jobs-page">
      <div className="page-header">
        <div>
          <h1>My jobs</h1>
          <p>
            Posting for {profile.restaurantName}. New jobs start as drafts.
          </p>
        </div>
      </div>

      <form className="owner-job-form" onSubmit={handleSubmit}>
        <div className="owner-form-heading">
          <div>
            <h2>{editingJobId ? 'Edit job' : 'Create a job'}</h2>
            <p>Draft jobs stay hidden until you activate them.</p>
          </div>
          {editingJobId && (
            <button
              className="owner-cancel-button"
              type="button"
              onClick={resetForm}
            >
              Cancel edit
            </button>
          )}
        </div>

        <label>
          Role
          <select
            value={form.role}
            onChange={(event) =>
              updateField(
                'role',
                event.target.value as OwnerJobInput['role'],
              )
            }
          >
            {RESTAURANT_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Shift info
          <input
            value={form.shiftInfo}
            onChange={(event) =>
              updateField('shiftInfo', event.target.value)
            }
          />
        </label>

        <label>
          Contact phone
          <input
            type="tel"
            value={form.contactPhone}
            onChange={(event) =>
              updateField('contactPhone', event.target.value)
            }
          />
        </label>

        <label>
          Contact WhatsApp
          <input
            type="tel"
            value={form.contactWhatsapp}
            onChange={(event) =>
              updateField('contactWhatsapp', event.target.value)
            }
          />
        </label>

        <label className="owner-field-wide">
          Requirements
          <textarea
            rows={3}
            value={form.requirements}
            onChange={(event) =>
              updateField('requirements', event.target.value)
            }
          />
        </label>

        <label className="owner-field-wide">
          Description
          <textarea
            rows={4}
            value={form.description}
            onChange={(event) =>
              updateField('description', event.target.value)
            }
          />
        </label>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving...'
            : editingJobId
              ? 'Save changes'
              : 'Create draft'}
        </button>
      </form>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="message message-success" aria-live="polite">
          {success}
        </p>
      )}

      <section className="owner-job-list-section">
        <div className="owner-list-heading">
          <h2>Posted jobs</h2>
          <span>{jobs.length}</span>
        </div>

        {jobs.length === 0 ? (
          <div className="empty-state owner-jobs-empty">
            <h3>No jobs yet.</h3>
            <p>Create your first draft using the form above.</p>
          </div>
        ) : (
          <div className="owner-job-list">
            {jobs.map((job) => (
              <article className="owner-job-card" key={job.id}>
                <div className="owner-job-card-header">
                  <div>
                    <p>{job.restaurantName}</p>
                    <h3>{getRoleLabel(job.role)}</h3>
                  </div>
                  <span
                    className={`owner-job-status ${
                      job.isActive ? 'active' : 'draft'
                    }`}
                  >
                    {job.isActive ? 'Active' : 'Draft'}
                  </span>
                </div>

                <p className="owner-job-meta">
                  {[job.city, job.street].filter(Boolean).join(' · ') ||
                    'Location not set'}
                </p>

                {job.shiftInfo && <p>{job.shiftInfo}</p>}

                <div className="owner-job-actions">
                  <button
                    type="button"
                    disabled={busyJobId === job.id}
                    onClick={() => startEditing(job)}
                  >
                    Edit
                  </button>
                  <button
                    className="owner-active-button"
                    type="button"
                    disabled={busyJobId === job.id}
                    onClick={() => void handleActiveChange(job)}
                  >
                    {busyJobId === job.id
                      ? 'Saving...'
                      : job.isActive
                        ? 'Deactivate'
                        : 'Activate'}
                  </button>
                  <button
                    className="owner-delete-button"
                    type="button"
                    disabled={busyJobId === job.id}
                    onClick={() => void handleDelete(job)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default OwnerJobsPage
