import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
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

function getQrWidgetStorageKey(slug: string | null | undefined) {
  return slug ? `peepss_owner_qr_widget_open_${slug}` : ''
}

function getPostedJobsStorageKey(slug: string | null | undefined) {
  return slug ? `peepss_owner_posted_job_ids_${slug}` : ''
}

function getStoredQrWidgetOpen(slug: string | null | undefined) {
  const storageKey = getQrWidgetStorageKey(slug)

  if (!storageKey) {
    return false
  }

  const storedValue = localStorage.getItem(storageKey)

  return storedValue === null ? true : storedValue === 'true'
}

function getStoredPostedJobIds(slug: string | null | undefined) {
  const storageKey = getPostedJobsStorageKey(slug)

  if (!storageKey) {
    return new Set<string>()
  }

  try {
    const parsedValue = JSON.parse(localStorage.getItem(storageKey) ?? '[]')

    return new Set(
      Array.isArray(parsedValue)
        ? parsedValue.filter((value): value is string => typeof value === 'string')
        : [],
    )
  } catch {
    return new Set<string>()
  }
}

function getJobInputFromJob(job: OwnerJob): OwnerJobInput {
  return {
    role: job.role,
    description: job.description,
    requirements: job.requirements,
    shiftInfo: job.shiftInfo,
    contactPhone: job.contactPhone,
    contactWhatsapp: job.contactWhatsapp,
  }
}

