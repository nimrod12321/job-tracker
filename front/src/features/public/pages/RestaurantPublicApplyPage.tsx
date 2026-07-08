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
  he: ['אין ניסיון', 'שנה', 'שנתיים', 'שלוש שנים', 'מעל 3 שנים'],
  en: ['No experience', '1 year', '2 years', '3 years', 'More than 3 years'],
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
  const [experienceLevel, setExperienceLevel] = useState('')
  const [extraExperienceText, setExtraExperienceText] = useState('')
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
    age: language === 'he' ? 'גיל' : 'Age',
    extraExperience:
      language === 'he'
        ? 'רוצה להוסיף משהו על הניסיון שלך?'
        : 'Want to add anything about your experience?',
    extraExperiencePlaceholder:
      language === 'he'
        ? 'לדוגמה: עבדתי כבר במסעדה, אני חזק/ה במשמרות ערב, יש לי ניסיון בבר...'
        : 'For example: I worked in a restaurant before, I’m available evenings, I have bar experience...',
    fullNamePlaceholder:
      language === 'he' ? 'השם שלך' : 'Your name',
    phonePlaceholder:
      language === 'he' ? '050-1234567' : 'Your phone number',
    agePlaceholder: language === 'he' ? 'לדוגמה: 24' : 'For example: 24',
    next: language === 'he' ? 'הבא' : 'Next',
    back: language === 'he' ? 'חזרה' : 'Back',
    submit: language === 'he' ? 'שלח פרטים' : 'Submit application',
    submitting: language === 'he' ? 'שולח...' : 'Submitting...',
    success:
      language === 'he'
        ? 'הפרטים נשלחו למסעדה. אם זה מתאים, יחזרו אליך.'
        : 'Your application was sent to the restaurant. If it fits, they will contact you.',
    intro:
      language === 'he'
        ? 'רק תשאירו כמה פרטים, אנחנו נדאג לשאר.'
        : 'Just leave a few details, we’ll take care of the rest.',
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
      const parsedAge = Number(age)

      return (
        fullName.trim() &&
        phoneNumber.trim() &&
        age.trim() &&
        Number.isInteger(parsedAge) &&
        parsedAge >= 16 &&
        parsedAge <= 80
      )
    }

    if (step === 2) {
      return wantedRoles.length > 0
    }

    return true
  }

  function getStepValidationMessage() {
    if (step === 1) {
      return language === 'he'
        ? 'צריך למלא שם, טלפון וגיל תקין בין 16 ל-80.'
        : 'Please enter your name, phone, and a valid age between 16 and 80.'
    }

    if (step === 2) {
      return language === 'he'
        ? 'צריך לבחור לפחות תפקיד אחד.'
        : 'Please choose at least one role.'
    }

    return language === 'he'
      ? 'צריך להשלים את השדות בשלב הזה.'
      : 'Please complete this step.'
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (step < 3) {
      if (!validateCurrentStep()) {
        setError(getStepValidationMessage())
        return
      }

      setStep((currentStep) => currentStep + 1)
      return
    }

    setIsSubmitting(true)

    try {
      const parsedAge = Number(age)
      const experienceText = [
        experienceLevel,
        extraExperienceText.trim(),
      ]
        .filter(Boolean)
        .join('\n\n')

      await submitPublicRestaurantLead(restaurantSlug, {
        fullName,
        phoneNumber,
        wantedRoles,
        experienceText,
        availability,
        age: parsedAge,
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
          <h1>{restaurant.restaurantName}</h1>
          <p className="public-apply-location">
            {[restaurant.city, restaurant.street].filter(Boolean).join(' · ')}
          </p>
          {restaurant.description && <p>{restaurant.description}</p>}
          <p className="public-apply-kicker">{text.intro}</p>

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
                      placeholder={text.fullNamePlaceholder}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {text.phone}
                    <input
                      type="tel"
                      value={phoneNumber}
                      placeholder={text.phonePlaceholder}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {text.age}
                    <input
                      type="number"
                      min="16"
                      max="80"
                      inputMode="numeric"
                      value={age}
                      placeholder={text.agePlaceholder}
                      onChange={(event) => setAge(event.target.value)}
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
                            checked={experienceLevel === option}
                            onChange={() => setExperienceLevel(option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="public-apply-field-wide">
                    {text.extraExperience}
                    <textarea
                      rows={4}
                      value={extraExperienceText}
                      placeholder={text.extraExperiencePlaceholder}
                      onChange={(event) =>
                        setExtraExperienceText(event.target.value)
                      }
                    />
                  </label>
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
