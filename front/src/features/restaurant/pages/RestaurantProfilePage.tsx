import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getCurrentUser } from '../../auth/services/authApi'
import { getAuthToken } from '../../auth/utils/authStorage'
import {
  getRestaurantProfile,
  saveRestaurantProfile,
} from '../services/restaurantApi'
import {
  RESTAURANT_ROLES,
  getRestaurantRoleLabel,
  type PreferredWorkArea,
  type RestaurantRole,
  type RestaurantWorkerProfile,
  type RestaurantWorkerProfileInput,
} from '../types/restaurant'
import { useRestaurantLanguage } from '../utils/restaurantLanguage'
import { formatIsraeliPhoneForDisplay } from '../../../utils/phoneDisplay'
import VerifiedAddressAutocomplete from '../../../components/location/VerifiedAddressAutocomplete'
import PreferredWorkAreaMap from '../components/PreferredWorkAreaMap'
import SmsNotificationSettings from '../../../components/settings/SmsNotificationSettings'

type RestaurantProfileForm = {
  fullName: string
  phoneNumber: string
  location: string
  homeStreetInput: string
  homePlaceId: string
  wantedRoles: RestaurantRole[]
  experienceLevel: string
  availability: string[]
  extraDetails: string
  age: string
  preferredWorkArea: PreferredWorkArea | null
}

const emptyProfile: RestaurantProfileForm = {
  fullName: '',
  phoneNumber: '',
  location: '',
  homeStreetInput: '',
  homePlaceId: '',
  wantedRoles: [],
  experienceLevel: '',
  availability: [],
  extraDetails: '',
  age: '',
  preferredWorkArea: null,
}

const experienceOptions = [
  {
    value: 'No experience',
    he: 'אין ניסיון',
    en: 'No experience',
  },
  {
    value: '1 year',
    he: 'שנה',
    en: '1 year',
  },
  {
    value: '2 years',
    he: 'שנתיים',
    en: '2 years',
  },
  {
    value: '3 years',
    he: 'שלוש שנים',
    en: '3 years',
  },
  {
    value: 'More than 3 years',
    he: 'מעל 3 שנים',
    en: 'More than 3 years',
  },
]

const availabilityOptions = [
  {
    value: 'Morning',
    he: 'בוקר',
    en: 'Morning',
  },
  {
    value: 'Afternoon',
    he: 'צהריים',
    en: 'Afternoon',
  },
  {
    value: 'Evening',
    he: 'ערב',
    en: 'Evening',
  },
  {
    value: 'Night',
    he: 'לילה',
    en: 'Night',
  },
  {
    value: 'Weekends',
    he: 'סופי שבוע',
    en: 'Weekends',
  },
  {
    value: 'Flexible',
    he: 'גמיש',
    en: 'Flexible',
  },
]

const experienceValues = experienceOptions.map((option) => option.value)

function parseExperienceText(experienceText: string) {
  const trimmedExperience = experienceText.trim()

  if (!trimmedExperience) {
    return {
      experienceLevel: '',
      extraDetails: '',
    }
  }

  const [firstPart = '', ...restParts] = trimmedExperience.split(/\n{2,}/)
  const normalizedLegacyExperience: Record<string, string> = {
    'Up to 1 year': '1 year',
    '1–3 years': '2 years',
    '3+ years': 'More than 3 years',
    'Two years': '2 years',
    'Three years': '3 years',
  }
  const experienceLevel =
    normalizedLegacyExperience[firstPart.trim()] ?? firstPart.trim()

  if (experienceValues.includes(experienceLevel)) {
    return {
      experienceLevel,
      extraDetails: restParts.join('\n\n').trim(),
    }
  }

  return {
    experienceLevel: '',
    extraDetails: trimmedExperience,
  }
}

function serializeExperienceText(form: RestaurantProfileForm) {
  return [form.experienceLevel, form.extraDetails.trim()]
    .filter(Boolean)
    .join('\n\n')
}

