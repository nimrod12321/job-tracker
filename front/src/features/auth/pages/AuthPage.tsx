import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { loginUser, registerUser } from '../services/authApi'

type AuthPageProps = {
  mode: 'login' | 'register'
  onAuthSuccess: (token: string) => Promise<void>
}

function AuthPage({ mode, onAuthSuccess }: AuthPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (mode === 'register') {
        await registerUser(email, password)
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
