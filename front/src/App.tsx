import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/routing/ProtectedRoute'
import { getCurrentUser, type AuthUser } from './features/auth/services/authApi'
import {
  AUTH_SESSION_EXPIRED_EVENT,
  clearAuthToken,
  getAuthToken,
  saveAuthToken,
} from './features/auth/utils/authStorage'
import AuthPage from './features/auth/pages/AuthPage'
import DashboardPage from './features/dashboard/pages/DashboardPage'
import JobDetailPage from './features/jobs/pages/JobDetailPage'
import JobsPage from './features/jobs/pages/jobsPage'
import ProfilePage from './features/profile/pages/ProfilePage'

function App() {
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(() => getAuthToken())
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(() =>
    Boolean(getAuthToken()),
  )

  useEffect(() => {
    const existingToken = getAuthToken()

    if (!existingToken) {
      return
    }

    async function checkCurrentUser(validToken: string) {
      try {
        const user = await getCurrentUser(validToken)
        setCurrentUser(user)
        setToken(validToken)
      } catch {
        clearAuthToken()
        setCurrentUser(null)
        setToken(null)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    void checkCurrentUser(existingToken)
  }, [])

  useEffect(() => {
    function handleSessionExpired() {
      clearAuthToken()
      setCurrentUser(null)
      setToken(null)
      navigate('/login', { replace: true })
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)

    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)
    }
  }, [navigate])

  async function handleAuthSuccess(newToken: string) {
    saveAuthToken(newToken)
    setToken(newToken)
    setIsCheckingAuth(true)

    try {
      const user = await getCurrentUser(newToken)
      setCurrentUser(user)
      navigate('/jobs', { replace: true })
    } catch {
      clearAuthToken()
      setCurrentUser(null)
      setToken(null)
    } finally {
      setIsCheckingAuth(false)
    }
  }

  function handleLogout() {
    clearAuthToken()
    setCurrentUser(null)
    setToken(null)
    navigate('/login', { replace: true })
  }

  if (isCheckingAuth) {
    return <p>Checking session...</p>
  }

  const isAuthenticated = Boolean(token && currentUser)
  const authRedirect = isAuthenticated ? <Navigate to="/jobs" replace /> : null

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authRedirect ?? (
            <AuthPage
              key="login"
              mode="login"
              onAuthSuccess={handleAuthSuccess}
            />
          )
        }
      />
      <Route
        path="/register"
        element={
          authRedirect ?? (
            <AuthPage
              key="register"
              mode="register"
              onAuthSuccess={handleAuthSuccess}
            />
          )
        }
      />

      <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
        <Route
          element={
            <AppLayout
              userEmail={currentUser?.email}
              onLogout={handleLogout}
            />
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route
        path="/"
        element={
          <Navigate to={isAuthenticated ? '/jobs' : '/login'} replace />
        }
      />
      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? '/jobs' : '/login'} replace />
        }
      />
    </Routes>
  )
}

export default App
