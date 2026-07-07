import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import RestaurantLanguageToggle from '../../restaurant/components/RestaurantLanguageToggle'
import {
  RESTAURANT_ROLES,
  getRestaurantRoleLabel,
} from '../../restaurant/types/restaurant'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
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

function OwnerJobsPage() {
  const { direction, language } = useRestaurantLanguage()
  const [profile, setProfile] = useState<OwnerProfile | null>(null)
  const [jobs, setJobs] = useState<OwnerJob[]>([])
  const [form, setForm] = useState<OwnerJobInput>(emptyJobForm)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const text = {
    title: language === 'he' ? 'המשרות שלי' : 'My jobs',
    subtitle:
      language === 'he'
        ? 'יוצרים טיוטה ומפעילים אותה כשהיא מוכנה.'
        : 'Create drafts, then activate them when they are ready.',
    loading:
      language === 'he'
        ? 'טוען משרות מסעדה...'
        : 'Loading restaurant jobs...',
    completeProfile:
      language === 'he'
        ? 'צריך להשלים פרופיל מסעדה'
        : 'Complete your restaurant profile',
    completeProfileHint:
      language === 'he'
        ? 'מלא שם מסעדה, עיר ורחוב לפני פרסום משרות.'
        : 'Complete your restaurant profile before posting jobs.',
    goToProfile:
      language === 'he' ? 'לפרופיל מסעדה' : 'Go to Restaurant profile',
    postingFor: language === 'he' ? 'מפרסמים עבור' : 'Posting for',
    newDrafts:
      language === 'he'
        ? 'משרות חדשות מתחילות כטיוטה.'
        : 'New jobs start as drafts.',
    editJob: language === 'he' ? 'עריכת משרה' : 'Edit job',
    createJob: language === 'he' ? 'יצירת משרה' : 'Create a job',
    draftHint:
      language === 'he'
        ? 'טיוטות נשארות מוסתרות עד שמפעילים אותן.'
        : 'Draft jobs stay hidden until you activate them.',
    cancelEdit: language === 'he' ? 'ביטול עריכה' : 'Cancel edit',
    role: language === 'he' ? 'תפקיד' : 'Role',
    shiftInfo: language === 'he' ? 'משמרות' : 'Shift info',
    contactPhone:
      language === 'he' ? 'טלפון ליצירת קשר' : 'Contact phone',
    contactWhatsapp:
      language === 'he' ? 'וואטסאפ ליצירת קשר' : 'Contact WhatsApp',
    requirements: language === 'he' ? 'דרישות' : 'Requirements',
    description: language === 'he' ? 'תיאור' : 'Description',
    saving: language === 'he' ? 'שומר...' : 'Saving...',
    saveChanges: language === 'he' ? 'שמירת שינויים' : 'Save changes',
    createDraft: language === 'he' ? 'יצירת טיוטה' : 'Create draft',
    postedJobs: language === 'he' ? 'משרות שפורסמו' : 'Posted jobs',
    noJobs: language === 'he' ? 'אין משרות עדיין.' : 'No jobs yet.',
    noJobsHint:
      language === 'he'
        ? 'צור את הטיוטה הראשונה בטופס למעלה.'
        : 'Create your first draft using the form above.',
    active: language === 'he' ? 'פעיל' : 'Active',
    draft: language === 'he' ? 'טיוטה' : 'Draft',
    locationNotSet:
      language === 'he' ? 'כתובת לא הוגדרה' : 'Location not set',
    edit: language === 'he' ? 'עריכה' : 'Edit',
    activate: language === 'he' ? 'הפעל משרה' : 'Activate',
    deactivate: language === 'he' ? 'כבה משרה' : 'Deactivate',
    delete: language === 'he' ? 'מחיקה' : 'Delete',
    updated: language === 'he' ? 'המשרה עודכנה.' : 'Job updated.',
    created:
      language === 'he' ? 'טיוטת משרה נוצרה.' : 'Draft job created.',
    activated: language === 'he' ? 'המשרה הופעלה.' : 'Job activated.',
    deactivated: language === 'he' ? 'המשרה כובתה.' : 'Job deactivated.',
    deleted: language === 'he' ? 'המשרה נמחקה.' : 'Job deleted.',
  }

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
        setSuccess(text.updated)
      } else {
        const createdJob = await createOwnerJob(form)
        setJobs((currentJobs) => [createdJob, ...currentJobs])
        setSuccess(text.created)
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
      setSuccess(updatedJob.isActive ? text.activated : text.deactivated)
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
    const roleLabel = getRestaurantRoleLabel(job.role, language)
    const shouldDelete = window.confirm(
      language === 'he'
        ? `למחוק את משרת ${roleLabel}?`
        : `Delete the ${roleLabel} job?`,
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

      setSuccess(text.deleted)
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
      <section className="owner-jobs-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
          <RestaurantLanguageToggle />
        </div>
        <p className="status-message">{text.loading}</p>
      </section>
    )
  }

  if (error && !profile) {
    return (
      <section className="owner-jobs-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
          <RestaurantLanguageToggle />
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
      <section className="owner-jobs-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
          <RestaurantLanguageToggle />
        </div>
        <div className="empty-state owner-profile-required">
          <h2>{text.completeProfile}</h2>
          <p>{text.completeProfileHint}</p>
          <Link to="/owner/profile">{text.goToProfile}</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="owner-jobs-page" dir={direction}>
      <div className="page-header">
        <div>
          <h1>{text.title}</h1>
          <p>
            {text.postingFor} {profile.restaurantName}. {text.newDrafts}
          </p>
        </div>
        <RestaurantLanguageToggle />
      </div>

      <form className="owner-job-form" onSubmit={handleSubmit}>
        <div className="owner-form-heading">
          <div>
            <h2>{editingJobId ? text.editJob : text.createJob}</h2>
            <p>{text.draftHint}</p>
          </div>
          {editingJobId && (
            <button
              className="owner-cancel-button"
              type="button"
              onClick={resetForm}
            >
              {text.cancelEdit}
            </button>
          )}
        </div>

        <label>
          {text.role}
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
                {getRestaurantRoleLabel(role.value, language)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {text.shiftInfo}
          <input
            value={form.shiftInfo}
            onChange={(event) =>
              updateField('shiftInfo', event.target.value)
            }
          />
        </label>

        <label>
          {text.contactPhone}
          <input
            type="tel"
            value={form.contactPhone}
            onChange={(event) =>
              updateField('contactPhone', event.target.value)
            }
          />
        </label>

        <label>
          {text.contactWhatsapp}
          <input
            type="tel"
            value={form.contactWhatsapp}
            onChange={(event) =>
              updateField('contactWhatsapp', event.target.value)
            }
          />
        </label>

        <label className="owner-field-wide">
          {text.requirements}
          <textarea
            rows={3}
            value={form.requirements}
            onChange={(event) =>
              updateField('requirements', event.target.value)
            }
          />
        </label>

        <label className="owner-field-wide">
          {text.description}
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
            ? text.saving
            : editingJobId
              ? text.saveChanges
              : text.createDraft}
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
          <h2>{text.postedJobs}</h2>
          <span>{jobs.length}</span>
        </div>

        {jobs.length === 0 ? (
          <div className="empty-state owner-jobs-empty">
            <h3>{text.noJobs}</h3>
            <p>{text.noJobsHint}</p>
          </div>
        ) : (
          <div className="owner-job-list">
            {jobs.map((job) => (
              <article className="owner-job-card" key={job.id}>
                <div className="owner-job-card-header">
                  <div>
                    <p>{job.restaurantName}</p>
                    <h3>{getRestaurantRoleLabel(job.role, language)}</h3>
                  </div>
                  <span
                    className={`owner-job-status ${
                      job.isActive ? 'active' : 'draft'
                    }`}
                  >
                    {job.isActive ? text.active : text.draft}
                  </span>
                </div>

                <p className="owner-job-meta">
                  {[job.city, job.street].filter(Boolean).join(' · ') ||
                    text.locationNotSet}
                </p>

                {job.shiftInfo && <p>{job.shiftInfo}</p>}

                <div className="owner-job-actions">
                  <button
                    type="button"
                    disabled={busyJobId === job.id}
                    onClick={() => startEditing(job)}
                  >
                    {text.edit}
                  </button>
                  <button
                    className="owner-active-button"
                    type="button"
                    disabled={busyJobId === job.id}
                    onClick={() => void handleActiveChange(job)}
                  >
                    {busyJobId === job.id
                      ? text.saving
                      : job.isActive
                        ? text.deactivate
                        : text.activate}
                  </button>
                  <button
                    className="owner-delete-button"
                    type="button"
                    disabled={busyJobId === job.id}
                    onClick={() => void handleDelete(job)}
                  >
                    {text.delete}
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
