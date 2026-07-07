import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import {
  getOwnerProfile,
  saveOwnerProfile,
} from '../services/ownerApi'
import type { OwnerProfileInput } from '../types/owner'

const emptyProfile: OwnerProfileInput = {
  restaurantName: '',
  contactPerson: '',
  phoneNumber: '',
  whatsappNumber: '',
  city: '',
  street: '',
  description: '',
}

function OwnerProfilePage() {
  const navigate = useNavigate()
  const { direction, language } = useRestaurantLanguage()
  const [form, setForm] = useState<OwnerProfileInput>(emptyProfile)
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const text = {
    title:
      language === 'he' ? 'פרופיל המסעדה שלך' : 'Your restaurant profile',
    subtitle:
      language === 'he'
        ? 'נשתמש בזה כדי לפרסם משרות ברורות ומהירות.'
        : 'We use this to publish clear, fast job posts.',
    loading:
      language === 'he'
        ? 'טוען פרופיל מסעדה...'
        : 'Loading restaurant profile...',
    back: language === 'he' ? 'חזרה' : 'Back',
    next: language === 'he' ? 'הבא' : 'Next',
    finish:
      language === 'he' ? 'שמור והמשך למשרות' : 'Save and continue to jobs',
    saving: language === 'he' ? 'שומר...' : 'Saving...',
    saved:
      language === 'he'
        ? 'פרופיל המסעדה נשמר.'
        : 'Restaurant profile saved.',
    step: language === 'he' ? 'שלב' : 'Step',
  }

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      try {
        const profile = await getOwnerProfile()

        if (isActive && profile) {
          setForm({
            restaurantName: profile.restaurantName,
            contactPerson: profile.contactPerson,
            phoneNumber: profile.phoneNumber,
            whatsappNumber: profile.whatsappNumber,
            city: profile.city,
            street: profile.street,
            description: profile.description,
          })
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

  function updateField(field: keyof OwnerProfileInput, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
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
      const savedProfile = await saveOwnerProfile(form)

      setForm({
        restaurantName: savedProfile.restaurantName,
        contactPerson: savedProfile.contactPerson,
        phoneNumber: savedProfile.phoneNumber,
        whatsappNumber: savedProfile.whatsappNumber,
        city: savedProfile.city,
        street: savedProfile.street,
        description: savedProfile.description,
      })
      setSuccess(text.saved)
      navigate('/owner/jobs')
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
      <section className="owner-profile-page" dir={direction}>
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
    <section className="owner-profile-page" dir={direction}>
      <div className="page-header">
        <div>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
      </div>

      <form
        className="owner-profile-form guided-form"
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
                  ? 'ספר לנו על המסעדה'
                  : 'Tell us about the restaurant'}
              </h2>
            </div>

            <label>
              {language === 'he' ? 'שם המסעדה' : 'Restaurant name'}
              <input
                value={form.restaurantName}
                onChange={(event) =>
                  updateField('restaurantName', event.target.value)
                }
              />
            </label>

            <label>
              {language === 'he' ? 'איש קשר' : 'Contact person'}
              <input
                value={form.contactPerson}
                onChange={(event) =>
                  updateField('contactPerson', event.target.value)
                }
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <div className="guided-form-heading">
              <h2>
                {language === 'he'
                  ? 'איפה ואיך יוצרים קשר?'
                  : 'Where and how do workers contact you?'}
              </h2>
            </div>

            <label>
              {language === 'he' ? 'טלפון' : 'Phone number'}
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={(event) =>
                  updateField('phoneNumber', event.target.value)
                }
              />
            </label>

            <label>
              {language === 'he' ? 'וואטסאפ' : 'WhatsApp number'}
              <input
                type="tel"
                value={form.whatsappNumber}
                onChange={(event) =>
                  updateField('whatsappNumber', event.target.value)
                }
              />
            </label>

            <label>
              {language === 'he' ? 'עיר' : 'City'}
              <input
                value={form.city}
                onChange={(event) => updateField('city', event.target.value)}
              />
            </label>

            <label>
              {language === 'he' ? 'רחוב' : 'Street'}
              <input
                value={form.street}
                onChange={(event) =>
                  updateField('street', event.target.value)
                }
              />
            </label>
          </>
        )}

        {step === 3 && (
          <>
            <div className="guided-form-heading">
              <h2>
                {language === 'he'
                  ? 'מה הסגנון של המקום?'
                  : 'What is the vibe of the place?'}
              </h2>
            </div>

            <label className="owner-field-wide">
              {language === 'he' ? 'תיאור קצר' : 'Short description'}
              <textarea
                rows={5}
                value={form.description}
                onChange={(event) =>
                  updateField('description', event.target.value)
                }
              />
            </label>
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
            {isSaving ? text.saving : step === 3 ? text.finish : text.next}
          </button>
        </div>
      </form>
    </section>
  )
}

export default OwnerProfilePage
