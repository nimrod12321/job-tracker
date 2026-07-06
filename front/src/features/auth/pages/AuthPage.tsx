import { useState, type FormEvent } from 'react'
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

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>{mode === 'login' ? 'Login' : 'Create account'}</h1>
        <p>
          {mode === 'login'
            ? 'Login to manage your job applications.'
            : 'Create an account to start tracking your jobs.'}
        </p>

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
                  <strong>High-tech</strong>
                  <small>Tech jobs, AI matching, and application tracking</small>
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
                  <small>Simple restaurant jobs and quick applications</small>
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
    </section>
  )
}

export default AuthPage
