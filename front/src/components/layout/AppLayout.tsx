import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import LegalFooter from '../legal/LegalFooter'
import type { UserTrack } from '../../features/auth/services/authApi'
import RestaurantLanguageToggle from '../../features/restaurant/components/RestaurantLanguageToggle'
import { useRestaurantLanguage } from '../../features/restaurant/utils/restaurantLanguage'

type AppLayoutProps = {
  userEmail?: string
  userTrack?: UserTrack
  restaurantMemberRole?: 'owner' | 'hiringManager' | null
  layoutMode?: 'standard' | 'immersive'
  onLogout: () => void
}

function AppLayout({
  userEmail,
  userTrack = 'highTech',
  restaurantMemberRole = null,
  layoutMode = 'standard',
  onLogout,
}: AppLayoutProps) {
  const location = useLocation()
  const isRestaurantUser = userTrack === 'restaurant'
  const isRestaurantOwner = userTrack === 'restaurantOwner'
  const [isOptionsOpen, setIsOptionsOpen] = useState(false)
  const optionsRef = useRef<HTMLDivElement | null>(null)
  const { direction, language } = useRestaurantLanguage()
  const isRestaurantSide = isRestaurantUser || isRestaurantOwner
  const canManageOwnerTeam =
    isRestaurantOwner && restaurantMemberRole !== 'hiringManager'
  const layoutClassName = [
    'app-layout',
    isRestaurantSide ? 'restaurant-shell' : '',
    isRestaurantUser ? 'restaurant-worker-shell' : '',
    isRestaurantOwner ? 'restaurant-owner-shell' : '',
    layoutMode === 'immersive' ? 'app-layout-immersive' : 'app-layout-standard',
  ]
    .filter(Boolean)
    .join(' ')
  const restaurantNavLabels = {
    ownerJobs: language === 'he' ? 'גיוס QR' : 'QR hiring',
    ownerApplications: language === 'he' ? 'מועמדים' : 'Applications',
    ownerTeam: language === 'he' ? 'צוות' : 'Team',
    ownerProfile: language === 'he' ? 'פרופיל' : 'Profile',
    workerExplore: language === 'he' ? 'משמרות' : 'Explore',
    workerMatches: language === 'he' ? 'התאמות' : 'Matches',
    workerProfile: language === 'he' ? 'פרופיל' : 'Profile',
    logout: language === 'he' ? 'התנתקות' : 'Log out',
  }

  useEffect(() => {
    if (!isOptionsOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (
        optionsRef.current &&
        !optionsRef.current.contains(event.target as Node)
      ) {
        setIsOptionsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOptionsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOptionsOpen])

  useEffect(() => {
    if (!isRestaurantSide) {
      return
    }

    const activeElement = document.activeElement

    if (
      activeElement instanceof HTMLElement &&
      activeElement.matches('input, textarea, select')
    ) {
      activeElement.blur()
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [isRestaurantSide, location.pathname])

  return (
    <div
      className={layoutClassName}
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

        <nav
          aria-label="Main navigation"
          className={isRestaurantOwner ? 'owner-main-nav' : undefined}
        >
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

        {isRestaurantSide ? (
          <div className="restaurant-options" ref={optionsRef}>
            <button
              type="button"
              className="restaurant-options-trigger"
              aria-label={language === 'he' ? 'אפשרויות' : 'Options'}
              aria-expanded={isOptionsOpen}
              onClick={() =>
                setIsOptionsOpen((currentIsOpen) => !currentIsOpen)
              }
            >
              ⋯
            </button>

            {isOptionsOpen && (
              <div className="restaurant-options-menu">
                {(!isRestaurantOwner || canManageOwnerTeam) && (
                  <Link
                    to={
                      isRestaurantOwner
                        ? '/owner/profile'
                        : '/restaurant/profile'
                    }
                    onClick={() => setIsOptionsOpen(false)}
                  >
                    {isRestaurantOwner
                      ? restaurantNavLabels.ownerProfile
                      : restaurantNavLabels.workerProfile}
                  </Link>
                )}
                {isRestaurantOwner && canManageOwnerTeam && (
                  <Link
                    to="/owner/team"
                    onClick={() => setIsOptionsOpen(false)}
                  >
                    {restaurantNavLabels.ownerTeam}
                  </Link>
                )}
                <RestaurantLanguageToggle
                  onChange={() => setIsOptionsOpen(false)}
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsOpen(false)
                    onLogout()
                  }}
                >
                  {restaurantNavLabels.logout}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="header-user-actions">
            {userEmail && <span>{userEmail}</span>}
            <button type="button" onClick={onLogout}>
              Log out
            </button>
          </div>
        )}
      </header>

      <main className="app-content">
        <Outlet />
      </main>
      {layoutMode === 'standard' && (
        <LegalFooter className="app-legal-footer" />
      )}
    </div>
  )
}

export default AppLayout
