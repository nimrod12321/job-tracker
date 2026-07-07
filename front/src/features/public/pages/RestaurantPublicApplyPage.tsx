import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import RestaurantLanguageToggle from '../../restaurant/components/RestaurantLanguageToggle'
import {
  RESTAURANT_ROLES,
  getRestaurantRoleLabel,
  type RestaurantRole,
} from '../../restaurant/types/restaurant'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import {
  getPublicRestaurant,
  submitPublicRestaurantLead,
  type PublicRestaurant,
} from '../services/publicRestaurantApi'

const experienceOptions = {
  he: ['אין ניסיון', 'עד שנה', '1–3 שנים', 'מעל 3 שנים'],
  en: ['No experience', 'Up to 1 year', '1–3 years', 'More than 3 years'],
}
const availabilityOptions = {
  he: ['בוקר', 'ערב', 'סופי שבוע', 'גמיש'],
  en: ['Morning', 'Evening', 'Weekends', 'Flexible'],
}

function RestaurantPublicApplyPage() {
  const { restaurantSlug = '' } = useParams()
  const { direction, language } = useRestaurantLanguage()
  const [restaurant, setRestaurant] = useState<PublicRestaurant | null>(null)
  const [step, setStep] = useState(1)
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [wantedRoles, setWantedRoles] = useState<RestaurantRole[]>([])
  const [experienceText, setExperienceText] = useState('')
  const [availability, setAvailability] = useState('')
  const [age, setAge] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const text = {
    loading: language === 'he' ? 'טוען מסעדה...' : 'Loading restaurant...',
    notFound:
      language === 'he' ? 'לא מצאנו את המסעדה.' : 'Restaurant not found.',
    stepOneTitle:
      language === 'he' ? 'איך קוראים לך?' : 'What should we call you?',
    fullName: language === 'he' ? 'שם מלא' : 'Full name',
    phone: language === 'he' ? 'טלפון' : 'Phone',
    stepTwoTitle:
      language === 'he'
        ? 'איזה תפקידים מעניינים אותך?'
        : 'Which roles are you interested in?',
    stepThreeTitle:
      language === 'he' ? 'ניסיון וזמינות' : 'Experience and availability',
    experience: language === 'he' ? 'ניסיון' : 'Experience',
    availability: language === 'he' ? 'זמינות' : 'Availability',
    age: language === 'he' ? 'גיל (לא חובה)' : 'Age (optional)',
    next: language === 'he' ? 'הבא' : 'Next',
    back: language === 'he' ? 'חזרה' : 'Back',
    submit: language === 'he' ? 'שלח פרטים' : 'Submit application',
    submitting: language === 'he' ? 'שולח...' : 'Submitting...',
    success:
      language === 'he'
        ? 'הפרטים נשלחו למסעדה. אם זה מתאים, יחזרו אליך.'
        : 'Your application was sent to the restaurant. If it fits, they will contact you.',
    noLogin:
      language === 'he'
        ? 'לא צריך להירשם — רק להשאיר פרטים קצרים.'
        : 'No registration needed — just leave a few details.',
  }

  useEffect(() => {
    let isActive = true

    async function loadRestaurant() {
      try {
        const nextRestaurant = await getPublicRestaurant(restaurantSlug)

        if (isActive) {
          setRestaurant(nextRestaurant)
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error ? error.message : 'Failed to load restaurant',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadRestaurant()

    return () => {
      isActive = false
    }
  }, [restaurantSlug])

  function toggleRole(role: RestaurantRole) {
    setWantedRoles((currentRoles) =>
      currentRoles.includes(role)
        ? currentRoles.filter((currentRole) => currentRole !== role)
        : [...currentRoles, role],
    )
  }

  function validateCurrentStep() {
    if (step === 1) {
      return fullName.trim() && phoneNumber.trim()
    }

    if (step === 2) {
      return wantedRoles.length > 0
    }

    return true
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (step < 3) {
      if (!validateCurrentStep()) {
        setError(
          language === 'he'
            ? 'צריך להשלים את השדות בשלב הזה.'
            : 'Please complete this step.',
        )
        return
      }

      setStep((currentStep) => currentStep + 1)
      return
    }

    setIsSubmitting(true)

    try {
      await submitPublicRestaurantLead(restaurantSlug, {
        fullName,
        phoneNumber,
        wantedRoles,
        experienceText,
        availability,
        age: age ? Number(age) : undefined,
      })
      setIsSubmitted(true)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to submit application',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <section className="public-apply-page" dir={direction}>
        <div className="public-apply-card">
          <p className="status-message">{text.loading}</p>
        </div>
      </section>
    )
  }

  if (!restaurant) {
    return (
      <section className="public-apply-page" dir={direction}>
        <div className="public-apply-card">
          <p className="message message-error" role="alert">
            {error || text.notFound}
          </p>
          <Link to="/login">Peepss</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="public-apply-page" dir={direction}>
      <div className="public-apply-shell">
        <header className="public-apply-header">
          <span className="peepss-logo public-apply-logo" dir="ltr">
            <span className="peepss-logo-circle" />
            <span className="peepss-logo-thin">p</span>
            <span className="peepss-logo-bold">ee</span>
            <span className="peepss-logo-thin">pss</span>
          </span>
          <RestaurantLanguageToggle />
        </header>

        <div className="public-apply-card">
          <p className="public-apply-kicker">{text.noLogin}</p>
          <h1>{restaurant.restaurantName}</h1>
          <p className="public-apply-location">
            {[restaurant.city, restaurant.street].filter(Boolean).join(' · ')}
          </p>
          {restaurant.description && <p>{restaurant.description}</p>}

          {isSubmitted ? (
            <p className="message message-success">{text.success}</p>
          ) : (
            <form className="public-apply-form" onSubmit={handleSubmit}>
              <div className="guided-form-progress">
                <span>{step}/3</span>
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
                  <h2>{text.stepOneTitle}</h2>
                  <label>
                    {text.fullName}
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {text.phone}
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                      required
                    />
                  </label>
                </>
              )}

              {step === 2 && (
                <fieldset className="restaurant-role-options">
                  <legend>{text.stepTwoTitle}</legend>
                  <div>
                    {RESTAURANT_ROLES.map((role) => (
                      <label key={role.value}>
                        <input
                          type="checkbox"
                          checked={wantedRoles.includes(role.value)}
                          onChange={() => toggleRole(role.value)}
                        />
                        <span>
                          {getRestaurantRoleLabel(role.value, language)}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {step === 3 && (
                <>
                  <h2>{text.stepThreeTitle}</h2>
                  <fieldset className="restaurant-role-options">
                    <legend>{text.experience}</legend>
                    <div>
                      {experienceOptions[language].map((option) => (
                        <label key={option}>
                          <input
                            type="radio"
                            name="experience"
                            checked={experienceText === option}
                            onChange={() => setExperienceText(option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="restaurant-role-options">
                    <legend>{text.availability}</legend>
                    <div>
                      {availabilityOptions[language].map((option) => (
                        <label key={option}>
                          <input
                            type="radio"
                            name="availability"
                            checked={availability === option}
                            onChange={() => setAvailability(option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label>
                    {text.age}
                    <input
                      type="number"
                      min="14"
                      max="100"
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                    />
                  </label>
                </>
              )}

              {error && (
                <p className="message message-error" role="alert">
                  {error}
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
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? text.submitting
                    : step === 3
                      ? text.submit
                      : text.next}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

export default RestaurantPublicApplyPage
