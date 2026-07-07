import { NavLink, Outlet } from 'react-router-dom'
import type { UserTrack } from '../../features/auth/services/authApi'
import RestaurantLanguageToggle from '../../features/restaurant/components/RestaurantLanguageToggle'
import { useRestaurantLanguage } from '../../features/restaurant/utils/restaurantLanguage'

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
  const { direction, language } = useRestaurantLanguage()
  const isRestaurantSide = isRestaurantUser || isRestaurantOwner
  const restaurantNavLabels = {
    ownerJobs: language === 'he' ? 'המשרות שלי' : 'My jobs',
    ownerApplications: language === 'he' ? 'מועמדים' : 'Applications',
    ownerProfile:
      language === 'he' ? 'פרופיל מסעדה' : 'Restaurant profile',
    workerExplore: language === 'he' ? 'משמרות' : 'Explore',
    workerMatches: language === 'he' ? 'התאמות' : 'Matches',
    workerProfile: language === 'he' ? 'פרופיל' : 'Profile',
    logout: language === 'he' ? 'התנתקות' : 'Log out',
  }

  return (
    <div
      className={`app-layout${isRestaurantSide ? ' restaurant-shell' : ''}`}
      dir={isRestaurantSide ? direction : undefined}
    >
      <header className="app-header">
        <h1 aria-label="Peepss">
          <span className="peepss-logo" aria-hidden="true" dir="ltr">
            <span className="peepss-logo-circle" />
            <span className="peepss-logo-thin">p</span>
            <span className="peepss-logo-bold">ee</span>
            <span className="peepss-logo-thin">pss</span>
          </span>
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
                {restaurantNavLabels.ownerJobs}
              </NavLink>
              <NavLink
                to="/owner/applications"
                end
                className={({ isActive }) =>
                  `nav-button${isActive ? ' active' : ''}`
                }
              >
                {restaurantNavLabels.ownerApplications}
              </NavLink>
              <NavLink
                to="/owner/profile"
                end
                className={({ isActive }) =>
                  `nav-button${isActive ? ' active' : ''}`
                }
              >
                {restaurantNavLabels.ownerProfile}
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
                {restaurantNavLabels.workerExplore}
              </NavLink>
              <NavLink
                to="/restaurant/matches"
                end
                className={({ isActive }) =>
                  `nav-button${isActive ? ' active' : ''}`
                }
              >
                {restaurantNavLabels.workerMatches}
              </NavLink>
              <NavLink
                to="/restaurant/profile"
                end
                className={({ isActive }) =>
                  `nav-button${isActive ? ' active' : ''}`
                }
              >
                {restaurantNavLabels.workerProfile}
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
          {isRestaurantSide && <RestaurantLanguageToggle />}
          {userEmail && <span>{userEmail}</span>}
          <button type="button" onClick={onLogout}>
            {isRestaurantSide ? restaurantNavLabels.logout : 'Log out'}
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
