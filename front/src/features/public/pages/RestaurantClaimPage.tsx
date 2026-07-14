import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  requestAuthCode,
  verifyAuthCode,
} from '../../auth/services/authApi'
import { getRestaurantRoleLabel } from '../../restaurant/types/restaurant'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import {
  completePublicRestaurantClaim,
  getPublicRestaurantClaim,
  RestaurantClaimApiError,
  type PublicRestaurantClaim,
} from '../services/restaurantClaimApi'

const CLAIM_CONTEXT_KEY = 'peepss-restaurant-claim-context'

type ClaimPageProps = {
  onClaimSuccess: (
    authToken: string,
    profileComplete: boolean,
  ) => Promise<void>
}

type ClaimStep = 'overview' | 'phone' | 'code'
type ClaimStatus = 'loading' | 'ready' | 'unavailable' | 'activated'

function readStoredClaimToken(slug: string) {
  try {
    const value = sessionStorage.getItem(CLAIM_CONTEXT_KEY)

    if (!value) {
      return ''
    }

    const context = JSON.parse(value) as {
      slug?: unknown
      token?: unknown
    }

    return context.slug === slug && typeof context.token === 'string'
      ? context.token
      : ''
  } catch {
    return ''
  }
}

function clearClaimContext() {
  sessionStorage.removeItem(CLAIM_CONTEXT_KEY)
}

function PeepssClaimLogo() {
  return (
    <span className="peepss-logo auth-logo" aria-label="Peepss" dir="ltr">
      <span className="peepss-logo-circle" />
      <span className="peepss-logo-thin">p</span>
      <span className="peepss-logo-bold">ee</span>
      <span className="peepss-logo-thin">pss</span>
    </span>
  )
}

