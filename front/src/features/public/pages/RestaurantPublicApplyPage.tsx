import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { requestAuthCode, verifyAuthCode } from '../../auth/services/authApi'
import RestaurantLanguageToggle from '../../restaurant/components/RestaurantLanguageToggle'
import {
  RESTAURANT_ROLES,
  getRestaurantRoleLabel,
  type RestaurantRole,
} from '../../restaurant/types/restaurant'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import {
  getPublicRestaurant,
  submitVerifiedPublicRestaurantLead,
  type PublicRestaurant,
} from '../services/publicRestaurantApi'

type PublicApplyStep = 'identify' | 'verify' | 'details'

type RestaurantPublicApplyPageProps = {
  onAuthVerified: (token: string) => Promise<void>
}

const experienceOptions = {
  he: ['אין ניסיון', 'שנה', 'שנתיים', 'שלוש שנים', 'מעל 3 שנים'],
  en: ['No experience', '1 year', '2 years', '3 years', 'More than 3 years'],
}
const availabilityOptions = {
  he: ['בוקר', 'צהריים', 'ערב', 'לילה', 'סופי שבוע', 'גמיש'],
  en: ['Morning', 'Afternoon', 'Evening', 'Night', 'Weekends', 'Flexible'],
}

function RestaurantPublicApplyPage({
  onAuthVerified,
}: RestaurantPublicApplyPageProps) {
  const { restaurantSlug = '' } = useParams()
  const { direction, language } = useRestaurantLanguage()
  const [restaurant, setRestaurant] = useState<PublicRestaurant | null>(null)
  const [step, setStep] = useState<PublicApplyStep>('identify')
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null)
  const [wantedRoles, setWantedRoles] = useState<RestaurantRole[]>([])
  const [experienceLevel, setExperienceLevel] = useState('')
  const [extraExperienceText, setExtraExperienceText] = useState('')
  const [availability, setAvailability] = useState<string[]>([])
  const [age, setAge] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const text = {
    loading: language === 'he' ? 'טוען מסעדה...' : 'Loading restaurant...',
    notFound:
      language === 'he' ? 'לא מצאנו את המסעדה.' : 'Restaurant not found.',
    identifyTitle:
      language === 'he' ? 'רוצים לעבוד אצלנו?' : 'Want to work with us?',
    identifyIntro:
      language === 'he'
        ? 'השאירו שם וטלפון ונמשיך משם.'
        : 'Leave your name and phone number and we’ll continue from there.',
    fullName: language === 'he' ? 'שם מלא' : 'Full name',
    phone: language === 'he' ? 'טלפון' : 'Phone',
    sendCode: language === 'he' ? 'שלחו לי קוד' : 'Send me a code',
    sendingCode: language === 'he' ? 'שולח קוד...' : 'Sending code...',
    verifyTitle:
      language === 'he'
        ? 'הזינו את הקוד בן 4 הספרות'
        : 'Enter the 4-digit code',
    codeSent:
      language === 'he'
        ? `שלחנו קוד ל־${phoneNumber}`
        : `We sent a code to ${phoneNumber}`,
    codeLabel: language === 'he' ? 'קוד' : 'Code',
    continue: language === 'he' ? 'המשך' : 'Continue',
    verifying: language === 'he' ? 'בודק קוד...' : 'Checking code...',
    resend: language === 'he' ? 'שלחו שוב' : 'Resend code',
    resending: language === 'he' ? 'שולח שוב...' : 'Sending again...',
    changePhone: language === 'he' ? 'שינוי מספר' : 'Change phone',
    resendSuccess: language === 'he' ? 'שלחנו קוד חדש.' : 'We sent a new code.',
    detailsTitle:
      language === 'he' ? 'מעולה, כמה פרטים אחרונים' : 'Great, a few final details',
    roles:
      language === 'he'
        ? 'איזה תפקידים מעניינים אותך?'
        : 'Which roles are you interested in?',
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
    submit: language === 'he' ? 'שליחת מועמדות' : 'Submit application',
    submitting: language === 'he' ? 'שולח...' : 'Submitting...',
    success:
      language === 'he'
        ? 'הפרטים נשלחו למסעדה ✅'
        : 'Your application was sent ✅',
    successHint:
      language === 'he'
        ? 'אם זה מתאים, יחזרו אליך.'
        : 'If it fits, the restaurant will contact you.',
    seeMoreJobs:
      language === 'he' ? 'לראות עוד משרות' : 'See more jobs',
    devHint:
      language === 'he'
        ? 'בפיתוח: הקוד מופיע בטרמינל של הבקאנד.'
        : 'Dev mode: the code appears in the backend terminal.',
    namePhoneError:
      language === 'he'
        ? 'צריך למלא שם וטלפון.'
        : 'Please enter your name and phone number.',
    codeError:
      language === 'he' ? 'הזינו קוד בן 4 ספרות' : 'Enter the 4-digit code',
    detailsError:
      language === 'he'
        ? 'צריך למלא גיל תקין ולבחור לפחות תפקיד אחד.'
        : 'Please enter a valid age and choose at least one role.',
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

  function toggleAvailability(option: string) {
    setAvailability((currentAvailability) =>
      currentAvailability.includes(option)
        ? currentAvailability.filter((currentOption) => currentOption !== option)
        : [...currentAvailability, option],
    )
  }

  function handleCodeChange(value: string) {
    setCode(value.replace(/\D/g, '').slice(0, 4))
  }

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (fullName.trim().length < 2 || !phoneNumber.trim()) {
      setError(text.namePhoneError)
      return
    }

    setIsSubmitting(true)

    try {
      await requestAuthCode({
        phoneNumber,
        purpose: 'qrApply',
      })
      setCode('')
      setStep('verify')
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to send code',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!/^\d{4}$/.test(code)) {
      setError(text.codeError)
      return
    }

    setIsSubmitting(true)

    try {
      const response = await verifyAuthCode({
        phoneNumber,
        code,
        purpose: 'qrApply',
        fullName: fullName.trim(),
      })

      await onAuthVerified(response.token)
      setVerifiedToken(response.token)
      setStep('details')
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to verify code',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendCode() {
    setError(null)
    setMessage(null)
    setIsResending(true)

    try {
      await requestAuthCode({
        phoneNumber,
        purpose: 'qrApply',
      })
      setMessage(text.resendSuccess)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to send code',
      )
    } finally {
      setIsResending(false)
    }
  }

  async function handleSubmitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const parsedAge = Number(age)

    if (
      !verifiedToken ||
      !age.trim() ||
      !Number.isInteger(parsedAge) ||
      parsedAge < 16 ||
      parsedAge > 80 ||
      wantedRoles.length === 0
    ) {
      setError(text.detailsError)
      return
    }

    setIsSubmitting(true)

    try {
      const experienceText = [
        experienceLevel,
        extraExperienceText.trim(),
      ]
        .filter(Boolean)
        .join('\n\n')

      await submitVerifiedPublicRestaurantLead(
        restaurantSlug,
        {
          wantedRoles,
          experienceText,
          availability: availability.join(', '),
          age: parsedAge,
        },
        verifiedToken,
      )
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

        {isSubmitted ? (
          <div className="public-apply-card public-apply-success-card">
            <h1>{text.success}</h1>
            <p>{text.successHint}</p>
            <Link className="primary-link-button" to="/restaurant/explore">
              {text.seeMoreJobs}
            </Link>
          </div>
        ) : (
          <div className="public-apply-card">
            <h1>{restaurant.restaurantName}</h1>
            <p className="public-apply-location">
              {[restaurant.city, restaurant.street].filter(Boolean).join(' · ')}
            </p>
            {restaurant.description && <p>{restaurant.description}</p>}

            <div className="guided-form-progress">
              <span>
                {step === 'identify' ? '1' : step === 'verify' ? '2' : '3'}/3
              </span>
              <div>
                {['identify', 'verify', 'details'].map((currentStep) => (
                  <span
                    className={
                      ['identify', 'verify', 'details'].indexOf(currentStep) <=
                      ['identify', 'verify', 'details'].indexOf(step)
                        ? 'active'
                        : ''
                    }
                    key={currentStep}
                  />
                ))}
              </div>
            </div>

            {step === 'identify' && (
              <form className="public-apply-form" onSubmit={handleSendCode}>
                <h2>{text.identifyTitle}</h2>
                <p className="public-apply-kicker">{text.identifyIntro}</p>
                <label>
                  {text.fullName}
                  <input
                    value={fullName}
                    placeholder={text.fullNamePlaceholder}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    minLength={2}
                    autoComplete="name"
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
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </label>
                {import.meta.env.DEV && (
                  <p className="auth-dev-hint">{text.devHint}</p>
                )}
                {error && (
                  <p className="message message-error" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? text.sendingCode : text.sendCode}
                </button>
              </form>
            )}

            {step === 'verify' && (
              <form className="public-apply-form auth-code-form" onSubmit={handleVerifyCode}>
                <div className="auth-code-heading">
                  <h2>{text.verifyTitle}</h2>
                  <p>{text.codeSent}</p>
                </div>
                <label>
                  {text.codeLabel}
                  <input
                    className="auth-code-input"
                    value={code}
                    onChange={(event) => handleCodeChange(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    required
                    dir="ltr"
                  />
                </label>
                {import.meta.env.DEV && (
                  <p className="auth-dev-hint">{text.devHint}</p>
                )}
                {message && <p className="message message-success">{message}</p>}
                {error && (
                  <p className="message message-error" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? text.verifying : text.continue}
                </button>
                <div className="auth-code-actions">
                  <button
                    type="button"
                    className="text-button"
                    disabled={isResending}
                    onClick={handleResendCode}
                  >
                    {isResending ? text.resending : text.resend}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setStep('identify')
                      setCode('')
                      setError(null)
                      setMessage(null)
                    }}
                  >
                    {text.changePhone}
                  </button>
                </div>
              </form>
            )}

            {step === 'details' && (
              <form className="public-apply-form" onSubmit={handleSubmitDetails}>
                <h2>{text.detailsTitle}</h2>
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
                <fieldset className="restaurant-role-options">
                  <legend>{text.roles}</legend>
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
                          type="checkbox"
                          checked={availability.includes(option)}
                          onChange={() => toggleAvailability(option)}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {error && (
                  <p className="message message-error" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? text.submitting : text.submit}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default RestaurantPublicApplyPage
