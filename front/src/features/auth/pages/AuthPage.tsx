import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  requestAuthCode,
  verifyAuthCode,
  type UserTrack,
} from '../services/authApi'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'

type AuthPageProps = {
  mode: 'login' | 'register'
  onAuthSuccess: (token: string) => Promise<void>
}

type AuthStep = 'details' | 'code'
type PhoneAuthTrack = Extract<UserTrack, 'restaurant' | 'restaurantOwner'>

function AuthPage({ mode, onAuthSuccess }: AuthPageProps) {
  const { direction, language, setLanguage } = useRestaurantLanguage()
  const [step, setStep] = useState<AuthStep>('details')
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [track, setTrack] = useState<PhoneAuthTrack>('restaurant')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const isHebrew = language === 'he'
  const purpose = mode
  const text = {
    authModeLabel: isHebrew ? 'מצב התחברות' : 'Auth mode',
    loginTab: isHebrew ? 'התחברות' : 'Login',
    registerTab: isHebrew ? 'הרשמה' : 'Register',
    headline: 'Swipe, apply.',
    fullName: isHebrew ? 'שם מלא' : 'Full name',
    phone: isHebrew ? 'טלפון' : 'Phone number',
    code: isHebrew ? 'קוד אימות' : 'Verification code',
    phonePlaceholder: isHebrew ? '050-1234567' : '050-1234567',
    fullNamePlaceholder: isHebrew ? 'השם שלך' : 'Your full name',
    trackLegend: isHebrew ? 'בחרו איך להתחיל.' : 'Choose how you want to start.',
    worker: isHebrew
      ? 'מחפש/ת עבודה במסעדה'
      : 'Looking for restaurant work',
    owner: isHebrew ? 'מנהל/ת מסעדה' : 'Restaurant owner / manager',
    sendCode: isHebrew ? 'שלחו לי קוד' : 'Send me a code',
    sendingCode: isHebrew ? 'שולח קוד...' : 'Sending code...',
    codeTitle: isHebrew ? 'הזינו את הקוד שקיבלתם' : 'Enter the code you received',
    codeSent: isHebrew
      ? `שלחנו קוד ל־${phoneNumber}`
      : `We sent a code to ${phoneNumber}`,
    continue: isHebrew ? 'כניסה' : 'Continue',
    verifying: isHebrew ? 'בודק קוד...' : 'Checking code...',
    resend: isHebrew ? 'לא קיבלתם קוד? שלחו שוב' : 'Didn’t get a code? Send again',
    resending: isHebrew ? 'שולח שוב...' : 'Sending again...',
    changePhone: isHebrew ? 'שינוי מספר' : 'Change number',
    resendSuccess: isHebrew ? 'שלחנו קוד חדש.' : 'We sent a new code.',
    devHint: isHebrew
      ? 'בפיתוח: הקוד מופיע בטרמינל של הבקאנד.'
      : 'Dev mode: the code appears in the backend terminal.',
    phoneRequired: isHebrew ? 'צריך להזין מספר טלפון.' : 'Please enter a phone number.',
    fullNameRequired: isHebrew
      ? 'צריך להזין שם מלא.'
      : 'Please enter your full name.',
    codeRequired: isHebrew
      ? 'הזינו קוד בן 4 ספרות'
      : 'Enter the 4-digit code',
    fallbackError: isHebrew ? 'משהו השתבש' : 'Something went wrong',
    loginMissingAccount: isHebrew
      ? 'לא מצאנו משתמש עם המספר הזה. אפשר להירשם בכמה שניות.'
      : 'We couldn’t find an account with this number. You can register in a few seconds.',
    switchToRegister: isHebrew ? 'להרשמה' : 'Register instead',
    switchLanguage: isHebrew ? 'English' : 'עברית',
    switchLanguageLabel: isHebrew ? 'Switch to English' : 'החלפה לעברית',
  }

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [mode])

  function validateDetails() {
    if (mode === 'register' && fullName.trim().length < 2) {
      setError(text.fullNameRequired)
      return false
    }

    if (!phoneNumber.trim()) {
      setError(text.phoneRequired)
      return false
    }

    return true
  }

  function validateCode() {
    if (!/^\d{4}$/.test(code)) {
      setError(text.codeRequired)
      return false
    }

    return true
  }

  async function requestCode() {
    await requestAuthCode({
      phoneNumber,
      purpose,
    })
  }

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!validateDetails()) {
      return
    }

    setIsLoading(true)

    try {
      await requestCode()
      setStep('code')
      setCode('')
    } catch (error) {
      setError(error instanceof Error ? error.message : text.fallbackError)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!validateCode()) {
      return
    }

    setIsLoading(true)

    try {
      const response = await verifyAuthCode({
        phoneNumber,
        code,
        purpose,
        ...(mode === 'register'
          ? {
              fullName: fullName.trim(),
              track,
            }
          : {}),
      })
      const activeElement = document.activeElement

      if (activeElement instanceof HTMLElement) {
        activeElement.blur()
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0

      await onAuthSuccess(response.token)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : text.fallbackError

      setError(
        mode === 'login' &&
          errorMessage.toLowerCase().includes('account not found')
          ? text.loginMissingAccount
          : errorMessage,
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResendCode() {
    setError(null)
    setMessage(null)
    setIsResending(true)

    try {
      await requestCode()
      setMessage(text.resendSuccess)
    } catch (error) {
      setError(error instanceof Error ? error.message : text.fallbackError)
    } finally {
      setIsResending(false)
    }
  }

  function handleCodeChange(value: string) {
    setCode(value.replace(/\D/g, '').slice(0, 4))
  }

  return (
    <section className="auth-page" dir={direction}>
      <div className="auth-shell">
        <div className="auth-topbar">
          <span className="peepss-logo auth-logo" aria-label="Peepss" dir="ltr">
            <span className="peepss-logo-circle" />
            <span className="peepss-logo-thin">p</span>
            <span className="peepss-logo-bold">ee</span>
            <span className="peepss-logo-thin">pss</span>
          </span>
          <button
            className="auth-language-toggle"
            type="button"
            aria-label={text.switchLanguageLabel}
            onClick={() => setLanguage(isHebrew ? 'en' : 'he')}
          >
            {text.switchLanguage}
          </button>
        </div>

        <h1 className="auth-headline" dir="ltr">
          {text.headline}
        </h1>

        <div className="auth-center">
          <div className="auth-card">
            <nav className="auth-mode-tabs" aria-label={text.authModeLabel}>
              <Link className={mode === 'login' ? 'active' : ''} to="/login">
                {text.loginTab}
              </Link>
              <Link
                className={mode === 'register' ? 'active' : ''}
                to="/register"
              >
                {text.registerTab}
              </Link>
            </nav>

            {step === 'details' ? (
              <form className="auth-form" onSubmit={handleSendCode}>
                {mode === 'register' && (
                  <label>
                    {text.fullName}
                    <input
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder={text.fullNamePlaceholder}
                      required
                      minLength={2}
                      autoComplete="name"
                    />
                  </label>
                )}

                <label>
                  {text.phone}
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder={text.phonePlaceholder}
                    required
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </label>

                {mode === 'register' && (
                  <fieldset className="auth-track-choice">
                    <legend>{text.trackLegend}</legend>
                    <label>
                      <input
                        type="radio"
                        name="track"
                        value="restaurant"
                        checked={track === 'restaurant'}
                        onChange={() => setTrack('restaurant')}
                      />
                      <span>
                        <strong>{text.worker}</strong>
                      </span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="track"
                        value="restaurantOwner"
                        checked={track === 'restaurantOwner'}
                        onChange={() => setTrack('restaurantOwner')}
                      />
                      <span>
                        <strong>{text.owner}</strong>
                      </span>
                    </label>
                  </fieldset>
                )}

                {import.meta.env.DEV && (
                  <p className="auth-dev-hint">{text.devHint}</p>
                )}

                {error && (
                  <p className="message message-error" role="alert">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={isLoading}>
                  {isLoading ? text.sendingCode : text.sendCode}
                </button>
              </form>
            ) : (
              <form className="auth-form auth-code-form" onSubmit={handleVerifyCode}>
                <div className="auth-code-heading">
                  <h2>{text.codeTitle}</h2>
                  <p>{text.codeSent}</p>
                </div>

                <label>
                  {text.code}
                  <input
                    className="auth-code-input"
                    type="text"
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
                    {mode === 'login' &&
                      error === text.loginMissingAccount && (
                        <>
                          {' '}
                          <Link to="/register">{text.switchToRegister}</Link>
                        </>
                      )}
                  </p>
                )}

                <button type="submit" disabled={isLoading}>
                  {isLoading ? text.verifying : text.continue}
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
                      setStep('details')
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
          </div>
        </div>
      </div>
    </section>
  )
}

export default AuthPage
