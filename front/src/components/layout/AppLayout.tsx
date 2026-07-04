import type { ReactNode } from 'react'

export type AppPage = 'jobs' | 'profile'

type AppLayoutProps = {
  children: ReactNode
  activePage: AppPage
  userEmail?: string
  onNavigate: (page: AppPage) => void
  onLogout?: () => void
}

function AppLayout({
  children,
  activePage,
  userEmail,
  onNavigate,
  onLogout,
}: AppLayoutProps) {
  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>AI Job Tracker</h1>

        <nav aria-label="Main navigation">
          <button
            type="button"
            className={`nav-button${activePage === 'jobs' ? ' active' : ''}`}
            aria-current={activePage === 'jobs' ? 'page' : undefined}
            onClick={() => onNavigate('jobs')}
          >
            Jobs
          </button>
          <button
            type="button"
            className={`nav-button${activePage === 'profile' ? ' active' : ''}`}
            aria-current={activePage === 'profile' ? 'page' : undefined}
            onClick={() => onNavigate('profile')}
          >
            Profile
          </button>
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