function parseAvailability(availability: string) {
  const allowedValues = new Set(
    availabilityOptions.map((option) => option.value),
  )

  return availability
    .split(',')
    .map((value) => value.trim())
    .filter((value) => allowedValues.has(value))
}

function profileToForm(
  profile: RestaurantWorkerProfile,
): RestaurantProfileForm {
  const parsedExperience = parseExperienceText(profile.experienceText)

  return {
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber,
    location: profile.location,
    homeStreetInput:
      profile.homeAreaFormatted || profile.homeStreetName || profile.location,
    homePlaceId: '',
    wantedRoles: profile.wantedRoles,
    experienceLevel: parsedExperience.experienceLevel,
    availability: parseAvailability(profile.availability),
    extraDetails: parsedExperience.extraDetails,
    age: profile.age === 0 ? '' : String(profile.age),
    preferredWorkArea: profile.preferredWorkArea,
  }
}

function profileToInput(
  profile: RestaurantWorkerProfile,
  preferredWorkArea: PreferredWorkArea | null,
): RestaurantWorkerProfileInput {
  return {
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber,
    location: profile.location,
    wantedRoles: profile.wantedRoles,
    experienceText: profile.experienceText,
    availability: profile.availability,
    age: profile.age,
    preferredWorkArea,
  }
}

type WorkAreaSaveState =
  | 'clean'
  | 'dirty'
  | 'saving'
  | 'persisted'
  | 'saved'
  | 'confirmed'
  | 'error'

function isWorkerProfileComplete(form: RestaurantProfileForm) {
  const age = Number(form.age)

  return Boolean(
    form.fullName.trim() &&
      form.phoneNumber.trim() &&
      Number.isInteger(age) &&
      age >= 16 &&
      age <= 80 &&
      form.wantedRoles.length > 0 &&
      form.experienceLevel &&
      form.availability.length > 0,
  )
}

function RestaurantProfilePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { direction, language } = useRestaurantLanguage()
  const requestedRole = RESTAURANT_ROLES.find(
    (role) => role.value === searchParams.get('role'),
  )?.value
  const [form, setForm] = useState<RestaurantProfileForm>(emptyProfile)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [persistedProfile, setPersistedProfile] =
    useState<RestaurantWorkerProfile | null>(null)
  const [hasExistingProfile, setHasExistingProfile] = useState(false)
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false)
  const [workAreaDraft, setWorkAreaDraft] =
    useState<PreferredWorkArea | null>(null)
  const [workAreaSaveState, setWorkAreaSaveState] =
    useState<WorkAreaSaveState>('clean')
  const [workAreaError, setWorkAreaError] = useState<string | null>(null)
  const [hasVerifiedHomeLocation, setHasVerifiedHomeLocation] =
    useState(false)
  const [locationWasEdited, setLocationWasEdited] = useState(false)
  const [requiresVerifiedLocation, setRequiresVerifiedLocation] =
    useState(true)

  const text = {
    title:
      language === 'he'
        ? 'השלמת פרופיל עובד'
        : 'Complete your worker profile',
    subtitle:
      language === 'he'
        ? 'כמה פרטים קצרים כדי שנוכל להציג לך משרות מתאימות.'
        : 'A few quick details so we can show you matching jobs.',
    loading: language === 'he' ? 'טוען פרופיל...' : 'Loading profile...',
    saving: language === 'he' ? 'שומר...' : 'Saving...',
    saved: language === 'he' ? 'הפרופיל נשמר.' : 'Profile saved.',
    optional: language === 'he' ? 'לא חובה' : 'Optional',
    save: language === 'he' ? 'שמירת פרופיל' : 'Save profile',
    personalDetails: language === 'he' ? 'פרטים אישיים' : 'Personal details',
    jobPreferences: language === 'he' ? 'העדפות עבודה' : 'Job preferences',
    preferenceUpdateHint:
      requestedRole
        ? language === 'he'
          ? `כדי להגיש למשרת ${getRestaurantRoleLabel(requestedRole, 'he')}, הוסיפו את התפקיד להעדפות ושמרו.`
          : `To apply for ${getRestaurantRoleLabel(requestedRole, 'en')}, add the role to your preferences and save.`
        : '',
    extraDetails: language === 'he' ? 'פרטים נוספים' : 'Extra details',
    locationTitle: language === 'he' ? 'מיקום' : 'Location',
    locationQuestion:
      language === 'he'
        ? 'מה הכתובת שלכם?'
        : 'What is your address?',
    locationHelp:
      language === 'he'
        ? 'בחרו כתובת מהרשימה. אנחנו שומרים רק את הרחוב כדי להציג משרות קרובות.'
        : 'Choose an address from the list. We save only the street to show nearby jobs.',
    preferredWorkAreaTitle:
      language === 'he' ? 'אזור עבודה מועדף' : 'Preferred work area',
    preferredWorkAreaHelp:
      language === 'he'
        ? 'לא חובה. בחרו אזור רק אם תרצו לצמצם את המשרות שמופיעות בהחלקה.'
        : 'Optional. Choose an area only if you want to narrow the jobs shown in Swipe.',
    locationError:
      language === 'he'
        ? 'בחרו כתובת מהרשימה. אנחנו נשמור רק את הרחוב.'
        : 'Choose an address from the list. We will save only the street.',
    phoneHelp:
      language === 'he'
        ? 'זה מספר הטלפון שמסעדות ישתמשו בו כדי ליצור איתך קשר.'
        : 'This is the phone number restaurants will use to contact you.',
    requiredError:
      language === 'he'
        ? 'צריך למלא שם, טלפון, גיל 16–80, תפקיד אחד לפחות, ניסיון וזמינות.'
        : 'Fill name, phone, age 16–80, at least one role, experience and availability.',
    saveWorkArea:
      language === 'he' ? 'שמירת אזור עבודה' : 'Save work area',
    confirmWorkArea:
      language === 'he' ? 'אישור אזור עבודה' : 'Confirm work area',
    savingWorkArea:
      language === 'he' ? 'שומר אזור...' : 'Saving area...',
    workAreaUnsaved:
      language === 'he'
        ? 'יש שינויים באזור העבודה שעדיין לא נשמרו.'
        : 'Your work area has unsaved changes.',
    workAreaSaved:
      language === 'he'
        ? 'אזור העבודה נשמר בהצלחה.'
        : 'Work area saved successfully.',
    workAreaPersisted:
      language === 'he'
        ? 'זה אזור העבודה השמור שלכם.'
        : 'This is your saved work area.',
    workAreaRemoved:
      language === 'he'
        ? 'אזור העבודה הוסר בהצלחה.'
        : 'Work area removed successfully.',
    workAreaConfirmed:
      language === 'he'
        ? 'האזור אושר ויישמר כשתשמרו את הפרופיל.'
        : 'Area confirmed. It will be saved when you save your profile.',
    workAreaSaveError:
      language === 'he'
        ? 'לא הצלחנו לשמור את אזור העבודה. נסו שוב.'
        : 'We could not save the work area. Please try again.',
  }

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      try {
        const token = getAuthToken()
        const [profile, user] = await Promise.all([
          getRestaurantProfile(),
          token ? getCurrentUser(token).catch(() => null) : Promise.resolve(null),
        ])

        if (isActive) {
          setRequiresVerifiedLocation(
            profile?.locationRequired ??
              user?.workerLocationRequired ??
              true,
          )

          if (profile) {
            setPersistedProfile(profile)
            setHasExistingProfile(true)
            setShowNotificationSettings(true)
            setWorkAreaDraft(profile.preferredWorkArea)
            setWorkAreaSaveState(
              profile.preferredWorkArea ? 'persisted' : 'clean',
            )
            setHasVerifiedHomeLocation(Boolean(profile.homeGooglePlaceId))
            setForm((currentForm) => ({
              ...currentForm,
              ...profileToForm(profile),
              fullName: profile.fullName || user?.fullName || '',
              phoneNumber: profile.phoneNumber || user?.phoneNumber || '',
            }))
          } else {
            setPersistedProfile(null)
            setHasExistingProfile(false)
            setShowNotificationSettings(false)
            setWorkAreaDraft(null)
            setWorkAreaSaveState('clean')
            setForm((currentForm) => ({
              ...currentForm,
              fullName: user?.fullName ?? '',
              phoneNumber: user?.phoneNumber ?? '',
            }))
          }
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error
              ? error.message
              : 'Failed to load worker profile',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isActive = false
    }
  }, [])

  function updateTextField(
    field: Exclude<
      keyof RestaurantProfileForm,
      'wantedRoles' | 'availability' | 'preferredWorkArea'
    >,
    value: string,
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function toggleRole(role: RestaurantRole) {
    setForm((currentForm) => ({
      ...currentForm,
      wantedRoles: currentForm.wantedRoles.includes(role)
        ? currentForm.wantedRoles.filter(
            (currentRole) => currentRole !== role,
          )
        : [...currentForm.wantedRoles, role],
    }))
  }

  function toggleAvailability(value: string) {
    setForm((currentForm) => {
      const nextAvailability = currentForm.availability.includes(value)
        ? currentForm.availability.filter((item) => item !== value)
        : [...currentForm.availability, value]

      return {
        ...currentForm,
        availability: nextAvailability,
      }
    })
  }

  function handleWorkAreaDraftChange(
    preferredWorkArea: PreferredWorkArea | null,
  ) {
    setWorkAreaDraft(preferredWorkArea)
    setWorkAreaError(null)
    setWorkAreaSaveState('dirty')

    if (hasExistingProfile) {
      setForm((currentForm) => ({
        ...currentForm,
        preferredWorkArea,
      }))
    }
  }

  async function handleWorkAreaSave() {
    setWorkAreaError(null)

    if (!hasExistingProfile) {
      setForm((currentForm) => ({
        ...currentForm,
        preferredWorkArea: workAreaDraft,
      }))
      setWorkAreaSaveState('confirmed')
      return
    }

    if (!persistedProfile) {
      setWorkAreaError(text.workAreaSaveError)
      setWorkAreaSaveState('error')
      return
    }

    setWorkAreaSaveState('saving')

    try {
      const profile = await saveRestaurantProfile(
        profileToInput(persistedProfile, workAreaDraft),
      )

      setPersistedProfile(profile)
      setWorkAreaDraft(profile.preferredWorkArea)
      setForm((currentForm) => ({
        ...currentForm,
        preferredWorkArea: profile.preferredWorkArea,
      }))
      setWorkAreaSaveState('saved')
    } catch (error) {
      setWorkAreaError(
        error instanceof Error ? error.message : text.workAreaSaveError,
      )
      setWorkAreaSaveState('error')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)
    setSuccess(null)

    if (!isWorkerProfileComplete(form)) {
      setError(text.requiredError)
      return
    }

    const hasSelectedOrSavedHomeLocation =
      Boolean(form.homePlaceId) ||
      (!locationWasEdited && hasVerifiedHomeLocation)

    if (
      (requiresVerifiedLocation || locationWasEdited) &&
      !hasSelectedOrSavedHomeLocation
    ) {
      setError(text.locationError)
      return
    }

    setIsSaving(true)

    try {
      const profile = await saveRestaurantProfile({
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        location: form.location.trim(),
        ...(form.homePlaceId ? { homePlaceId: form.homePlaceId } : {}),
        wantedRoles: form.wantedRoles,
        experienceText: serializeExperienceText(form),
        availability: form.availability.join(', '),
        age: Number(form.age) || 0,
        preferredWorkArea: form.preferredWorkArea,
      })

      setPersistedProfile(profile)
      setHasExistingProfile(true)
      setWorkAreaDraft(profile.preferredWorkArea)
      setWorkAreaSaveState('saved')
      setForm(profileToForm(profile))
      setHasVerifiedHomeLocation(Boolean(profile.homeGooglePlaceId))
      setRequiresVerifiedLocation(profile.locationRequired)
      setLocationWasEdited(false)
      setSuccess(text.saved)
      const requestedReturnTo = searchParams.get('returnTo')
      const safeReturnTo =
        requestedReturnTo?.startsWith('/restaurant/restaurants/')
          ? requestedReturnTo
          : '/restaurant/explore'

      navigate(safeReturnTo)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to save worker profile',
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section className="restaurant-profile-page" dir={direction}>
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

  return (
    <section className="restaurant-profile-page" dir={direction}>
      <div className="page-header">
        <div>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
      </div>

      <form
        className="restaurant-profile-form guided-form"
        onSubmit={handleSubmit}
      >
        <section className="worker-profile-section">
          <div className="guided-form-heading">
            <h2>{text.personalDetails}</h2>
          </div>

          <label>
            {language === 'he' ? 'שם מלא' : 'Full name'}
            <input
              value={form.fullName}
              onChange={(event) =>
                updateTextField('fullName', event.target.value)
              }
            />
          </label>

          <label>
            {language === 'he' ? 'מספר טלפון' : 'Phone number'}
            <input
              readOnly
              type="tel"
              value={formatIsraeliPhoneForDisplay(form.phoneNumber)}
            />
            <span className="form-helper-text">{text.phoneHelp}</span>
          </label>

          <label>
            {language === 'he' ? 'גיל' : 'Age'}
            <input
              type="number"
              min="16"
              max="80"
              value={form.age}
              onChange={(event) =>
                updateTextField('age', event.target.value)
              }
            />
          </label>
        </section>

        <section className="worker-profile-section">
          <div className="guided-form-heading">
            <h2>{text.jobPreferences}</h2>
          </div>

          {text.preferenceUpdateHint && (
            <p className="form-helper-text restaurant-preference-update-hint">
              {text.preferenceUpdateHint}
            </p>
          )}

          <fieldset className="restaurant-role-options">
            <legend>
              {language === 'he'
                ? 'איזה תפקידים מעניינים אותך?'
                : 'What roles are you looking for?'}
            </legend>
            <div>
              {RESTAURANT_ROLES.map((role) => (
                <label key={role.value}>
                  <input
                    type="checkbox"
                    checked={form.wantedRoles.includes(role.value)}
                    onChange={() => toggleRole(role.value)}
                  />
                  <span>{getRestaurantRoleLabel(role.value, language)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="restaurant-role-options">
            <legend>{language === 'he' ? 'ניסיון' : 'Experience'}</legend>
            <div>
              {experienceOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="experienceLevel"
                    checked={form.experienceLevel === option.value}
                    onChange={() =>
                      updateTextField('experienceLevel', option.value)
                    }
                  />
                  <span>{option[language]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="restaurant-role-options">
            <legend>{language === 'he' ? 'זמינות' : 'Availability'}</legend>
            <div>
              {availabilityOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="checkbox"
                    checked={form.availability.includes(option.value)}
                    onChange={() => toggleAvailability(option.value)}
                  />
                  <span>{option[language]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="worker-profile-section worker-location-section">
          <div className="guided-form-heading">
            <h2>{text.locationTitle}</h2>
          </div>
          <VerifiedAddressAutocomplete
            language={language}
            label={text.locationQuestion}
            mode="workerStreet"
            placeholder={
              language === 'he'
                ? 'הקלידו כתובת ובחרו מהרשימה'
                : 'Type an address and choose it from the list'
            }
            required={requiresVerifiedLocation}
            value={form.homeStreetInput}
            onInputChange={(value) => {
              setForm((currentForm) => ({
                ...currentForm,
                homeStreetInput: value,
                homePlaceId: '',
              }))
              setHasVerifiedHomeLocation(false)
              setLocationWasEdited(true)
            }}
            onPlaceSelected={(place) => {
              setForm((currentForm) => ({
                ...currentForm,
                homeStreetInput: place.formattedAddress,
                homePlaceId: place.placeId,
              }))
              setHasVerifiedHomeLocation(true)
              setLocationWasEdited(true)
            }}
          />
          <p className="form-helper-text worker-location-privacy">
            {text.locationHelp}
          </p>
        </section>

        <section className="worker-profile-section preferred-work-area-section">
          <div className="guided-form-heading">
            <h2>{text.preferredWorkAreaTitle}</h2>
            <span className="worker-optional-label">{text.optional}</span>
          </div>
          <p className="form-helper-text">{text.preferredWorkAreaHelp}</p>
          <PreferredWorkAreaMap
            language={language}
            value={workAreaDraft}
            onChange={handleWorkAreaDraftChange}
          />
          <div className="preferred-work-area-save-row">
            <button
              type="button"
              className="ui-button ui-button--secondary"
              disabled={
                isSaving ||
                workAreaSaveState === 'saving' ||
                workAreaSaveState === 'clean' ||
                workAreaSaveState === 'persisted' ||
                workAreaSaveState === 'saved' ||
                workAreaSaveState === 'confirmed'
              }
              aria-busy={workAreaSaveState === 'saving'}
              onClick={() => void handleWorkAreaSave()}
            >
              {workAreaSaveState === 'saving'
                ? text.savingWorkArea
                : hasExistingProfile
                  ? text.saveWorkArea
                  : text.confirmWorkArea}
            </button>
            <p
              className={`preferred-work-area-save-status preferred-work-area-save-status--${workAreaSaveState}`}
              aria-live="polite"
            >
              {workAreaSaveState === 'dirty'
                ? text.workAreaUnsaved
                : workAreaSaveState === 'persisted'
                  ? text.workAreaPersisted
                  : workAreaSaveState === 'saved'
                    ? workAreaDraft
                      ? text.workAreaSaved
                      : text.workAreaRemoved
                    : workAreaSaveState === 'confirmed'
                      ? text.workAreaConfirmed
                      : ''}
            </p>
          </div>
          {workAreaError && (
            <p className="message message-error preferred-work-area-save-error" role="alert">
              {workAreaError}
            </p>
          )}
        </section>

        <section className="worker-profile-section worker-extra-details-section">
          <div className="guided-form-heading">
            <h2>{text.extraDetails}</h2>
          </div>

          <label className="restaurant-field-wide">
            <span className="worker-extra-details-label">
              <span>
                {language === 'he'
                  ? 'עוד משהו שחשוב שמסעדות ידעו?'
                  : 'Anything else restaurants should know?'}
              </span>
              <span className="worker-optional-label">{text.optional}</span>
            </span>
            <span className="worker-extra-details-input-wrap">
              <textarea
                className="worker-extra-details-input"
                dir={direction}
                lang={language}
                rows={4}
                wrap="soft"
                value={form.extraDetails}
                onChange={(event) =>
                  updateTextField('extraDetails', event.target.value)
                }
              />
              {!form.extraDetails && (
                <span
                  className="worker-extra-details-placeholder"
                  dir={direction}
                  aria-hidden="true"
                >
                  {language === 'he'
                    ? 'ספרו בקצרה על הניסיון שלכם'
                    : 'Tell us briefly about your experience'}
                </span>
              )}
            </span>
          </label>

          <p className="restaurant-profile-note">
            {language === 'he'
              ? 'חלק מהתפקידים דורשים גיל מתאים או ניסיון קודם.'
              : 'Some roles may require legal age or experience.'}
          </p>
        </section>

        {showNotificationSettings && (
          <SmsNotificationSettings className="worker-profile-section" />
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

        <div className="guided-form-actions worker-profile-actions">
          <button
            className="ui-button ui-button--primary"
            type="submit"
            disabled={isSaving || workAreaSaveState === 'saving'}
            aria-busy={isSaving}
          >
            {isSaving ? text.saving : text.save}
          </button>
        </div>
      </form>
    </section>
  )
}

export default RestaurantProfilePage
