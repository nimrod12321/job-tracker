import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import RestaurantLanguageToggle from '../components/RestaurantLanguageToggle'
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

type RestaurantProfileForm = {
  fullName: string
  phoneNumber: string
  location: string
  wantedRoles: RestaurantRole[]
  experienceText: string
  availability: string
  age: string
}

const emptyProfile: RestaurantProfileForm = {
  fullName: '',
  phoneNumber: '',
  location: '',
  wantedRoles: [],
  experienceText: '',
  availability: '',
  age: '',
}

const experienceOptions = [
  {
    he: 'אין ניסיון',
    en: 'No experience',
  },
  {
    he: 'עד שנה',
    en: 'Up to 1 year',
  },
  {
    he: '1–3 שנים',
    en: '1–3 years',
  },
  {
    he: 'מעל 3 שנים',
    en: '3+ years',
  },
]

const availabilityOptions = [
  {
    he: 'בוקר',
    en: 'Morning',
  },
  {
    he: 'ערב',
    en: 'Evening',
  },
  {
    he: 'סופי שבוע',
    en: 'Weekends',
  },
  {
    he: 'גמיש',
    en: 'Flexible',
  },
]

function profileToForm(
  profile: RestaurantWorkerProfile,
): RestaurantProfileForm {
  return {
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber,
    location: profile.location,
    wantedRoles: profile.wantedRoles,
    experienceText: profile.experienceText,
    availability: profile.availability,
    age: profile.age === 0 ? '' : String(profile.age),
  }
}

