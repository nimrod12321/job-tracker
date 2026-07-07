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
  const [track, setTrack] = useState<UserTrack>('highTech')
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
          <span className="peepss-logo auth-logo" aria-label="Peepss" dir="ltr">
            <span className="peepss-logo-circle" />
            <span className="peepss-logo-thin">p</span>
            <span className="peepss-logo-bold">ee</span>
            <span className="peepss-logo-thin">pss</span>
          </span>
          <div>
            <h1>Find your next shift or job</h1>
            <p>One profile. Swipe. Apply.</p>
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

          <div className="auth-card-heading">
            <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
            <p>
              {mode === 'login'
                ? 'Login to continue your Peepss search.'
                : 'Choose your track and start with the right flow.'}
            </p>
          </div>

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
                <legend>What kind of work are you looking for?</legend>
                <label>
                  <input
                    type="radio"
                    name="track"
                    value="highTech"
                    checked={track === 'highTech'}
                    onChange={() => setTrack('highTech')}
                  />
                  <span>
                    <strong>High-tech job seeker</strong>
                    <small>Track applications and use AI job matching.</small>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="track"
                    value="restaurant"
                    checked={track === 'restaurant'}
                    onChange={() => setTrack('restaurant')}
                  />
                  <span>
                    <strong>Restaurant worker</strong>
                    <small>Swipe restaurant shifts and apply quickly.</small>
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
                    <strong>Restaurant owner</strong>
                    <small>Post jobs and review applicants.</small>
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

          <Link
            to={mode === 'login' ? '/register' : '/login'}
            className="text-button"
          >
            {mode === 'login'
              ? 'Need an account? Register'
              : 'Already have an account? Login'}
          </Link>
        </div>

        <p className="auth-footer-note">
          Built for high-tech and restaurant work
        </p>
      </div>
    </section>
  )
}

export default AuthPage
