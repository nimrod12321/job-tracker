import { useEffect, useRef, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { Link } from 'react-router-dom'
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

const shiftOptions = [
  { he: 'בוקר', en: 'Morning' },
  { he: 'ערב', en: 'Evening' },
  { he: 'סופי שבוע', en: 'Weekends' },
  { he: 'גמיש', en: 'Flexible' },
]

function getStoredQrExpanded(slug: string | null | undefined) {
  if (!slug) {
    return false
  }

  const storageKey = `peepss_owner_qr_collapsed_${slug}`
  const storedValue = localStorage.getItem(storageKey)

  return storedValue === null ? true : storedValue !== 'true'
}

function OwnerJobsPage() {
  const { direction, language } = useRestaurantLanguage()
  const [profile, setProfile] = useState<OwnerProfile | null>(null)
  const [jobs, setJobs] = useState<OwnerJob[]>([])
  const [form, setForm] = useState<OwnerJobInput>(emptyJobForm)
  const [jobStep, setJobStep] = useState(1)
  const [isCreating, setIsCreating] = useState(false)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [isQrExpanded, setIsQrExpanded] = useState(false)
  const pendingJobIds = useRef(new Set<string>())
  const publicHiringLink = profile?.slug
    ? `${window.location.origin}/r/${profile.slug}`
    : ''
  const qrStorageKey = profile?.slug
    ? `peepss_owner_qr_collapsed_${profile.slug}`
    : ''

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
        ? 'כדי לפרסם משרה צריך להשלים פרופיל מסעדה'
        : 'Complete your restaurant profile before posting jobs.',
    goToProfile:
      language === 'he' ? 'להשלמת פרופיל' : 'Complete profile',
    firstJob:
      language === 'he'
        ? 'בוא ניצור את המשרה הראשונה שלך'
        : "Let's create your first job",
    createJob: language === 'he' ? 'צור משרה' : 'Create job',
    postingFor: language === 'he' ? 'מפרסמים עבור' : 'Posting for',
    newDrafts:
      language === 'he'
        ? 'משרות חדשות מתחילות כטיוטה.'
        : 'New jobs start as drafts.',
    defaultDraftsTitle:
      language === 'he'
        ? 'יצרנו עבורך משרות בסיסיות לעריכה מהירה.'
        : 'We created basic job drafts for you.',
    defaultDraftsHint:
      language === 'he'
        ? 'אפשר לערוך, למחוק או להפעיל כל משרה.'
        : 'You can edit, delete, or activate each job.',
    editJob: language === 'he' ? 'עריכת משרה' : 'Edit job',
    cancelEdit: language === 'he' ? 'ביטול עריכה' : 'Cancel edit',
    roleStep: language === 'he' ? 'את מי אתם מחפשים?' : 'Who are you hiring?',
    shiftStep: language === 'he' ? 'מתי המשמרות?' : 'When are the shifts?',
    detailsStep:
      language === 'he' ? 'מה חשוב לדעת?' : 'What should workers know?',
    shiftInfo: language === 'he' ? 'משמרות' : 'Shift info',
    contactStep:
      language === 'he'
        ? 'לאן לפנות אחרי התאמה?'
        : 'Where should matched workers contact you?',
    contactHint:
      language === 'he'
        ? 'נמלא מהפרופיל אם תשאיר ריק.'
        : 'Leave blank to use the restaurant profile contact.',
    contactPhone: language === 'he' ? 'טלפון' : 'Phone',
    contactWhatsapp: language === 'he' ? 'וואטסאפ' : 'WhatsApp',
    requirements: language === 'he' ? 'דרישות' : 'Requirements',
    description: language === 'he' ? 'תיאור' : 'Description',
    saving: language === 'he' ? 'שומר...' : 'Saving...',
    saveChanges: language === 'he' ? 'שמירת שינויים' : 'Save changes',
    createDraft: language === 'he' ? 'צור טיוטה' : 'Create draft',
    next: language === 'he' ? 'הבא' : 'Next',
    back: language === 'he' ? 'חזרה' : 'Back',
    postedJobs: language === 'he' ? 'משרות שפורסמו' : 'Posted jobs',
    active: language === 'he' ? 'פעילה' : 'Active',
    draft: language === 'he' ? 'טיוטה' : 'Draft',
    activeHint:
      language === 'he'
        ? 'משרה פעילה — עובדים יכולים לראות אותה'
        : 'Active — workers can see this job',
    draftHint:
      language === 'he'
        ? 'טיוטה — עובדים עדיין לא רואים אותה'
        : 'Draft — workers cannot see this yet',
    locationNotSet:
      language === 'he' ? 'כתובת לא הוגדרה' : 'Location not set',
    edit: language === 'he' ? 'ערוך' : 'Edit',
    activate: language === 'he' ? 'הפעל משרה' : 'Activate job',
    deactivate: language === 'he' ? 'כבה משרה' : 'Deactivate',
    delete: language === 'he' ? 'מחק' : 'Delete',
    updated: language === 'he' ? 'המשרה עודכנה.' : 'Job updated.',
    created:
      language === 'he' ? 'טיוטת משרה נוצרה.' : 'Draft job created.',
    activated: language === 'he' ? 'המשרה הופעלה.' : 'Job activated.',
    deactivated: language === 'he' ? 'המשרה כובתה.' : 'Job deactivated.',
    deleted: language === 'he' ? 'המשרה נמחקה.' : 'Job deleted.',
    qrTitle:
      language === 'he' ? 'קישור גיוס למסעדה' : 'Restaurant hiring QR',
    qrDescription:
      language === 'he'
        ? 'תלו את הברקוד במסעדה כדי שעובדים יוכלו להשאיר פרטים.'
        : 'Print or share this QR so workers can apply to your restaurant.',
    qrMissing:
      language === 'he'
        ? 'השלימו ושמרו פרופיל מסעדה כדי ליצור קישור גיוס.'
        : 'Complete your restaurant profile to generate your hiring QR.',
    qrCollapsedSubtitle:
      language === 'he'
        ? 'פתח את הברקוד להדפסה ושיתוף.'
        : 'Open your printable QR hiring link.',
    openQr: language === 'he' ? 'פתח ברקוד' : 'Open QR',
    hideQr: language === 'he' ? 'סגור ברקוד' : 'Hide QR',
    copyLink: language === 'he' ? 'העתק קישור' : 'Copy link',
    downloadQr: language === 'he' ? 'הורד QR' : 'Download QR',
    copied: language === 'he' ? 'הקישור הועתק.' : 'Link copied.',
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
          setIsQrExpanded(getStoredQrExpanded(ownerProfile?.slug))
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

  useEffect(() => {
    let isActive = true

    async function generateQrCode() {
      if (!publicHiringLink) {
        setQrCodeUrl('')
        return
      }

      try {
        const dataUrl = await QRCode.toDataURL(publicHiringLink, {
          margin: 1,
          width: 320,
          color: {
            dark: '#1f1d1e',
            light: '#fffaf3',
          },
        })

        if (isActive) {
          setQrCodeUrl(dataUrl)
        }
      } catch {
        if (isActive) {
          setQrCodeUrl('')
        }
      }
    }

    void generateQrCode()

    return () => {
      isActive = false
    }
  }, [publicHiringLink])

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
    setIsCreating(false)
    setJobStep(1)
  }

  function startCreating() {
    setForm({
      ...emptyJobForm,
      contactPhone: profile?.phoneNumber ?? '',
      contactWhatsapp: profile?.whatsappNumber ?? '',
    })
    setEditingJobId(null)
    setIsCreating(true)
    setJobStep(1)
    setError(null)
    setSuccess(null)
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
    setIsCreating(true)
    setJobStep(1)
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

    if (jobStep < 4) {
      setJobStep((currentStep) => currentStep + 1)
      return
    }

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
    if (pendingJobIds.current.has(job.id)) {
      return
    }

    const nextIsActive = !job.isActive

    pendingJobIds.current.add(job.id)
    setBusyJobId(job.id)
    setError(null)
    setSuccess(nextIsActive ? text.activated : text.deactivated)
    replaceJob({ ...job, isActive: nextIsActive })

    try {
      const updatedJob = await setOwnerJobActive(job.id, nextIsActive)
      replaceJob(updatedJob)
    } catch (error) {
      replaceJob(job)
      setSuccess(null)
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update job visibility',
      )
    } finally {
      pendingJobIds.current.delete(job.id)
      setBusyJobId(null)
    }
  }

  async function handleDelete(job: OwnerJob) {
    if (pendingJobIds.current.has(job.id)) {
      return
    }

    const roleLabel = getRestaurantRoleLabel(job.role, language)
    const shouldDelete = window.confirm(
      language === 'he'
        ? `למחוק את משרת ${roleLabel}?`
        : `Delete the ${roleLabel} job?`,
    )

    if (!shouldDelete) {
      return
    }

    const jobIndex = jobs.findIndex((currentJob) => currentJob.id === job.id)

    pendingJobIds.current.add(job.id)
    setBusyJobId(job.id)
    setError(null)
    setSuccess(text.deleted)
    setJobs((currentJobs) =>
      currentJobs.filter((currentJob) => currentJob.id !== job.id),
    )

    try {
      await deleteOwnerJob(job.id)

      if (editingJobId === job.id) {
        resetForm()
      }
    } catch (error) {
      setJobs((currentJobs) => {
        if (currentJobs.some((currentJob) => currentJob.id === job.id)) {
          return currentJobs
        }

        const insertAt =
          jobIndex >= 0 ? Math.min(jobIndex, currentJobs.length) : 0

        return [
          ...currentJobs.slice(0, insertAt),
          job,
          ...currentJobs.slice(insertAt),
        ]
      })
      setSuccess(null)
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to delete restaurant job',
      )
    } finally {
      pendingJobIds.current.delete(job.id)
      setBusyJobId(null)
    }
  }

  function toggleShift(label: string) {
    const currentValues = form.shiftInfo
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    updateField(
      'shiftInfo',
      currentValues.includes(label)
        ? currentValues.filter((item) => item !== label).join(', ')
        : [...currentValues, label].join(', '),
    )
  }

  async function handleCopyQrLink() {
    if (!publicHiringLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(publicHiringLink)
      setSuccess(text.copied)
      setError(null)
    } catch {
      setError(publicHiringLink)
    }
  }

  function handleToggleQr() {
    const nextIsExpanded = !isQrExpanded

    setIsQrExpanded(nextIsExpanded)

    if (qrStorageKey) {
      localStorage.setItem(qrStorageKey, String(!nextIsExpanded))
    }
  }

  if (isLoading) {
    return (
      <section className="owner-jobs-page owner-guided-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
        </div>
        <p className="status-message">{text.loading}</p>
      </section>
    )
  }

  if (error && !profile) {
    return (
      <section className="owner-jobs-page owner-guided-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
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
      <section className="owner-jobs-page owner-guided-page" dir={direction}>
        <div className="owner-step-card owner-profile-required">
          <h1>{text.completeProfile}</h1>
          <Link to="/owner/profile">{text.goToProfile}</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="owner-jobs-page owner-guided-page" dir={direction}>
      <div className="page-header">
        <div>
          <h1>{text.title}</h1>
          <p>
            {text.postingFor} {profile.restaurantName}. {text.newDrafts}
          </p>
        </div>
      </div>

      <section
        className={`owner-qr-card${isQrExpanded ? ' is-expanded' : ''}`}
      >
        <div>
          <h2>{text.qrTitle}</h2>
          <p>
            {profile.slug
              ? isQrExpanded
                ? text.qrDescription
                : text.qrCollapsedSubtitle
              : text.qrMissing}
          </p>
          {publicHiringLink && isQrExpanded && (
            <p className="owner-qr-link" dir="ltr">
              {publicHiringLink}
            </p>
          )}
          <div className="owner-qr-actions">
            {publicHiringLink && (
              <button type="button" onClick={handleToggleQr}>
                {isQrExpanded ? text.hideQr : text.openQr}
              </button>
            )}
            <button
              type="button"
              disabled={!publicHiringLink || !isQrExpanded}
              onClick={() => void handleCopyQrLink()}
            >
              {text.copyLink}
            </button>
            {qrCodeUrl && isQrExpanded && (
              <a href={qrCodeUrl} download="peepss-restaurant-qr.png">
                {text.downloadQr}
              </a>
            )}
          </div>
        </div>
        {qrCodeUrl && isQrExpanded && (
          <img
            src={qrCodeUrl}
            alt={text.qrTitle}
            className="owner-qr-image"
          />
        )}
      </section>

      {!isCreating && jobs.length === 0 && (
        <div className="owner-step-card owner-jobs-empty">
          <h2>{text.firstJob}</h2>
          <button type="button" onClick={startCreating}>
            {text.createJob}
          </button>
        </div>
      )}

      {!isCreating && jobs.length > 0 && (
        <button
          className="owner-create-job-button"
          type="button"
          onClick={startCreating}
        >
          {text.createJob}
        </button>
      )}

      {!isCreating && jobs.some((job) => !job.isActive) && (
        <div className="owner-step-card owner-default-drafts-note">
          <h2>{text.defaultDraftsTitle}</h2>
          <p>{text.defaultDraftsHint}</p>
        </div>
      )}

      {isCreating && (
        <form
          className="owner-job-form owner-step-card"
          onSubmit={handleSubmit}
        >
          <div className="guided-form-progress">
            <span>{jobStep}/4</span>
            <div>
              {[1, 2, 3, 4].map((currentStep) => (
                <span
                  className={currentStep <= jobStep ? 'active' : ''}
                  key={currentStep}
                />
              ))}
            </div>
          </div>

          <div className="owner-form-heading">
            <div>
              <h2>{editingJobId ? text.editJob : text.createJob}</h2>
              <p>{jobStep === 4 ? text.contactHint : text.draftHint}</p>
            </div>
            <button
              className="owner-cancel-button"
              type="button"
              onClick={resetForm}
            >
              {text.cancelEdit}
            </button>
          </div>

          {jobStep === 1 && (
            <>
              <div className="guided-form-heading">
                <h2>{text.roleStep}</h2>
              </div>
              <fieldset className="restaurant-role-options owner-role-options">
                <legend>{text.roleStep}</legend>
                <div>
                  {RESTAURANT_ROLES.map((role) => (
                    <label key={role.value}>
                      <input
                        type="radio"
                        name="owner-job-role"
                        checked={form.role === role.value}
                        onChange={() => updateField('role', role.value)}
                      />
                      <span>
                        {getRestaurantRoleLabel(role.value, language)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {jobStep === 2 && (
            <>
              <div className="guided-form-heading">
                <h2>{text.shiftStep}</h2>
              </div>
              <fieldset className="restaurant-role-options owner-shift-options">
                <legend>{text.shiftStep}</legend>
                <div>
                  {shiftOptions.map((option) => {
                    const label = option[language]

                    return (
                      <label key={label}>
                        <input
                          type="checkbox"
                          checked={form.shiftInfo.includes(label)}
                          onChange={() => toggleShift(label)}
                        />
                        <span>{label}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              <label className="owner-field-wide">
                {text.shiftInfo}
                <input
                  value={form.shiftInfo}
                  onChange={(event) =>
                    updateField('shiftInfo', event.target.value)
                  }
                />
              </label>
            </>
          )}

          {jobStep === 3 && (
            <>
              <div className="guided-form-heading">
                <h2>{text.detailsStep}</h2>
              </div>
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
            </>
          )}

          {jobStep === 4 && (
            <>
              <div className="guided-form-heading">
                <h2>{text.contactStep}</h2>
              </div>
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
            </>
          )}

          <div className="guided-form-actions">
            {jobStep > 1 && (
              <button
                className="restaurant-skip-button"
                type="button"
                onClick={() => setJobStep((currentStep) => currentStep - 1)}
              >
                {text.back}
              </button>
            )}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? text.saving
                : jobStep === 4
                  ? editingJobId
                    ? text.saveChanges
                    : text.createDraft
                  : text.next}
            </button>
          </div>
        </form>
      )}

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

      {jobs.length > 0 && (
        <section className="owner-job-list-section">
          <div className="owner-list-heading">
            <h2>{text.postedJobs}</h2>
            <span>{jobs.length}</span>
          </div>

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

                <p className="owner-job-status-note">
                  {job.isActive ? text.activeHint : text.draftHint}
                </p>

                <p className="owner-job-meta">
                  {[job.city, job.street].filter(Boolean).join(' · ') ||
                    text.locationNotSet}
                </p>

                {job.shiftInfo && <p>{job.shiftInfo}</p>}
                {job.requirements && (
                  <p className="owner-job-requirements">
                    {job.requirements}
                  </p>
                )}

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
        </section>
      )}
    </section>
  )
}

export default OwnerJobsPage
