import type { ReactNode } from 'react'

type AppLayoutProps = {
  children: ReactNode
  userEmail?: string
  onLogout?: () => void
}

function AppLayout({ children, userEmail, onLogout }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>AI Job Tracker</h1>

        <nav>
          <a href="#">Dashboard</a>
          <a href="#">Jobs</a>
          <a href="#">AI Assistant</a>
          <a href="#">Analytics</a>
          <a href="#">Settings</a>
        </nav>

        <div className="header-user-actions">
          {userEmail && <span>{userEmail}</span>}

          {onLogout && (
            <button type="button" onClick={onLogout}>
              Logout
            </button>
          )}
        </div>
      </header>

      <main className="app-content">{children}</main>
    </div>
  )
}

export default AppLayout