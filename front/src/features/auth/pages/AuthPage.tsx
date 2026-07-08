import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  loginUser,
  registerUser,
  type UserTrack,
} from '../services/authApi'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'

type AuthPageProps = {
  mode: 'login' | 'register'
  onAuthSuccess: (token: string) => Promise<void>
}

function AuthPage({ mode, onAuthSuccess }: AuthPageProps) {
  const { direction, language, setLanguage } = useRestaurantLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [track, setTrack] = useState<UserTrack>('restaurant')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const isHebrew = language === 'he'
  const text = {
    authModeLabel: isHebrew ? 'מצב התחברות' : 'Auth mode',
    loginTab: isHebrew ? 'התחברות' : 'Login',
    registerTab: isHebrew ? 'הרשמה' : 'Register',
    email: isHebrew ? 'אימייל' : 'Email',
    password: isHebrew ? 'סיסמה' : 'Password',
    trackLegend: isHebrew
      ? 'בחרו איך להתחיל.'
      : 'Choose how you want to start.',
    worker: isHebrew
      ? 'מחפש/ת עבודה במסעדה'
      : 'Looking for restaurant work',
    owner: isHebrew
      ? 'מנהל/ת מסעדה'
      : 'Restaurant owner / manager',
    loadingLogin: isHebrew ? 'מתחבר...' : 'Signing in...',
    loadingRegister: isHebrew ? 'יוצר חשבון...' : 'Creating account...',
    submitLogin: isHebrew ? 'כניסה' : 'Sign in',
    submitRegister: isHebrew ? 'יצירת חשבון' : 'Create account',
    fallbackError: isHebrew ? 'משהו השתבש' : 'Something went wrong',
    switchLanguage: isHebrew ? 'English' : 'עברית',
    switchLanguageLabel: isHebrew ? 'Switch to English' : 'החלפה לעברית',
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (mode === 'register') {
        await registerUser(email, password, track)
      }

      const response = await loginUser(email, password)
      const activeElement = document.activeElement

      if (activeElement instanceof HTMLElement) {
        activeElement.blur()
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0

      await onAuthSuccess(response.token)
    } catch (error) {
      setError(error instanceof Error ? error.message : text.fallbackError)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [mode])

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

            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                {text.email}
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <label>
                {text.password}
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
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

              {error && (
                <p className="message message-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={isLoading}>
                {isLoading
                  ? mode === 'login'
                    ? text.loadingLogin
                    : text.loadingRegister
                  : mode === 'login'
                    ? text.submitLogin
                    : text.submitRegister}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AuthPage
