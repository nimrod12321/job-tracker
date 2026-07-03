import { useState } from 'react'
import AppLayout from './components/layout/AppLayout'
import AuthPage from './features/auth/pages/AuthPage'
import JobsPage from './features/jobs/pages/jobsPage'
import {
  clearAuthToken,
  getAuthToken,
  saveAuthToken,
} from './features/auth/utils/authStorage'

function App() {
  const [token, setToken] = useState<string | null>(() => getAuthToken())

  function handleAuthSuccess(newToken: string) {
    saveAuthToken(newToken)
    setToken(newToken)
  }

  function handleLogout() {
    clearAuthToken()
    setToken(null)
  }

  if (!token) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <AppLayout onLogout={handleLogout}>
      <JobsPage />
    </AppLayout>
  )
}

export default App