function RestaurantClaimPage({ onClaimSuccess }: ClaimPageProps) {
  const { restaurantSlug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { direction, language, setLanguage } = useRestaurantLanguage()
  const isHebrew = language === 'he'
  const queryToken = searchParams.get('token')?.trim() ?? ''
  const claimToken = useMemo(
    () => queryToken || readStoredClaimToken(restaurantSlug),
    [queryToken, restaurantSlug],
  )
  const [claim, setClaim] = useState<PublicRestaurantClaim | null>(null)
  const [status, setStatus] = useState<ClaimStatus>('loading')
  const [step, setStep] = useState<ClaimStep>('overview')
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const text = {
    switchLanguage: isHebrew ? 'English' : 'עברית',
    switchLanguageLabel: isHebrew ? 'Switch to English' : 'החלפה לעברית',
    readyTitle: isHebrew
      ? `${claim?.restaurantName ?? ''} כבר מוכנה ב-Peepss`
      : `${claim?.restaurantName ?? ''} is already ready on Peepss`,
    intro: isHebrew
      ? 'הכנו למסעדה עמוד גיוס פשוט.'
      : "We've prepared a simple hiring page for your restaurant.",
    explanation: isHebrew
      ? 'מועמדים סורקים את ה-QR, משאירים כמה פרטים, ואתם יכולים לראות וליצור איתם קשר ישירות.'
      : 'Candidates scan your QR, leave a few details, and you can see and contact them directly.',
    prepared: isHebrew ? 'כבר הכנו עבורכם:' : 'Prepared for you:',
    preparedItems: isHebrew
      ? [
          'עמוד גיוס למסעדה',
          'QR ייחודי למועמדים',
          'תפקידי גיוס שכבר הוגדרו',
          'ניהול מועמדים במקום אחד',
        ]
      : [
          'Restaurant hiring page',
          'Unique candidate QR',
          'Hiring roles already configured',
          'Candidate management in one place',
        ],
    positioning: isHebrew
      ? 'הקשר האישי עם המועמדים נשאר אצלכם — Peepss רק עוזרת לאסוף ולסדר אותם.'
      : 'You keep the personal hiring relationship — Peepss simply makes applicants easier to collect and organize.',
    activate: isHebrew ? 'הפעלת המסעדה שלי' : 'Activate my restaurant',
    name: isHebrew ? 'שם מלא' : 'Full name',
    phone: isHebrew ? 'טלפון' : 'Phone number',
    sendCode: isHebrew ? 'שלחו לי קוד' : 'Send me a code',
    sendingCode: isHebrew ? 'שולח קוד...' : 'Sending code...',
    codeTitle: isHebrew ? 'הזינו את קוד האימות' : 'Enter the verification code',
    codeHelp: isHebrew
      ? `שלחנו קוד ל-${phoneNumber}`
      : `We sent a code to ${phoneNumber}`,
    code: isHebrew ? 'קוד בן 4 ספרות' : '4-digit code',
    complete: isHebrew ? 'הפעלת המסעדה' : 'Activate restaurant',
    completing: isHebrew ? 'מפעיל את המסעדה...' : 'Activating restaurant...',
    resend: isHebrew ? 'שליחת קוד חדש' : 'Resend code',
    changePhone: isHebrew ? 'שינוי מספר' : 'Change number',
    unavailableTitle: isHebrew
      ? 'קישור ההפעלה הזה כבר לא זמין'
      : 'This activation link is no longer available',
    unavailableBody: isHebrew
      ? 'יכול להיות שהקישור כבר שימש או שהוחלף.'
      : 'The link may have already been used or replaced.',
    unavailableContact: isHebrew
      ? 'אפשר לפנות ל-Peepss כדי לקבל גישה למסעדה.'
      : 'Contact Peepss if you need access to this restaurant.',
    activatedTitle: isHebrew
      ? 'המסעדה הזו כבר הופעלה.'
      : 'This restaurant has already been activated.',
    activatedBody: isHebrew
      ? 'אם אתם כבר מנהלים את המסעדה, התחברו עם מספר הטלפון שמחובר לחשבון.'
      : 'If you already manage this restaurant, log in with the phone number connected to the account.',
    login: isHebrew ? 'להתחברות' : 'Go to login',
    required: isHebrew
      ? 'יש להזין שם ומספר טלפון.'
      : 'Enter your name and phone number.',
    invalidCode: isHebrew
      ? 'הקוד לא נכון או שפג תוקף. נסו שוב.'
      : 'The code is incorrect or expired. Try again.',
    codeRequired: isHebrew
      ? 'הזינו קוד בן 4 ספרות.'
      : 'Enter the 4-digit code.',
    fallbackError: isHebrew ? 'משהו השתבש. נסו שוב.' : 'Something went wrong. Try again.',
    resent: isHebrew ? 'שלחנו קוד חדש.' : 'We sent a new code.',
  }

  useEffect(() => {
    if (queryToken && restaurantSlug) {
      sessionStorage.setItem(
        CLAIM_CONTEXT_KEY,
        JSON.stringify({
          slug: restaurantSlug,
          token: queryToken,
        }),
      )
    }
  }, [queryToken, restaurantSlug])

  useEffect(() => {
    let isActive = true

    async function loadClaim() {
      if (!restaurantSlug || !claimToken) {
        clearClaimContext()
        setStatus('unavailable')
        return
      }

      setStatus('loading')

      try {
        const result = await getPublicRestaurantClaim(
          restaurantSlug,
          claimToken,
        )

        if (isActive) {
          setClaim(result)
          setStatus('ready')
        }
      } catch (error) {
        if (!isActive) {
          return
        }

        clearClaimContext()
        setStatus(
          error instanceof RestaurantClaimApiError &&
            error.code === 'ALREADY_ACTIVATED'
            ? 'activated'
            : 'unavailable',
        )
      }
    }

    void loadClaim()

    return () => {
      isActive = false
    }
  }, [claimToken, restaurantSlug])

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (fullName.trim().length < 2 || !phoneNumber.trim()) {
      setError(text.required)
      return
    }

    setIsLoading(true)

    try {
      await requestAuthCode({
        phoneNumber,
        purpose: 'register',
      })
      setCode('')
      setStep('code')
    } catch (error) {
      setError(error instanceof Error ? error.message : text.fallbackError)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerifyAndClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!/^\d{4}$/.test(code)) {
      setError(text.codeRequired)
      return
    }

    setIsLoading(true)

    try {
      const auth = await verifyAuthCode({
        phoneNumber,
        code,
        purpose: 'register',
        fullName: fullName.trim(),
        track: 'restaurantOwner',
      })
      const completed = await completePublicRestaurantClaim({
        slug: restaurantSlug,
        token: claimToken,
        authToken: auth.token,
      })

      clearClaimContext()
      await onClaimSuccess(auth.token, completed.profileComplete)
    } catch (error) {
      if (
        error instanceof RestaurantClaimApiError &&
        error.code === 'ALREADY_ACTIVATED'
      ) {
        clearClaimContext()
        setStatus('activated')
        return
      }

      if (error instanceof RestaurantClaimApiError) {
        if (error.code === 'CLAIM_UNAVAILABLE') {
          clearClaimContext()
          setStatus('unavailable')
          return
        }

        setError(error.message)
        return
      }

      setError(text.invalidCode)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResendCode() {
    setError(null)
    setMessage(null)
    setIsLoading(true)

    try {
      await requestAuthCode({
        phoneNumber,
        purpose: 'register',
      })
      setMessage(text.resent)
    } catch (error) {
      setError(error instanceof Error ? error.message : text.fallbackError)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <section className="claim-page" dir={direction} aria-live="polite">
        <div className="claim-topbar">
          <PeepssClaimLogo />
        </div>
        <div className="claim-card">
          <p>{isHebrew ? 'בודקים את קישור ההפעלה...' : 'Checking activation link...'}</p>
        </div>
      </section>
    )
  }

  if (status === 'unavailable' || status === 'activated') {
    return (
      <section className="claim-page" dir={direction}>
        <div className="claim-topbar">
          <PeepssClaimLogo />
          <button
            className="auth-language-toggle"
            type="button"
            aria-label={text.switchLanguageLabel}
            onClick={() => setLanguage(isHebrew ? 'en' : 'he')}
          >
            {text.switchLanguage}
          </button>
        </div>
        <div className="claim-card claim-unavailable-card">
          <h1>
            {status === 'activated'
              ? text.activatedTitle
              : text.unavailableTitle}
          </h1>
          <p>
            {status === 'activated'
              ? text.activatedBody
              : text.unavailableBody}
          </p>
          {status === 'unavailable' && <p>{text.unavailableContact}</p>}
          <Link className="button-link" to="/login">
            {text.login}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="claim-page" dir={direction}>
      <div className="claim-topbar">
        <PeepssClaimLogo />
        <button
          className="auth-language-toggle"
          type="button"
          aria-label={text.switchLanguageLabel}
          onClick={() => setLanguage(isHebrew ? 'en' : 'he')}
        >
          {text.switchLanguage}
        </button>
      </div>

      <article className="claim-card">
        {step === 'overview' && (
          <>
            <h1>{text.readyTitle}</h1>
            <p>{text.intro}</p>
            <p>{text.explanation}</p>
            <div className="claim-prepared-list">
              <strong>{text.prepared}</strong>
              <ul>
                {text.preparedItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {claim && claim.enabledQrRoleCount > 0 && (
                <p className="claim-role-summary">
                  {claim.qrEnabledRoles
                    .map((role) => getRestaurantRoleLabel(role, language))
                    .join(' · ')}
                </p>
              )}
            </div>
            <p className="claim-positioning">{text.positioning}</p>
            <button type="button" onClick={() => setStep('phone')}>
              {text.activate}
            </button>
          </>
        )}

        {step === 'phone' && (
          <form className="auth-form claim-form" onSubmit={handleRequestCode}>
            <h2>{text.activate}</h2>
            <label>
              {text.name}
              <input
                type="text"
                value={fullName}
                minLength={2}
                required
                autoComplete="name"
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>
            <label>
              {text.phone}
              <input
                type="tel"
                inputMode="tel"
                value={phoneNumber}
                required
                autoComplete="tel"
                placeholder="050-1234567"
                onChange={(event) => setPhoneNumber(event.target.value)}
              />
            </label>
            {error && <p className="message message-error" role="alert">{error}</p>}
            <button type="submit" disabled={isLoading}>
              {isLoading ? text.sendingCode : text.sendCode}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form className="auth-form claim-form" onSubmit={handleVerifyAndClaim}>
            <h2>{text.codeTitle}</h2>
            <p>{text.codeHelp}</p>
            <label>
              {text.code}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                pattern="[0-9]{4}"
                value={code}
                disabled={isLoading}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 4))
                  setError(null)
                }}
              />
            </label>
            {message && <p className="message message-success">{message}</p>}
            {error && <p className="message message-error" role="alert">{error}</p>}
            <button type="submit" disabled={isLoading}>
              {isLoading ? text.completing : text.complete}
            </button>
            <div className="claim-secondary-actions">
              <button
                className="button-secondary"
                type="button"
                disabled={isLoading}
                onClick={() => void handleResendCode()}
              >
                {text.resend}
              </button>
              <button
                className="button-secondary"
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setCode('')
                  setError(null)
                  setMessage(null)
                  setStep('phone')
                }}
              >
                {text.changePhone}
              </button>
            </div>
          </form>
        )}
      </article>
    </section>
  )
}

export default RestaurantClaimPage
