import { useEffect, useState } from 'react'
import AppLayout from './components/layout/AppLayout'
import type { AppPage } from './components/layout/AppLayout'
import AuthPage from './features/auth/pages/AuthPage'
import JobsPage from './features/jobs/pages/jobsPage'
import ProfilePage from './features/profile/pages/ProfilePage'
import { getCurrentUser, type AuthUser } from './features/auth/services/authApi'
import {
  AUTH_SESSION_EXPIRED_EVENT,
  clearAuthToken,
  getAuthToken,
  saveAuthToken,
} from './features/auth/utils/authStorage'

function App() {
  const [token, setToken] = useState<string | null>(() => getAuthToken())
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(() => Boolean(getAuthToken()))
  const [activePage, setActivePage] = useState<AppPage>('jobs')

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
      setActivePage('jobs')
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)

    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)
    }
  }, [])

  async function handleAuthSuccess(newToken: string) {
    saveAuthToken(newToken)
    setToken(newToken)
    setIsCheckingAuth(true)

    try {
      const user = await getCurrentUser(newToken)
      setCurrentUser(user)
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
    setActivePage('jobs')
  }

  if (isCheckingAuth) {
    return <p>Checking session...</p>
  }

  if (!token || !currentUser) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <AppLayout
      activePage={activePage}
      userEmail={currentUser.email}
      onNavigate={setActivePage}
      onLogout={handleLogout}
    >
      {activePage === 'jobs' ? <JobsPage /> : <ProfilePage />}
    </AppLayout>
  )
}

export default App