function getPreview(value: string, fallback: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return fallback
  }

  return trimmedValue.length > 120
    ? `${trimmedValue.slice(0, 120).trim()}...`
    : trimmedValue
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
  const [postedJobIds, setPostedJobIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null)
  const draftsSectionRef = useRef<HTMLElement | null>(null)
  const postedSectionRef = useRef<HTMLElement | null>(null)
  const pendingJobIds = useRef(new Set<string>())
  const publicHiringLink = profile?.slug
    ? `${window.location.origin}/r/${profile.slug}`
    : ''
  const qrStorageKey = getQrWidgetStorageKey(profile?.slug)
  const postedJobsStorageKey = getPostedJobsStorageKey(profile?.slug)

  const text = {
    title: language === 'he' ? 'המשרות שלי' : 'My jobs',
    subtitle:
      language === 'he'
        ? 'נהלו טיוטות ומשרות שפורסמו בצורה ברורה.'
        : 'Manage drafts and posted jobs clearly.',
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
        ? 'אפשר לערוך, למחוק או לפרסם כל טיוטה.'
        : 'You can edit, delete, or publish each draft.',
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
    drafts: language === 'he' ? 'טיוטות' : 'Drafts',
    postedJobs: language === 'he' ? 'משרות שפורסמו' : 'Posted jobs',
    active: language === 'he' ? 'פעילה' : 'Active',
    inactive: language === 'he' ? 'כבויה' : 'Inactive',
    draft: language === 'he' ? 'טיוטה' : 'Draft',
    activeHint:
      language === 'he'
        ? 'משרה פעילה — עובדים יכולים לראות אותה'
        : 'Active — workers can see this job',
    inactiveHint:
      language === 'he'
        ? 'משרה שפורסמה אך כבויה כרגע'
        : 'Posted, but currently inactive',
    draftHint:
      language === 'he'
        ? 'טיוטה — עובדים עדיין לא רואים אותה'
        : 'Draft — workers cannot see this yet',
    locationNotSet:
      language === 'he' ? 'כתובת לא הוגדרה' : 'Location not set',
    noDetails:
      language === 'he' ? 'אין תיאור עדיין.' : 'No description yet.',
    edit: language === 'he' ? 'ערוך' : 'Edit',
    publish: language === 'he' ? 'פרסם משרה' : 'Publish',
    activate: language === 'he' ? 'הפעל' : 'Activate',
    deactivate: language === 'he' ? 'כבה' : 'Deactivate',
    deleteDraft: language === 'he' ? 'מחק טיוטה' : 'Delete draft',
    delete: language === 'he' ? 'מחק' : 'Delete',
    updated: language === 'he' ? 'המשרה עודכנה.' : 'Job updated.',
    created:
      language === 'he' ? 'טיוטת משרה נוצרה.' : 'Draft job created.',
    posted:
      language === 'he'
        ? 'המשרה פורסמה בהצלחה'
        : 'Job posted successfully',
    activated: language === 'he' ? 'המשרה הופעלה.' : 'Job activated.',
    deactivated: language === 'he' ? 'המשרה כובתה.' : 'Job deactivated.',
    deleted: language === 'he' ? 'המשרה נמחקה.' : 'Job deleted.',
    emptyDrafts:
      language === 'he'
        ? 'אין טיוטות כרגע.'
        : 'No drafts right now.',
    emptyPosted:
      language === 'he'
        ? 'עוד לא פורסמו משרות.'
        : 'No posted jobs yet.',
    qrTitle: language === 'he' ? 'ברקוד גיוס' : 'QR hiring link',
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
        ? 'קישור מוכן לשיתוף והדפסה'
        : 'Ready to share or print',
    openQr: language === 'he' ? 'פתח' : 'Open',
    hideQr: language === 'he' ? 'סגור' : 'Close',
    copyLink: language === 'he' ? 'העתק קישור' : 'Copy link',
    downloadQr: language === 'he' ? 'הורד QR' : 'Download QR',
    copied: language === 'he' ? 'הקישור הועתק.' : 'Link copied.',
  }

  const postedJobs = useMemo(
    () => jobs.filter((job) => job.isActive || postedJobIds.has(job.id)),
    [jobs, postedJobIds],
  )
  const draftJobs = useMemo(
    () => jobs.filter((job) => !job.isActive && !postedJobIds.has(job.id)),
    [jobs, postedJobIds],
  )

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
          setIsQrExpanded(getStoredQrWidgetOpen(ownerProfile?.slug))
          setPostedJobIds(getStoredPostedJobIds(ownerProfile?.slug))
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

  useEffect(() => {
    if (!postedJobsStorageKey) {
      return
    }

    localStorage.setItem(
      postedJobsStorageKey,
      JSON.stringify(Array.from(postedJobIds)),
    )
  }, [postedJobIds, postedJobsStorageKey])

  useEffect(() => {
    if (!highlightedJobId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedJobId(null)
    }, 3500)

    return () => window.clearTimeout(timeoutId)
  }, [highlightedJobId])

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
    setForm(getJobInputFromJob(job))
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

  function rememberPostedJob(jobId: string) {
    setPostedJobIds((currentIds) => {
      const nextIds = new Set(currentIds)

      nextIds.add(jobId)

      return nextIds
    })
  }

  function forgetPostedJob(jobId: string) {
    setPostedJobIds((currentIds) => {
      const nextIds = new Set(currentIds)

      nextIds.delete(jobId)

      return nextIds
    })
  }

  function scrollToPostedJobs() {
    window.setTimeout(() => {
      postedSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 50)
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

  async function handlePublishDraft(job: OwnerJob) {
    if (pendingJobIds.current.has(job.id)) {
      return
    }

    pendingJobIds.current.add(job.id)
    setBusyJobId(job.id)
    setError(null)
    setSuccess(null)

    try {
      const createdJob = await createOwnerJob(getJobInputFromJob(job))
      const postedJob = await setOwnerJobActive(createdJob.id, true)

      rememberPostedJob(postedJob.id)
      setJobs((currentJobs) => [postedJob, ...currentJobs])
      setSuccess(text.posted)
      setHighlightedJobId(postedJob.id)
      resetForm()
      scrollToPostedJobs()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to publish restaurant job',
      )
    } finally {
      pendingJobIds.current.delete(job.id)
      setBusyJobId(null)
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
    rememberPostedJob(job.id)
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
    forgetPostedJob(job.id)
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
      if (job.isActive || postedJobIds.has(job.id)) {
        rememberPostedJob(job.id)
      }
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
      localStorage.setItem(qrStorageKey, String(nextIsExpanded))
    }
  }

  function renderJobCard(job: OwnerJob, variant: 'draft' | 'posted') {
    const isBusy = busyJobId === job.id
    const location =
      [job.city, job.street].filter(Boolean).join(' · ') ||
      text.locationNotSet
    const isPosted = variant === 'posted'

    return (
      <article
        className={`owner-job-card owner-job-card-${variant}${
          highlightedJobId === job.id ? ' is-highlighted' : ''
        }`}
        key={job.id}
      >
        <div className="owner-job-card-header">
          <div>
            <p>{job.restaurantName}</p>
            <h3>{getRestaurantRoleLabel(job.role, language)}</h3>
          </div>
          <span
            className={`owner-job-status ${
              isPosted ? (job.isActive ? 'active' : 'inactive') : 'draft'
            }`}
          >
            {isPosted
              ? job.isActive
                ? text.active
                : text.inactive
              : text.draft}
          </span>
        </div>

        <p className="owner-job-status-note">
          {isPosted
            ? job.isActive
              ? text.activeHint
              : text.inactiveHint
            : text.draftHint}
        </p>

        <div className="owner-job-compact-meta">
          <span>{location}</span>
          {job.shiftInfo && <span>{job.shiftInfo}</span>}
        </div>

        <p className="owner-job-requirements">
          {getPreview(job.requirements || job.description, text.noDetails)}
        </p>

        <div className="owner-job-actions">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => startEditing(job)}
          >
            {text.edit}
          </button>
          {isPosted ? (
            <button
              className="owner-active-button"
              type="button"
              disabled={isBusy}
              onClick={() => void handleActiveChange(job)}
            >
              {isBusy
                ? text.saving
                : job.isActive
                  ? text.deactivate
                  : text.activate}
            </button>
          ) : (
            <button
              className="owner-active-button"
              type="button"
              disabled={isBusy}
              onClick={() => void handlePublishDraft(job)}
            >
              {isBusy ? text.saving : text.publish}
            </button>
          )}
          <button
            className="owner-delete-button"
            type="button"
            disabled={isBusy}
            onClick={() => void handleDelete(job)}
          >
            {isPosted ? text.delete : text.deleteDraft}
          </button>
        </div>
      </article>
    )
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
        className={`owner-qr-card owner-qr-widget ${
          isQrExpanded
            ? 'owner-qr-widget-expanded'
            : 'owner-qr-widget-collapsed'
        }`}
      >
        <div className="owner-qr-widget-copy">
          <span aria-hidden="true">▦</span>
          <div>
            <h2>{text.qrTitle}</h2>
            <p>
              {profile.slug
                ? isQrExpanded
                  ? text.qrDescription
                  : text.qrCollapsedSubtitle
                : text.qrMissing}
            </p>
          </div>
        </div>

        {publicHiringLink && isQrExpanded && (
          <p className="owner-qr-link" dir="ltr">
            {publicHiringLink}
          </p>
        )}

        {qrCodeUrl && isQrExpanded && (
          <img
            src={qrCodeUrl}
            alt={text.qrTitle}
            className="owner-qr-image"
          />
        )}

        <div className="owner-qr-actions">
          {publicHiringLink && (
            <button type="button" onClick={handleToggleQr}>
              {isQrExpanded ? text.hideQr : text.openQr}
            </button>
          )}
          {isQrExpanded && (
            <>
              <button
                type="button"
                disabled={!publicHiringLink}
                onClick={() => void handleCopyQrLink()}
              >
                {text.copyLink}
              </button>
              {qrCodeUrl && (
                <a href={qrCodeUrl} download="peepss-restaurant-qr.png">
                  {text.downloadQr}
                </a>
              )}
            </>
          )}
        </div>
      </section>

      <div className="owner-jobs-local-nav" aria-label={text.title}>
        <button
          type="button"
          onClick={() =>
            draftsSectionRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }
        >
          {text.drafts} · {draftJobs.length}
        </button>
        <button type="button" onClick={scrollToPostedJobs}>
          {text.postedJobs} · {postedJobs.length}
        </button>
      </div>

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

      {!isCreating && draftJobs.length > 0 && (
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

      <section
        className="owner-job-list-section"
        ref={draftsSectionRef}
      >
        <div className="owner-list-heading">
          <h2>{text.drafts}</h2>
          <span>{draftJobs.length}</span>
        </div>

        {draftJobs.length > 0 ? (
          <div className="owner-job-list owner-job-draft-list">
            {draftJobs.map((job) => renderJobCard(job, 'draft'))}
          </div>
        ) : (
          <p className="owner-empty-small">{text.emptyDrafts}</p>
        )}
      </section>

      <section
        className="owner-job-list-section"
        ref={postedSectionRef}
      >
        <div className="owner-list-heading">
          <h2>{text.postedJobs}</h2>
          <span>{postedJobs.length}</span>
        </div>

        {postedJobs.length > 0 ? (
          <div className="owner-job-list owner-job-posted-grid">
            {postedJobs.map((job) => renderJobCard(job, 'posted'))}
          </div>
        ) : (
          <p className="owner-empty-small">{text.emptyPosted}</p>
        )}
      </section>
    </section>
  )
}

export default OwnerJobsPage
