import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { useNavigate } from 'react-router-dom'
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
  publishOwnerJob,
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
  { he: 'צהריים', en: 'Afternoon' },
  { he: 'ערב', en: 'Evening' },
  { he: 'לילה', en: 'Night' },
  { he: 'סופי שבוע', en: 'Weekends' },
  { he: 'גמיש', en: 'Flexible' },
]

type OwnerJobsSection = 'drafts' | 'posted'

function getQrWidgetStorageKey(slug: string | null | undefined) {
  return slug ? `peepss_owner_qr_widget_open_${slug}` : ''
}

function getStoredQrWidgetOpen(slug: string | null | undefined) {
  const storageKey = getQrWidgetStorageKey(slug)

  if (!storageKey) {
    return false
  }

  const storedValue = localStorage.getItem(storageKey)

  return storedValue === null ? false : storedValue === 'true'
}

function getDraftIntroStorageKey(profileId: string | null | undefined) {
  return profileId ? `peepss_owner_starter_drafts_seen_${profileId}` : ''
}

function isOwnerProfileComplete(profile: OwnerProfile | null) {
  return Boolean(
    profile?.restaurantName.trim() &&
      profile.contactPerson.trim() &&
      profile.phoneNumber.trim() &&
      profile.city.trim() &&
      profile.street.trim() &&
      profile.description.trim(),
  )
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
  const navigate = useNavigate()
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
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null)
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null)
  const [showFirstPublishModal, setShowFirstPublishModal] = useState(false)
  const [showDraftIntro, setShowDraftIntro] = useState(false)
  const [openJobsSection, setOpenJobsSection] =
    useState<OwnerJobsSection | null>(null)
  const pendingJobIds = useRef(new Set<string>())
  const publicHiringLink = profile?.slug
    ? `${window.location.origin}/r/${profile.slug}`
    : ''
  const qrStorageKey = getQrWidgetStorageKey(profile?.slug)

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
    closeQr: language === 'he' ? 'סגור אזור ברקוד' : 'Close QR section',
    copyLink: language === 'he' ? 'העתק קישור' : 'Copy link',
    downloadQr: language === 'he' ? 'הורד QR' : 'Download QR',
    copied: language === 'he' ? 'הקישור הועתק.' : 'Link copied.',
    tapToManage:
      language === 'he' ? 'לחצו לניהול' : 'Tap to manage',
    collapseDraft:
      language === 'he' ? 'סגור טיוטה' : 'Collapse draft',
    firstPublishTitle:
      language === 'he' ? 'המשרה פורסמה ✅' : 'Job posted ✅',
    firstPublishBody:
      language === 'he'
        ? 'מועמדים יוכלו להגיש מועמדות. כשמישהו יגיש, זה יופיע באזור המועמדים.'
        : "Candidates can now apply. When someone applies, they'll appear in the Applications section.",
    gotIt: language === 'he' ? 'הבנתי' : 'Got it',
    viewApplications:
      language === 'he' ? 'למועמדים' : 'View applications',
    starterDraftsIntro:
      language === 'he'
        ? 'יצרנו בשבילך כמה טיוטות התחלתיות לפי תפקידים נפוצים במסעדות. אפשר לערוך, לפרסם או למחוק כל טיוטה.'
        : 'We created a few starter drafts for common restaurant roles. You can edit, publish, or delete each draft.',
    closeDraftIntro:
      language === 'he' ? 'סגור הסבר טיוטות' : 'Close draft explanation',
    closeCreateJob:
      language === 'he' ? 'סגור יצירת משרה' : 'Close create job',
    closeEditJob:
      language === 'he' ? 'סגור עריכת משרה' : 'Close edit job',
  }

  const postedJobs = useMemo(
    () => jobs.filter((job) => job.kind === 'posted'),
    [jobs],
  )
  const draftJobs = useMemo(
    () => jobs.filter((job) => job.kind === 'draft'),
    [jobs],
  )

  useEffect(() => {
    let isActive = true

    async function loadOwnerData() {
      try {
        const ownerProfile = await getOwnerProfile()

        if (isActive) {
          setProfile(ownerProfile)

          if (!isOwnerProfileComplete(ownerProfile)) {
            setJobs([])
            setIsQrExpanded(false)
            setShowDraftIntro(false)
            setOpenJobsSection(null)
            return
          }
        }

        const ownerJobs = await getOwnerJobs()

        if (isActive) {
          const postedCount = ownerJobs.filter(
            (job) => job.kind === 'posted',
          ).length
          const draftCount = ownerJobs.filter(
            (job) => job.kind === 'draft',
          ).length

          setJobs(ownerJobs)
          setIsQrExpanded(getStoredQrWidgetOpen(ownerProfile?.slug))
          setShowDraftIntro(
            draftCount > 0 &&
              !localStorage.getItem(
                getDraftIntroStorageKey(ownerProfile?.id),
              ),
          )
          setOpenJobsSection(
            postedCount > 0 ? 'posted' : draftCount > 0 ? 'drafts' : null,
          )
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
    if (isLoading || error || isOwnerProfileComplete(profile)) {
      return
    }

    navigate('/owner/profile', { replace: true })
  }, [error, isLoading, navigate, profile])

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

  function toggleJobsSection(section: OwnerJobsSection) {
    setOpenJobsSection((currentSection) =>
      currentSection === section ? null : section,
    )
  }

  function dismissDraftIntro() {
    const storageKey = getDraftIntroStorageKey(profile?.id)

    if (storageKey) {
      localStorage.setItem(storageKey, 'true')
    }

    setShowDraftIntro(false)
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
      const jobInput = {
        ...form,
        contactWhatsapp: form.contactPhone,
      }

      if (editingJobId) {
        const updatedJob = await updateOwnerJob(editingJobId, jobInput)
        replaceJob(updatedJob)
        setSuccess(text.updated)
      } else {
        const createdJob = await createOwnerJob(jobInput)
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
      const postedJob = await publishOwnerJob(job.id)

      setJobs((currentJobs) => [postedJob, ...currentJobs])
      setSuccess(text.posted)
      setHighlightedJobId(postedJob.id)
      setOpenJobsSection('posted')
      setExpandedDraftId(null)
      if (!localStorage.getItem('peepss_owner_first_publish_seen')) {
        localStorage.setItem('peepss_owner_first_publish_seen', 'true')
        setShowFirstPublishModal(true)
      }
      resetForm()
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
      localStorage.setItem(qrStorageKey, String(nextIsExpanded))
    }
  }

  function handleCloseQr() {
    setIsQrExpanded(false)

    if (qrStorageKey) {
      localStorage.setItem(qrStorageKey, 'false')
    }
  }

  function renderJobCard(job: OwnerJob, variant: 'draft' | 'posted') {
    const isBusy = busyJobId === job.id
    const location =
      [job.city, job.street].filter(Boolean).join(' · ') ||
      text.locationNotSet
    const isPosted = variant === 'posted'
    const isDraftExpanded = isPosted || expandedDraftId === job.id
    const isDraftCollapsed = !isPosted && !isDraftExpanded

    return (
      <article
        className={`owner-job-card owner-job-card-${variant}${
          highlightedJobId === job.id ? ' is-highlighted' : ''
        }${isDraftCollapsed ? ' is-mobile-collapsed' : ''}${
          isDraftExpanded && !isPosted ? ' is-draft-expanded' : ''
        }`}
        key={job.id}
        tabIndex={isDraftCollapsed ? 0 : undefined}
        onClick={() => {
          if (isDraftCollapsed) {
            setExpandedDraftId(job.id)
          }
        }}
        onKeyDown={(event) => {
          if (
            isDraftCollapsed &&
            (event.key === 'Enter' || event.key === ' ')
          ) {
            event.preventDefault()
            setExpandedDraftId(job.id)
          }
        }}
      >
        <div className="owner-job-card-header">
          <div>
            <p>{job.restaurantName}</p>
            <h3>{getRestaurantRoleLabel(job.role, language)}</h3>
            {!isPosted && isDraftCollapsed && (
              <span className="owner-draft-manage-hint">
                {text.tapToManage}
              </span>
            )}
          </div>
          <div className="owner-job-card-side">
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
            {!isPosted && (
              <button
                className="owner-draft-toggle-button"
                type="button"
                aria-label={
                  isDraftExpanded ? text.collapseDraft : text.tapToManage
                }
                onClick={(event) => {
                  event.stopPropagation()
                  setExpandedDraftId(isDraftExpanded ? null : job.id)
                }}
              >
                {isDraftExpanded ? '×' : '+'}
              </button>
            )}
          </div>
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
            onClick={(event) => {
              event.stopPropagation()
              startEditing(job)
            }}
          >
            {text.edit}
          </button>
          {isPosted ? (
            <button
              className="owner-active-button"
              type="button"
              disabled={isBusy}
              onClick={(event) => {
                event.stopPropagation()
                void handleActiveChange(job)
              }}
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
              onClick={(event) => {
                event.stopPropagation()
                void handlePublishDraft(job)
              }}
            >
              {isBusy ? text.saving : text.publish}
            </button>
          )}
          <button
            className="owner-delete-button"
            type="button"
            disabled={isBusy}
            onClick={(event) => {
              event.stopPropagation()
              void handleDelete(job)
            }}
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

  if (!profile || !isOwnerProfileComplete(profile)) {
    return (
      <section className="owner-jobs-page owner-guided-page" dir={direction}>
        <p className="status-message">{text.completeProfile}</p>
      </section>
    )
  }

  const ownerProfile = profile

  return (
    <section className="owner-jobs-page owner-guided-page" dir={direction}>
      <div className="page-header">
        <div>
          <h1>{text.title}</h1>
          <p>
            {text.postingFor} {ownerProfile.restaurantName}. {text.newDrafts}
          </p>
        </div>
      </div>

      <section
        className={`owner-qr-card owner-qr-widget ${
          isQrExpanded
            ? 'owner-qr-widget-expanded'
            : 'owner-qr-widget-collapsed'
        }`}
        role={!isQrExpanded && publicHiringLink ? 'button' : undefined}
        tabIndex={!isQrExpanded && publicHiringLink ? 0 : undefined}
        onClick={() => {
          if (!isQrExpanded && publicHiringLink) {
            handleToggleQr()
          }
        }}
        onKeyDown={(event) => {
          if (
            !isQrExpanded &&
            publicHiringLink &&
            (event.key === 'Enter' || event.key === ' ')
          ) {
            event.preventDefault()
            handleToggleQr()
          }
        }}
      >
        {isQrExpanded ? (
          <div className="owner-qr-expanded-content">
            <button
              className="owner-qr-close-button"
              type="button"
              aria-label={text.closeQr}
              onClick={handleCloseQr}
            >
              ×
            </button>
            <div className="owner-qr-main">
              <div className="owner-qr-widget-copy">
                <span aria-hidden="true">▦</span>
                <div className="owner-qr-text">
                  <h2>{text.qrTitle}</h2>
                  <p>{ownerProfile.slug ? text.qrDescription : text.qrMissing}</p>
                </div>
              </div>

              {publicHiringLink && (
                <p className="owner-qr-link owner-qr-public-link" dir="ltr">
                  {publicHiringLink}
                </p>
              )}

              <div className="owner-qr-actions">
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
              </div>
            </div>

            {qrCodeUrl && (
              <div className="owner-qr-code-panel">
                <img
                  src={qrCodeUrl}
                  alt={text.qrTitle}
                  className="owner-qr-image"
                />
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="owner-qr-widget-copy">
              <span aria-hidden="true">▦</span>
              <div className="owner-qr-text">
                <h2>{text.qrTitle}</h2>
                <p>
                  {ownerProfile.slug ? text.qrCollapsedSubtitle : text.qrMissing}
                </p>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="owner-job-action-cards" aria-label={text.title}>
        <button
          className={`owner-job-action-card${isCreating ? ' is-active' : ''}`}
          type="button"
          aria-expanded={isCreating}
          onClick={startCreating}
        >
          <span className="owner-job-action-card-title">{text.createJob}</span>
          <span className="owner-job-action-card-count" aria-hidden="true">
            +
          </span>
        </button>
        <button
          className={`owner-job-action-card${
            openJobsSection === 'drafts' ? ' is-active' : ''
          }`}
          type="button"
          aria-expanded={openJobsSection === 'drafts'}
          onClick={() => toggleJobsSection('drafts')}
        >
          <span className="owner-job-action-card-title">{text.drafts}</span>
          <span className="owner-job-action-card-count">{draftJobs.length}</span>
          <span className="owner-job-action-card-indicator" aria-hidden="true">
            {openJobsSection === 'drafts' ? '▲' : '▼'}
          </span>
        </button>
        <button
          className={`owner-job-action-card${
            openJobsSection === 'posted' ? ' is-active' : ''
          }`}
          type="button"
          aria-expanded={openJobsSection === 'posted'}
          onClick={() => toggleJobsSection('posted')}
        >
          <span className="owner-job-action-card-title">
            {text.postedJobs}
          </span>
          <span className="owner-job-action-card-count">
            {postedJobs.length}
          </span>
          <span className="owner-job-action-card-indicator" aria-hidden="true">
            {openJobsSection === 'posted' ? '▲' : '▼'}
          </span>
        </button>
      </div>

      {showDraftIntro && draftJobs.length > 0 && (
        <div className="owner-draft-intro-note">
          <p>{text.starterDraftsIntro}</p>
          <button
            type="button"
            aria-label={text.closeDraftIntro}
            onClick={dismissDraftIntro}
          >
            ×
          </button>
        </div>
      )}

      {isCreating && (
        <form
          className="owner-job-form owner-step-card"
          onSubmit={handleSubmit}
        >
          <button
            className="owner-form-close-button"
            type="button"
            aria-label={editingJobId ? text.closeEditJob : text.closeCreateJob}
            onClick={resetForm}
          >
            ×
          </button>
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

      {openJobsSection === 'drafts' && (
        <section className="owner-job-list-section">
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
      )}

      {openJobsSection === 'posted' && (
        <section className="owner-job-list-section">
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
      )}

      {showFirstPublishModal && (
        <div className="owner-publish-modal-backdrop" role="presentation">
          <section
            className="owner-publish-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-first-publish-title"
          >
            <h2 id="owner-first-publish-title">
              {text.firstPublishTitle}
            </h2>
            <p>{text.firstPublishBody}</p>
            <div className="owner-publish-modal-actions">
              <button
                type="button"
                className="restaurant-skip-button"
                onClick={() => setShowFirstPublishModal(false)}
              >
                {text.gotIt}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFirstPublishModal(false)
                  navigate('/owner/applications')
                }}
              >
                {text.viewApplications}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default OwnerJobsPage