function RestaurantProfilePage() {
  const navigate = useNavigate()
  const { direction, language } = useRestaurantLanguage()
  const [form, setForm] = useState<RestaurantProfileForm>(emptyProfile)
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const text = {
    title: language === 'he' ? 'בונים את הפרופיל שלך' : 'Build your profile',
    subtitle:
      language === 'he'
        ? 'שלוש שאלות קצרות, ואז נציג לך משמרות מתאימות.'
        : 'Three quick steps, then we will show you relevant shifts.',
    loading: language === 'he' ? 'טוען פרופיל...' : 'Loading profile...',
    back: language === 'he' ? 'חזרה' : 'Back',
    next: language === 'he' ? 'הבא' : 'Next',
    start: language === 'he' ? 'יאללה, מתחילים' : "Let's start",
    saving: language === 'he' ? 'שומר...' : 'Saving...',
    saved: language === 'he' ? 'הפרופיל נשמר.' : 'Profile saved.',
    step: language === 'he' ? 'שלב' : 'Step',
    optional: language === 'he' ? 'לא חובה' : 'Optional',
  }

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      try {
        const profile = await getRestaurantProfile()

        if (isActive && profile) {
          setForm(profileToForm(profile))
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error
              ? error.message
              : 'Failed to load restaurant profile',
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
    field: Exclude<keyof RestaurantProfileForm, 'wantedRoles'>,
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

  function toggleTextChoice(
    field: 'availability' | 'experienceText',
    value: string,
  ) {
    setForm((currentForm) => {
      const currentValues = currentForm[field]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value]

      return {
        ...currentForm,
        [field]: nextValues.join(', '),
      }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (step < 3) {
      setStep((currentStep) => currentStep + 1)
      return
    }

    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const profile = await saveRestaurantProfile({
        ...form,
        age: Number(form.age) || 0,
      })

      setForm(profileToForm(profile))
      setSuccess(text.saved)
      navigate('/restaurant/explore')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to save restaurant profile',
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
          <RestaurantLanguageToggle />
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
        <RestaurantLanguageToggle />
      </div>

      <form
        className="restaurant-profile-form guided-form"
        onSubmit={handleSubmit}
      >
        <div className="guided-form-progress">
          <span>
            {text.step} {step}/3
          </span>
          <div>
            {[1, 2, 3].map((currentStep) => (
              <span
                className={currentStep <= step ? 'active' : ''}
                key={currentStep}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <>
            <div className="guided-form-heading">
              <h2>
                {language === 'he'
                  ? 'איך קוראים לך?'
                  : 'What should we call you?'}
              </h2>
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
              {language === 'he' ? 'טלפון' : 'Phone number'}
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={(event) =>
                  updateTextField('phoneNumber', event.target.value)
                }
              />
            </label>

            <label>
              {language === 'he' ? `גיל (${text.optional})` : `Age (${text.optional})`}
              <input
                type="number"
                min="0"
                max="120"
                value={form.age}
                onChange={(event) =>
                  updateTextField('age', event.target.value)
                }
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <div className="guided-form-heading">
              <h2>{language === 'he' ? 'איפה ומה?' : 'Where and what?'}</h2>
            </div>

            <label className="restaurant-field-wide">
              {language === 'he'
                ? 'איפה תרצה לעבוד?'
                : 'Where do you want to work?'}
              <input
                value={form.location}
                onChange={(event) =>
                  updateTextField('location', event.target.value)
                }
                placeholder={language === 'he' ? 'תל אביב' : 'Tel Aviv'}
              />
            </label>

            <fieldset className="restaurant-role-options">
              <legend>
                {language === 'he' ? 'מה אתה עושה?' : 'What roles are you looking for?'}
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
          </>
        )}

        {step === 3 && (
          <>
            <div className="guided-form-heading">
              <h2>
                {language === 'he'
                  ? 'כמה ניסיון יש לך?'
                  : 'How much experience do you have?'}
              </h2>
            </div>

            <fieldset className="restaurant-role-options">
              <legend>
                {language === 'he' ? 'ניסיון' : 'Experience'}
              </legend>
              <div>
                {experienceOptions.map((option) => {
                  const label = option[language]

                  return (
                    <label key={label}>
                      <input
                        type="checkbox"
                        checked={form.experienceText.includes(label)}
                        onChange={() =>
                          toggleTextChoice('experienceText', label)
                        }
                      />
                      <span>{label}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <label className="restaurant-field-wide">
              {language === 'he' ? 'ניסיון נוסף' : 'Extra experience notes'}
              <textarea
                rows={4}
                value={form.experienceText}
                onChange={(event) =>
                  updateTextField('experienceText', event.target.value)
                }
                placeholder={
                  language === 'he'
                    ? 'אפשר להוסיף בקצרה איפה עבדת ומה עשית'
                    : 'Add a short summary of where you worked and what you did'
                }
              />
            </label>

            <fieldset className="restaurant-role-options">
              <legend>{language === 'he' ? 'זמינות' : 'Availability'}</legend>
              <div>
                {availabilityOptions.map((option) => {
                  const label = option[language]

                  return (
                    <label key={label}>
                      <input
                        type="checkbox"
                        checked={form.availability.includes(label)}
                        onChange={() =>
                          toggleTextChoice('availability', label)
                        }
                      />
                      <span>{label}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <label className="restaurant-field-wide">
              {language === 'he' ? 'זמינות חופשית' : 'Availability notes'}
              <textarea
                rows={3}
                value={form.availability}
                onChange={(event) =>
                  updateTextField('availability', event.target.value)
                }
                placeholder={
                  language === 'he'
                    ? 'לדוגמה: ערב וסופי שבוע'
                    : 'For example: evenings and weekends'
                }
              />
            </label>

            <p className="restaurant-profile-note">
              {language === 'he'
                ? 'חלק מהתפקידים דורשים גיל מתאים או ניסיון.'
                : 'Some roles may require legal age or experience.'}
            </p>
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

        <div className="guided-form-actions">
          {step > 1 && (
            <button
              className="restaurant-skip-button"
              type="button"
              onClick={() => setStep((currentStep) => currentStep - 1)}
            >
              {text.back}
            </button>
          )}
          <button type="submit" disabled={isSaving}>
            {isSaving ? text.saving : step === 3 ? text.start : text.next}
          </button>
        </div>
      </form>
    </section>
  )
}

export default RestaurantProfilePage
