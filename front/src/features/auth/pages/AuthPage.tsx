import { useState, type FormEvent } from 'react'
import { loginUser, registerUser } from '../services/authApi'

type AuthPageProps = {
  onAuthSuccess: (token: string) => void
}

function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response =
        mode === 'login'
          ? await loginUser(email, password)
          : await registerUser(email, password)

      onAuthSuccess(response.token)
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

          {error && <p className="error-message">{error}</p>}

          <button type="submit" disabled={isLoading}>
            {isLoading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Login'
                : 'Register'}
          </button>
        </form>

        <button
          type="button"
          className="text-button"
          onClick={() => {
            setError(null)
            setMode((currentMode) =>
              currentMode === 'login' ? 'register' : 'login',
            )
          }}
        >
          {mode === 'login'
            ? 'Need an account? Register'
            : 'Already have an account? Login'}
        </button>
      </div>
    </section>
  )
}

export default AuthPage