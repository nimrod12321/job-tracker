import { NavLink, Outlet } from 'react-router-dom'

type AppLayoutProps = {
  userEmail?: string
  onLogout: () => void
}

function AppLayout({ userEmail, onLogout }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>AI Job Tracker</h1>

        <nav aria-label="Main navigation">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `nav-button${isActive ? ' active' : ''}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/jobs"
            className={({ isActive }) =>
              `nav-button${isActive ? ' active' : ''}`
            }
          >
            Jobs
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `nav-button${isActive ? ' active' : ''}`
            }
          >
            Profile
          </NavLink>
        </nav>

        <div className="header-user-actions">
          {userEmail && <span>{userEmail}</span>}
          <button type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
