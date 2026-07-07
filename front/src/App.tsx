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
import DiscoverPage from './features/discovery/pages/DiscoverPage'
import LikedJobsPage from './features/discovery/pages/LikedJobsPage'
import JobDetailPage from './features/jobs/pages/JobDetailPage'
import ImportJobPage from './features/jobs/pages/ImportJobPage'
import JobsPage from './features/jobs/pages/jobsPage'
import OwnerApplicationsPage from './features/owner/pages/OwnerApplicationsPage'
import OwnerJobsPage from './features/owner/pages/OwnerJobsPage'
import OwnerProfilePage from './features/owner/pages/OwnerProfilePage'
import ProfilePage from './features/profile/pages/ProfilePage'
import RestaurantExplorePage from './features/restaurant/pages/RestaurantExplorePage'
import RestaurantMatchesPage from './features/restaurant/pages/RestaurantMatchesPage'
import RestaurantProfilePage from './features/restaurant/pages/RestaurantProfilePage'

function getHomePath(user: AuthUser | null) {
  if (user?.track === 'restaurant') {
    return '/restaurant/explore'
  }

  if (user?.track === 'restaurantOwner') {
    return '/owner/jobs'
  }

  return '/dashboard'
}

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
      navigate(getHomePath(user), { replace: true })
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
    return (
      <section className="checking-session-screen" aria-live="polite">
        <div className="checking-session-card">
          <span
            className="peepss-logo checking-session-logo"
            aria-label="Peepss"
            dir="ltr"
          >
            <span className="peepss-logo-circle" />
            <span className="peepss-logo-thin">p</span>
            <span className="peepss-logo-bold">ee</span>
            <span className="peepss-logo-thin">pss</span>
          </span>
          <p className="checking-session-text">Checking session...</p>
        </div>
      </section>
    )
  }

  const isAuthenticated = Boolean(token && currentUser)
  const userTrack = currentUser?.track ?? 'highTech'
  const homePath = getHomePath(currentUser)
  const authRedirect = isAuthenticated ? (
    <Navigate to={homePath} replace />
  ) : null

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
            userTrack === 'highTech' ? (
              <AppLayout
                userEmail={currentUser?.email}
                userTrack={userTrack}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/discover/liked" element={<LikedJobsPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/import" element={<ImportJobPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route
          element={
            userTrack === 'restaurant' ? (
              <AppLayout
                userEmail={currentUser?.email}
                userTrack={userTrack}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        >
          <Route
            path="/restaurant/explore"
            element={<RestaurantExplorePage />}
          />
          <Route
            path="/restaurant/profile"
            element={<RestaurantProfilePage />}
          />
          <Route
            path="/restaurant/matches"
            element={<RestaurantMatchesPage />}
          />
        </Route>

        <Route
          element={
            userTrack === 'restaurantOwner' ? (
              <AppLayout
                userEmail={currentUser?.email}
                userTrack={userTrack}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        >
          <Route path="/owner/jobs" element={<OwnerJobsPage />} />
          <Route
            path="/owner/applications"
            element={<OwnerApplicationsPage />}
          />
          <Route path="/owner/profile" element={<OwnerProfilePage />} />
        </Route>
      </Route>

      <Route
        path="/"
        element={
          <Navigate to={isAuthenticated ? homePath : '/login'} replace />
        }
      />
      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? homePath : '/login'} replace />
        }
      />
    </Routes>
  )
}

export default App
