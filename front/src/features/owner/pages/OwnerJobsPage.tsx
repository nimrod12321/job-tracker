import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import PeepssModal from '../../../components/common/PeepssModal'
import {
  RESTAURANT_ROLES,
  getRestaurantRoleLabel,
  type RestaurantRole,
} from '../../restaurant/types/restaurant'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import {
  createQrPosterDataUrl,
  downloadQrPoster,
} from '../../../utils/qrPoster'
import {
  createOwnerJob,
  deleteOwnerJob,
  getOwnerJobs,
  getOwnerProfile,
  setOwnerJobActive,
  updateOwnerQrRoles,
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

function getQrWidgetStorageKey(slug: string | null | undefined) {
  return slug ? `peepss_owner_qr_widget_open_${slug}` : ''
}

function getStoredQrWidgetOpen(slug: string | null | undefined) {
  const storageKey = getQrWidgetStorageKey(slug)

  if (!storageKey) {
    return true
  }

  const storedValue = localStorage.getItem(storageKey)

  return storedValue === null ? true : storedValue === 'true'
}

function isOwnerProfileComplete(profile: OwnerProfile | null) {
  return Boolean(
    profile?.restaurantName.trim() &&
      profile.slug?.trim() &&
      (profile.city.trim() || profile.street.trim()),
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
  const [qrRolesSaveStatus, setQrRolesSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [posterPreviewUrl, setPosterPreviewUrl] = useState('')
  const [isPosterPreviewOpen, setIsPosterPreviewOpen] = useState(false)
  const [isPosterPreviewLoading, setIsPosterPreviewLoading] = useState(false)
  const [isQrExpanded, setIsQrExpanded] = useState(false)
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const pendingJobIds = useRef(new Set<string>())
  const confirmedQrRolesRef = useRef<RestaurantRole[]>([])
  const desiredQrRolesRef = useRef<RestaurantRole[]>([])
  const isQrRolesSaveRunningRef = useRef(false)
  const savedStatusTimeoutRef = useRef<number | null>(null)
  const posterPreviewPublicUrlRef = useRef('')
  const publicHiringLink = profile?.slug
    ? `${window.location.origin}/r/${profile.slug}`
    : ''
  const qrStorageKey = getQrWidgetStorageKey(profile?.slug)
  const isJobBoardPilotPaused = true

  const text = {
    title: language === 'he' ? 'התחילו לגייס' : 'Start hiring',
    subtitle:
      language === 'he'
        ? 'בחרו אילו תפקידים פתוחים, הורידו את המודעה והתחילו לקבל מועמדים.'
        : 'Choose which roles are open, download the poster, and start receiving candidates.',
    loading:
      language === 'he'
        ? 'טוען משרות מסעדה...'
        : 'Loading restaurant jobs...',
    completeProfile:
      language === 'he'
        ? 'כדי לנהל משרות צריך להשלים פרופיל מסעדה'
        : 'Complete your restaurant profile before managing jobs.',
    goToProfile:
      language === 'he' ? 'להשלמת פרופיל' : 'Complete profile',
    firstJob:
      language === 'he'
        ? 'בוא ניצור את המשרה הראשונה שלך'
        : "Let's create your first job",
    createJob: language === 'he' ? 'צור משרה' : 'Create job',
    postingFor: language === 'he' ? 'מפרסמים עבור' : 'Posting for',
    boardHint:
      language === 'he'
        ? 'משרות לא פעילות לא יופיעו לעובדים.'
        : 'Inactive jobs stay hidden from workers.',
    jobComplianceNotice:
      language === 'he'
        ? 'פרסום משרה חייב להיות ענייני ולא מפלה. אין לכלול דרישות שאינן קשורות לתפקיד.'
        : 'Job posts must be relevant and non-discriminatory. Do not include requirements unrelated to the role.',
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
    next: language === 'he' ? 'הבא' : 'Next',
    back: language === 'he' ? 'חזרה' : 'Back',
    jobBoard: language === 'he' ? 'לוח משרות' : 'Job board',
    comingSoon: language === 'he' ? 'בקרוב' : 'Coming soon',
    jobBoardSoon:
      language === 'he'
        ? 'דברים טובים יגיעו בהמשך.'
        : 'Good things are coming soon.',
    jobBoardPilotHint:
      language === 'he'
        ? 'בשלב הפיילוט אנחנו מתמקדים בגיוס דרך QR. לוח המשרות יהיה רלוונטי בהמשך.'
        : 'For the pilot, we’re focusing on QR hiring. The job board will become useful later.',
    active: language === 'he' ? 'פעילה' : 'Active',
    inactive: language === 'he' ? 'לא פעילה' : 'Inactive',
    activeHint:
      language === 'he'
        ? 'משרה פעילה — עובדים יכולים לראות אותה'
        : 'Active — workers can see this job',
    inactiveHint:
      language === 'he'
        ? 'משרה לא פעילה — עובדים לא רואים אותה'
        : 'Inactive — workers cannot see this job',
    locationNotSet:
      language === 'he' ? 'כתובת לא הוגדרה' : 'Location not set',
    noDetails:
      language === 'he' ? 'אין תיאור עדיין.' : 'No description yet.',
    edit: language === 'he' ? 'ערוך' : 'Edit',
    activate: language === 'he' ? 'הפעלה' : 'Activate',
    deactivate: language === 'he' ? 'כיבוי' : 'Deactivate',
    delete: language === 'he' ? 'מחק' : 'Delete',
    updated: language === 'he' ? 'המשרה עודכנה.' : 'Job updated.',
    created: language === 'he' ? 'המשרה נוצרה.' : 'Job created.',
    duplicateRole:
      language === 'he'
        ? 'כבר קיימת משרה לתפקיד הזה. אפשר לערוך את המשרה הקיימת.'
        : 'A job for this role already exists. Edit the existing job instead.',
    activated: language === 'he' ? 'המשרה הופעלה.' : 'Job activated.',
    deactivated: language === 'he' ? 'המשרה כובתה.' : 'Job deactivated.',
    deleted: language === 'he' ? 'המשרה נמחקה.' : 'Job deleted.',
    emptyJobs:
      language === 'he'
        ? 'אין עדיין משרות בלוח.'
        : 'No jobs on the board yet.',
    qrTitle: language === 'he' ? 'התחילו לגייס' : 'Start hiring',
    qrDescription:
      language === 'he'
        ? 'בחרו אילו תפקידים פתוחים, הורידו את המודעה והתחילו לקבל מועמדים.'
        : 'Choose which roles are open, download the poster, and start receiving candidates.',
    qrMissing:
      language === 'he'
        ? 'השלימו ושמרו פרופיל מסעדה כדי ליצור את הקישור של המסעדה.'
        : 'Complete your restaurant profile to create your restaurant link.',
    qrCollapsedSubtitle:
      language === 'he'
        ? 'בחרו אילו תפקידים פתוחים, הורידו את המודעה והתחילו לקבל מועמדים.'
        : 'Choose which roles are open, download the poster, and start receiving candidates.',
    closeQr: language === 'he' ? 'סגור אזור ברקוד' : 'Close QR section',
    restaurantLinkTitle:
      language === 'he' ? 'הקישור של המסעדה' : 'Your restaurant link',
    restaurantLinkHelper:
      language === 'he'
        ? 'זה הקישור שאליו מגיעים מועמדים שסורקים את ה־QR.'
        : 'This is where candidates arrive after scanning your QR code.',
    copyLink: language === 'he' ? 'העתקת קישור' : 'Copy link',
    previewPoster:
      language === 'he' ? 'תצוגה מקדימה' : 'Preview poster',
    previewPosterLoading:
      language === 'he' ? 'מכינים תצוגה...' : 'Preparing preview...',
    posterPreviewTitle:
      language === 'he' ? 'תצוגה מקדימה של המודעה' : 'Poster preview',
    downloadQr:
      language === 'he' ? 'הורדת המודעה' : 'Download poster',
    downloadQrHelper:
      language === 'he'
        ? 'המודעה מוכנה להדפסה ולתלייה במסעדה.'
        : 'The poster is ready to print and display at your restaurant.',
    downloadQrFailed:
      language === 'he'
        ? 'לא הצלחנו להוריד את מודעת ה־QR.'
        : 'Failed to download QR poster.',
    qrRolesTitle:
      language === 'he'
        ? 'אילו עובדים אתם מחפשים?'
        : 'Who are you looking for?',
    qrRolesDescription:
      language === 'he'
        ? 'בחרו את התפקידים שיופיעו למועמדים אחרי סריקת ה־QR.'
        : 'Choose which roles candidates can apply for after scanning the QR.',
    qrRolesHelper:
      language === 'he'
        ? 'לחצו על תפקיד כדי להפעיל או לכבות אותו.'
        : 'Tap a role to turn it on or off.',
    qrRolesUpdated:
      language === 'he'
        ? 'התפקידים עודכנו.'
        : 'Roles updated.',
    qrRolesUpdateFailed:
      language === 'he'
        ? 'לא הצלחנו לעדכן את התפקידים.'
        : 'Failed to update roles.',
    qrRolesAllDisabled:
      language === 'he'
        ? 'כל התפקידים כבויים. מי שיסרוק את ה־QR יראה שהמסעדה לא מגייסת כרגע.'
        : 'All roles are disabled. People who scan the QR will see that this restaurant is not hiring right now.',
    qrRolesSaving: language === 'he' ? 'שומר…' : 'Saving…',
    qrRolesSaved: language === 'he' ? 'נשמר' : 'Saved',
    qrRolesInlineError:
      language === 'he'
        ? 'לא הצלחנו לשמור את השינוי. נסו שוב.'
        : 'We couldn’t save the change. Please try again.',
    copied: language === 'he' ? 'הקישור הועתק.' : 'Link copied.',
    tapToManage:
      language === 'he' ? 'לחצו לניהול' : 'Tap to manage',
    collapseJob:
      language === 'he' ? 'סגור משרה' : 'Collapse job',
    closeCreateJob:
      language === 'he' ? 'סגור יצירת משרה' : 'Close create job',
    closeEditJob:
      language === 'he' ? 'סגור עריכת משרה' : 'Close edit job',
  }

  useEffect(() => {
    let isActive = true

    async function loadOwnerData() {
      try {
        const ownerProfile = await getOwnerProfile()

        if (isActive) {
          setProfile(ownerProfile)
          confirmedQrRolesRef.current = ownerProfile?.qrEnabledRoles ?? []
          desiredQrRolesRef.current = ownerProfile?.qrEnabledRoles ?? []

          if (!isOwnerProfileComplete(ownerProfile)) {
            setJobs([])
            setIsQrExpanded(false)
            return
          }
        }

        const ownerJobs = await getOwnerJobs()

        if (isActive) {
          setJobs(ownerJobs)
          setIsQrExpanded(getStoredQrWidgetOpen(ownerProfile?.slug))
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
    return () => {
      if (savedStatusTimeoutRef.current) {
        window.clearTimeout(savedStatusTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isLoading || error || isOwnerProfileComplete(profile)) {
      return
    }

    navigate('/owner/profile', { replace: true })
  }, [error, isLoading, navigate, profile])

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
        setExpandedJobId(createdJob.id)
        setSuccess(text.created)
      }

      resetForm()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to save restaurant job'

      setError(
        message ===
          'A job for this role already exists. Edit the existing job instead.'
          ? text.duplicateRole
          : message,
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

  async function handleDownloadQrPoster() {
    if (!publicHiringLink || !profile?.slug) {
      return
    }

    try {
      await downloadQrPoster({
        publicUrl: publicHiringLink,
        slug: profile.slug,
      })
      setError(null)
    } catch {
      setError(text.downloadQrFailed)
    }
  }

  async function handlePreviewQrPoster() {
    if (!publicHiringLink) {
      return
    }

    setIsPosterPreviewOpen(true)

    if (
      posterPreviewUrl &&
      posterPreviewPublicUrlRef.current === publicHiringLink
    ) {
      return
    }

    setPosterPreviewUrl('')
    setIsPosterPreviewLoading(true)
    setError(null)

    try {
      const dataUrl = await createQrPosterDataUrl(publicHiringLink)
      posterPreviewPublicUrlRef.current = publicHiringLink
      setPosterPreviewUrl(dataUrl)
    } catch {
      setError(text.downloadQrFailed)
      setIsPosterPreviewOpen(false)
    } finally {
      setIsPosterPreviewLoading(false)
    }
  }

  function areQrRolesEqual(
    firstRoles: RestaurantRole[],
    secondRoles: RestaurantRole[],
  ) {
    if (firstRoles.length !== secondRoles.length) {
      return false
    }

    const secondRoleSet = new Set(secondRoles)

    return firstRoles.every((role) => secondRoleSet.has(role))
  }

  async function processQrRoleSaveQueue() {
    if (isQrRolesSaveRunningRef.current) {
      return
    }

    isQrRolesSaveRunningRef.current = true

    try {
      while (
        !areQrRolesEqual(
          desiredQrRolesRef.current,
          confirmedQrRolesRef.current,
        )
      ) {
        const rolesToSave = desiredQrRolesRef.current

        if (savedStatusTimeoutRef.current) {
          window.clearTimeout(savedStatusTimeoutRef.current)
          savedStatusTimeoutRef.current = null
        }

        setQrRolesSaveStatus('saving')

        try {
          const updatedProfile = await updateOwnerQrRoles(rolesToSave)

          confirmedQrRolesRef.current = updatedProfile.qrEnabledRoles ?? []
          setProfile((currentProfile) =>
            currentProfile
              ? {
                  ...updatedProfile,
                  qrEnabledRoles: desiredQrRolesRef.current,
                }
              : updatedProfile,
          )
          setError(null)
        } catch {
          desiredQrRolesRef.current = confirmedQrRolesRef.current
          setProfile((currentProfile) =>
            currentProfile
              ? {
                  ...currentProfile,
                  qrEnabledRoles: confirmedQrRolesRef.current,
                }
              : currentProfile,
          )
          setQrRolesSaveStatus('error')
          return
        }
      }

      setQrRolesSaveStatus('saved')

      if (savedStatusTimeoutRef.current) {
        window.clearTimeout(savedStatusTimeoutRef.current)
      }

      savedStatusTimeoutRef.current = window.setTimeout(() => {
        setQrRolesSaveStatus('idle')
      }, 1400)
    } finally {
      isQrRolesSaveRunningRef.current = false
    }
  }

  function handleToggleQrRole(role: RestaurantRole) {
    if (!profile) {
      return
    }

    const currentRoles = desiredQrRolesRef.current.length
      ? desiredQrRolesRef.current
      : (profile.qrEnabledRoles ?? [])
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter((currentRole) => currentRole !== role)
      : [...currentRoles, role]

    desiredQrRolesRef.current = nextRoles
    setProfile({
      ...profile,
      qrEnabledRoles: nextRoles,
    })
    setQrRolesSaveStatus('saving')
    setError(null)
    setSuccess(null)
    void processQrRoleSaveQueue()
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

  function renderJobCard(job: OwnerJob) {
    const isBusy = busyJobId === job.id
    const location =
      [job.city, job.street].filter(Boolean).join(' · ') ||
      text.locationNotSet
    const isExpanded = expandedJobId === job.id

    return (
      <article
        className={`owner-job-card owner-job-board-card${
          highlightedJobId === job.id ? ' is-highlighted' : ''
        }${isExpanded ? ' is-expanded' : ' is-collapsed'}`}
        key={job.id}
        tabIndex={isExpanded ? undefined : 0}
        onClick={() => {
          if (!isExpanded) {
            setExpandedJobId(job.id)
          }
        }}
        onKeyDown={(event) => {
          if (!isExpanded && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            setExpandedJobId(job.id)
          }
        }}
      >
        <div className="owner-job-card-header">
          <div>
            <p>{job.restaurantName}</p>
            <h3>{getRestaurantRoleLabel(job.role, language)}</h3>
            {!isExpanded && (
              <span className="owner-job-manage-hint">
                {text.tapToManage}
              </span>
            )}
          </div>
          <div className="owner-job-card-side">
            <span
              className={`owner-job-status ${
                job.isActive ? 'active' : 'inactive'
              }`}
            >
              {job.isActive ? text.active : text.inactive}
            </span>
            {isExpanded && (
              <button
                className="owner-job-toggle-button peepss-close-button"
                type="button"
                aria-label={text.collapseJob}
                onClick={(event) => {
                  event.stopPropagation()
                  setExpandedJobId(null)
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        <p className="owner-job-status-note">
          {job.isActive ? text.activeHint : text.inactiveHint}
        </p>

        <div className="owner-job-compact-meta">
          <span>{location}</span>
          {job.shiftInfo && <span>{job.shiftInfo}</span>}
        </div>

        <p className="owner-job-requirements">
          {getPreview(job.requirements || job.description, text.noDetails)}
        </p>

        {isExpanded && !isJobBoardPilotPaused && (
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
            <button
              className="owner-delete-button"
              type="button"
              disabled={isBusy}
              onClick={(event) => {
                event.stopPropagation()
                void handleDelete(job)
              }}
            >
              {text.delete}
            </button>
          </div>
        )}
      </article>
    )
  }

  if (isLoading) {
    return (
      <section className="owner-jobs-page owner-guided-page" dir={direction}>
        <p className="status-message">{text.loading}</p>
      </section>
    )
  }

  if (error && !profile) {
    return (
      <section className="owner-jobs-page owner-guided-page" dir={direction}>
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
            <div className="owner-qr-main">
              <div className="owner-qr-widget-copy">
                <span aria-hidden="true">▦</span>
                <div className="owner-qr-text">
                  <h2>{text.qrTitle}</h2>
                  <p>{ownerProfile.slug ? text.qrDescription : text.qrMissing}</p>
                </div>
                <button
                  className="owner-qr-close-button peepss-close-button"
                  type="button"
                  aria-label={text.closeQr}
                  onClick={handleCloseQr}
                >
                  ×
                </button>
              </div>

              {publicHiringLink && (
                <div className="owner-qr-link-section">
                  <h3>{text.restaurantLinkTitle}</h3>
                  <p>{text.restaurantLinkHelper}</p>
                  <p className="owner-qr-link owner-qr-public-link" dir="ltr">
                    {publicHiringLink}
                  </p>
                </div>
              )}

              <div className="owner-qr-actions">
                <button
                  type="button"
                  disabled={!publicHiringLink}
                  onClick={() => void handlePreviewQrPoster()}
                >
                  {isPosterPreviewLoading
                    ? text.previewPosterLoading
                    : text.previewPoster}
                </button>
                <button
                  type="button"
                  disabled={!publicHiringLink}
                  onClick={() => void handleDownloadQrPoster()}
                >
                  {text.downloadQr}
                </button>
                <button
                  type="button"
                  disabled={!publicHiringLink}
                  onClick={() => void handleCopyQrLink()}
                >
                  {text.copyLink}
                </button>
              </div>
              <p className="owner-qr-poster-helper">
                {text.downloadQrHelper}
              </p>

              <div className="owner-qr-role-settings">
                <div className="owner-qr-role-settings-heading">
                  <div>
                    <h3>{text.qrRolesTitle}</h3>
                    <p>{text.qrRolesDescription}</p>
                    <p className="owner-qr-role-helper">
                      {text.qrRolesHelper}
                    </p>
                  </div>
                  {qrRolesSaveStatus !== 'idle' && (
                    <span
                      className={`owner-qr-save-status ${qrRolesSaveStatus}`}
                    >
                      {qrRolesSaveStatus === 'saving'
                        ? text.qrRolesSaving
                        : qrRolesSaveStatus === 'saved'
                          ? text.qrRolesSaved
                          : text.qrRolesInlineError}
                    </span>
                  )}
                </div>
                <div className="owner-qr-role-chips">
                  {RESTAURANT_ROLES.map((role) => {
                    const isEnabled = ownerProfile.qrEnabledRoles.includes(
                      role.value,
                    )

                    return (
                      <button
                        className={isEnabled ? 'is-enabled' : 'is-disabled'}
                        type="button"
                        key={role.value}
                        aria-pressed={isEnabled}
                        aria-label={`${getRestaurantRoleLabel(
                          role.value,
                          language,
                        )} ${isEnabled ? 'active' : 'off'}`}
                        onClick={() => handleToggleQrRole(role.value)}
                      >
                        <span
                          className="owner-qr-role-status-dot"
                          aria-hidden="true"
                        />
                        <span>
                          {getRestaurantRoleLabel(role.value, language)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {ownerProfile.qrEnabledRoles.length === 0 && (
                  <p className="owner-qr-warning">
                    {text.qrRolesAllDisabled}
                  </p>
                )}
              </div>
            </div>
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

      <PeepssModal
        isOpen={isPosterPreviewOpen}
        onClose={() => setIsPosterPreviewOpen(false)}
        size="large"
        title={text.posterPreviewTitle}
      >
        <div className="owner-poster-preview">
          {isPosterPreviewLoading ? (
            <p>{text.previewPosterLoading}</p>
          ) : posterPreviewUrl ? (
            <img
              alt={text.posterPreviewTitle}
              className="owner-poster-preview-image"
              src={posterPreviewUrl}
            />
          ) : (
            <p>{text.downloadQrFailed}</p>
          )}
        </div>
      </PeepssModal>

      {!isJobBoardPilotPaused && (
        <>
          <div className="owner-job-primary-action">
            <button
              className={`owner-job-create-card${isCreating ? ' is-active' : ''}`}
              type="button"
              aria-expanded={isCreating}
              onClick={startCreating}
            >
              <span className="owner-job-create-card-title">{text.createJob}</span>
              <span className="owner-job-create-card-icon" aria-hidden="true">
                +
              </span>
            </button>
          </div>

          {isCreating && (
            <form
              className="owner-job-form owner-step-card"
              onSubmit={handleSubmit}
            >
              <button
                className="owner-form-close-button peepss-close-button"
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
                  <p>{jobStep === 4 ? text.contactHint : text.boardHint}</p>
                </div>
              </div>
              <p className="form-compliance-note">{text.jobComplianceNotice}</p>

              {jobStep === 1 && (
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
              )}

              {jobStep === 2 && (
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
              )}

              {jobStep === 3 && (
                <>
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
                        : text.createJob
                      : text.next}
                </button>
              </div>
            </form>
          )}
        </>
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

      <section className="owner-job-list-section owner-job-board-muted">
        <div className="owner-list-heading">
          <div>
            <h2>{text.jobBoard}</h2>
            <p>{text.jobBoardSoon}</p>
          </div>
          <span>{text.comingSoon}</span>
        </div>
        <p className="owner-job-board-coming-soon-copy">
          {text.jobBoardPilotHint}
        </p>

        {jobs.length > 0 ? (
          <div className="owner-job-list owner-job-board-list">
            {jobs.map((job) => renderJobCard(job))}
          </div>
        ) : (
          <p className="owner-empty-small">{text.emptyJobs}</p>
        )}
      </section>
    </section>
  )
}

export default OwnerJobsPage
