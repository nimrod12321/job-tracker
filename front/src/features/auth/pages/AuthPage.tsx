import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  loginUser,
  registerUser,
  type UserTrack,
} from '../services/authApi'

type AuthPageProps = {
  mode: 'login' | 'register'
  onAuthSuccess: (token: string) => Promise<void>
}

function AuthPage({ mode, onAuthSuccess }: AuthPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [track, setTrack] = useState<UserTrack>('restaurant')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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
      setError(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [mode])

  return (
    <section className="auth-page">
      <div className="auth-shell">
        <div className="auth-hero">
          <div>
            <span className="peepss-logo auth-logo" aria-label="Peepss" dir="ltr">
              <span className="peepss-logo-circle" />
              <span className="peepss-logo-thin">p</span>
              <span className="peepss-logo-bold">ee</span>
              <span className="peepss-logo-thin">pss</span>
            </span>
            <h1>Peepss for restaurants</h1>
            <p>Jobs, candidates, and QR hiring in one place.</p>
          </div>
        </div>

        <div className="auth-card">
          <nav className="auth-mode-tabs" aria-label="Auth mode">
            <Link className={mode === 'login' ? 'active' : ''} to="/login">
              Login
            </Link>
            <Link
              className={mode === 'register' ? 'active' : ''}
              to="/register"
            >
              Register
            </Link>
          </nav>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label>
              Password
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
                <legend>Choose how you want to start.</legend>
                <label>
                  <input
                    type="radio"
                    name="track"
                    value="restaurant"
                    checked={track === 'restaurant'}
                    onChange={() => setTrack('restaurant')}
                  />
                  <span>
                    <strong>מחפש/ת עבודה במסעדה</strong>
                    <small>Looking for restaurant work</small>
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
                    <strong>מנהל/ת מסעדה</strong>
                    <small>Restaurant owner / manager</small>
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
                  ? 'Logging in...'
                  : 'Creating account...'
                : mode === 'login'
                  ? 'Login'
                  : 'Register'}
            </button>
          </form>
        </div>

      </div>
    </section>
  )
}

export default AuthPage
