import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../../auth/services/authApi'
import { getAuthToken } from '../../auth/utils/authStorage'
import {
  getRestaurantProfile,
  saveRestaurantProfile,
} from '../services/restaurantApi'
import {
  RESTAURANT_ROLES,
  getRestaurantRoleLabel,
  type RestaurantRole,
  type RestaurantWorkerProfile,
} from '../types/restaurant'
import { useRestaurantLanguage } from '../utils/restaurantLanguage'
import { formatIsraeliPhoneForDisplay } from '../../../utils/phoneDisplay'
import VerifiedAddressAutocomplete from '../../../components/location/VerifiedAddressAutocomplete'

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
  }
}

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
  const { direction, language } = useRestaurantLanguage()
  const [form, setForm] = useState<RestaurantProfileForm>(emptyProfile)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
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
    extraDetails: language === 'he' ? 'פרטים נוספים' : 'Extra details',
    locationTitle: language === 'he' ? 'מיקום' : 'Location',
    locationQuestion:
      language === 'he'
        ? 'באיזה רחוב אתם גרים?'
        : 'What street do you live on?',
    locationHelp:
      language === 'he'
        ? 'המיקום המשוער משמש להצגת משרות קרובות. המסעדות לא יראו אותו.'
        : 'We use your approximate location to show jobs near you. Restaurants will not see it.',
    locationError:
      language === 'he'
        ? 'יש לבחור רחוב תקין בתל אביב-יפו.'
        : 'Choose a valid street in Tel Aviv–Yafo.',
    phoneHelp:
      language === 'he'
        ? 'זה מספר הטלפון שמסעדות ישתמשו בו כדי ליצור איתך קשר.'
        : 'This is the phone number restaurants will use to contact you.',
    requiredError:
      language === 'he'
        ? 'צריך למלא שם, טלפון, גיל 16–80, תפקיד אחד לפחות, ניסיון וזמינות.'
        : 'Fill name, phone, age 16–80, at least one role, experience and availability.',
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
            setHasVerifiedHomeLocation(Boolean(profile.homeGooglePlaceId))
            setForm((currentForm) => ({
              ...currentForm,
              ...profileToForm(profile),
              fullName: profile.fullName || user?.fullName || '',
              phoneNumber: profile.phoneNumber || user?.phoneNumber || '',
            }))
          } else {
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
      'wantedRoles' | 'availability'
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)
    setSuccess(null)

    if (!isWorkerProfileComplete(form)) {
      setError(text.requiredError)
      return
    }

    if (
      (requiresVerifiedLocation || locationWasEdited) &&
      !hasVerifiedHomeLocation
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
      })

      setForm(profileToForm(profile))
      setHasVerifiedHomeLocation(Boolean(profile.homeGooglePlaceId))
      setRequiresVerifiedLocation(profile.locationRequired)
      setLocationWasEdited(false)
      setSuccess(text.saved)
      navigate('/restaurant/explore')
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
                ? 'התחילו להקליד ובחרו רחוב'
                : 'Start typing and choose a street'
            }
            required={requiresVerifiedLocation}
            value={form.homeStreetInput}
            onInputChange={(value) => {
              updateTextField('homeStreetInput', value)
              updateTextField('homePlaceId', '')
              setHasVerifiedHomeLocation(false)
              setLocationWasEdited(true)
            }}
            onPlaceSelected={(place) => {
              updateTextField('homeStreetInput', place.formattedAddress)
              updateTextField('homePlaceId', place.placeId)
              setHasVerifiedHomeLocation(true)
              setLocationWasEdited(true)
            }}
          />
          <p className="form-helper-text worker-location-privacy">
            {text.locationHelp}
          </p>
        </section>

        <section className="worker-profile-section">
          <div className="guided-form-heading">
            <h2>{text.extraDetails}</h2>
          </div>

          <label className="restaurant-field-wide">
            {language === 'he'
              ? `עוד משהו שחשוב שמסעדות ידעו? (${text.optional})`
              : `Anything else restaurants should know? (${text.optional})`}
            <textarea
              rows={4}
              value={form.extraDetails}
              onChange={(event) =>
                updateTextField('extraDetails', event.target.value)
              }
              placeholder={
                language === 'he'
                  ? 'אפשר לספר בקצרה על ניסיון, העדפות או זמינות מיוחדת'
                  : 'Add a short note about experience, preferences or special availability'
              }
            />
          </label>

          <p className="restaurant-profile-note">
            {language === 'he'
              ? 'חלק מהתפקידים דורשים גיל מתאים או ניסיון.'
              : 'Some roles may require legal age or experience.'}
          </p>
        </section>

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
            disabled={isSaving}
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
