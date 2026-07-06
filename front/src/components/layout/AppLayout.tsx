import { NavLink, Outlet } from 'react-router-dom'
import type { UserTrack } from '../../features/auth/services/authApi'

type AppLayoutProps = {
  userEmail?: string
  userTrack?: UserTrack
  onLogout: () => void
}

function AppLayout({
  userEmail,
  userTrack = 'highTech',
  onLogout,
}: AppLayoutProps) {
  const isRestaurantUser = userTrack === 'restaurant'
  const isRestaurantOwner = userTrack === 'restaurantOwner'

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span>Peepss</span>
        </h1>

        <nav aria-label="Main navigation">
          {isRestaurantOwner ? (
            <>
              <NavLink
                to="/owner/jobs"
                end
                className={({ isActive }) =>
                  `nav-button${isActive ? ' active' : ''}`
                }
              >
                My jobs
              </NavLink>
              <NavLink
                to="/owner/profile"
                end
                className={({ isActive }) =>
                  `nav-button${isActive ? ' active' : ''}`
                }
              >
                Restaurant profile
              </NavLink>
            </>
          ) : isRestaurantUser ? (
            <>
              <NavLink
                to="/restaurant/explore"
                end
                className={({ isActive }) =>
                  `nav-button${isActive ? ' active' : ''}`
                }
              >
                Explore
              </NavLink>
              <NavLink
                to="/restaurant/profile"
                end
                className={({ isActive }) =>
                  `nav-button${isActive ? ' active' : ''}`
                }
              >
                Profile
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/dashboard"
                end
                className={({ isActive }) =>
                  `nav-button${isActive ? ' active' : ''}`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/discover"
                className={({ isActive }) =>
                  `nav-button${isActive ? ' active' : ''}`
                }
              >
                Discover
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
                end
                className={({ isActive }) =>
                  `nav-button${isActive ? ' active' : ''}`
                }
              >
                Profile
              </NavLink>
            </>
          )}
        </nav>

        <div className="header-user-actions">
          {userEmail && <span>{userEmail}</span>}
          <button type="button" onClick={onLogout}>
            Log out
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
