import { lazy, Suspense, useEffect, useState } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import ImmersiveLayout from './components/layout/ImmersiveLayout'
import PeepssLogo from './components/brand/PeepssLogo'
import StandardLayout from './components/layout/StandardLayout'
import ProtectedRoute from './components/routing/ProtectedRoute'
import { getCurrentUser, type AuthUser } from './features/auth/services/authApi'
import {
  AUTH_SESSION_EXPIRED_EVENT,
  clearAuthToken,
  getAuthToken,
  saveAuthToken,
} from './features/auth/utils/authStorage'
import {
  getOwnerProfile,
  getOwnerRestaurants,
} from './features/owner/services/ownerApi'
import type { OwnerProfile } from './features/owner/types/owner'
import {
  OwnerOnlyRestaurantRoute,
  OwnerRestaurantProvider,
} from './features/owner/context/OwnerRestaurantContext'
import {
  clearStoredOwnerRestaurantId,
} from './features/owner/utils/ownerRestaurantSelection'
import {
  getOwnerPostAuthBootstrap,
  loadOwnerPostAuthBootstrap,
  type OwnerPostAuthBootstrap,
} from './features/owner/utils/ownerPostAuthBootstrap'
import {
  getSafeOwnerApplicationsReturnTo,
  parseOwnerApplicationsDeepLink,
} from './features/owner/utils/ownerApplicationsDeepLink'
import { getRestaurantProfile } from './features/restaurant/services/restaurantApi'
import type { RestaurantWorkerProfile } from './features/restaurant/types/restaurant'
import { getStoredRestaurantLanguage } from './features/restaurant/utils/restaurantLanguage'

const AdminLeadsPage = lazy(
  () => import('./features/admin/pages/AdminLeadsPage'),
)
const AdminOverviewPage = lazy(
  () => import('./features/admin/pages/AdminOverviewPage'),
)
const AdminRestaurantDetailPage = lazy(
  () => import('./features/admin/pages/AdminRestaurantDetailPage'),
)
const AdminRestaurantsPage = lazy(
  () => import('./features/admin/pages/AdminRestaurantsPage'),
)
const AuthPage = lazy(() => import('./features/auth/pages/AuthPage'))
const DashboardPage = lazy(
  () => import('./features/dashboard/pages/DashboardPage'),
)
const DiscoverPage = lazy(
  () => import('./features/discovery/pages/DiscoverPage'),
)
const LikedJobsPage = lazy(
  () => import('./features/discovery/pages/LikedJobsPage'),
)
const JobDetailPage = lazy(
  () => import('./features/jobs/pages/JobDetailPage'),
)
const ImportJobPage = lazy(
  () => import('./features/jobs/pages/ImportJobPage'),
)
const JobsPage = lazy(() => import('./features/jobs/pages/jobsPage'))
const LegalPage = lazy(() => import('./features/legal/pages/LegalPage'))
const SmsUnsubscribePage = lazy(
  () => import('./features/legal/SmsUnsubscribePage'),
)
const OwnerApplicationsPage = lazy(
  () => import('./features/owner/pages/OwnerApplicationsPage'),
)
const OwnerJobsPage = lazy(
  () => import('./features/owner/pages/OwnerJobsPage'),
)
const OwnerProfilePage = lazy(
  () => import('./features/owner/pages/OwnerProfilePage'),
)
const OwnerTeamPage = lazy(
  () => import('./features/owner/pages/OwnerTeamPage'),
)
const ProfilePage = lazy(() => import('./features/profile/pages/ProfilePage'))
const RestaurantPublicApplyPage = lazy(
  () => import('./features/public/pages/RestaurantPublicApplyPage'),
)
const RestaurantClaimPage = lazy(
  () => import('./features/public/pages/RestaurantClaimPage'),
)
const RestaurantExplorePage = lazy(
  () => import('./features/restaurant/pages/RestaurantExplorePage'),
)
const RestaurantJobBoardDetailPage = lazy(
  () => import('./features/restaurant/pages/RestaurantJobBoardDetailPage'),
)
const RestaurantMapPage = lazy(
  () => import('./features/restaurant/pages/RestaurantMapPage'),
)
const RestaurantMatchesPage = lazy(
  () => import('./features/restaurant/pages/RestaurantMatchesPage'),
)
const RestaurantProfilePage = lazy(
  () => import('./features/restaurant/pages/RestaurantProfilePage'),
)

function RouteLoadingFallback() {
  const language = getStoredRestaurantLanguage()

  return (
    <section className="checking-session-screen" aria-live="polite">
      <div className="checking-session-card">
        <PeepssLogo className="checking-session-logo" />
        <p className="checking-session-text">
          {language === 'he' ? 'טוענים את העמוד…' : 'Loading page…'}
        </p>
      </div>
    </section>
  )
}

function getHomePath(user: AuthUser | null) {
  if (user?.isAdmin) {
    return '/admin/overview'
  }

  if (user?.restaurantMemberRole) {
    return '/owner/jobs'
  }

  if (user?.track === 'restaurant') {
    return '/restaurant/explore'
  }

  if (user?.track === 'restaurantOwner') {
    return '/owner/jobs'
  }

  return '/restaurants-only'
}

function isOwnerProfileComplete(profile: OwnerProfile | null) {
  return Boolean(
    profile?.restaurantName.trim() &&
      profile.slug?.trim() &&
      (profile.city.trim() || profile.street.trim()),
  )
}

function isWorkerProfileComplete(
  profile: RestaurantWorkerProfile | null,
  user: AuthUser | null,
) {
  if (!profile) {
    return false
  }

  const requiredFieldsComplete = Boolean(
    profile.fullName.trim() &&
      profile.phoneNumber.trim() &&
      profile.age >= 16 &&
      profile.age <= 80 &&
      profile.wantedRoles.length > 0 &&
      profile.experienceText.trim() &&
      profile.availability.trim(),
  )

  if (!requiredFieldsComplete || !profile.locationRequired) {
    return requiredFieldsComplete
  }

  return Boolean(
    user?.phoneNumber &&
      user.phoneVerifiedAt &&
      profile.homeGooglePlaceId,
  )
}

async function getPostAuthPath(
  user: AuthUser | null,
  preferredRestaurantId?: string | null,
): Promise<{
  path: string
  ownerBootstrap: OwnerPostAuthBootstrap | null
}> {
  if (user?.isAdmin) {
    return { path: getHomePath(user), ownerBootstrap: null }
  }

  if (user?.track === 'restaurant' && !user.restaurantMemberRole) {
    try {
      const profile = await getRestaurantProfile()

      return {
        path: isWorkerProfileComplete(profile, user)
          ? '/restaurant/explore'
          : '/restaurant/profile',
        ownerBootstrap: null,
      }
    } catch {
      return { path: '/restaurant/profile', ownerBootstrap: null }
    }
  }

  if (
    !user?.restaurantMemberRole &&
    user?.track !== 'restaurantOwner'
  ) {
    return { path: getHomePath(user), ownerBootstrap: null }
  }

  try {
    const ownerBootstrap = await loadOwnerPostAuthBootstrap(
      preferredRestaurantId,
      {
        getRestaurants: getOwnerRestaurants,
        getProfile: getOwnerProfile,
      },
    )

    return {
      path: isOwnerProfileComplete(ownerBootstrap.profile)
        ? '/owner/jobs'
        : '/owner/profile',
      ownerBootstrap,
    }
  } catch {
    return { path: '/owner/profile', ownerBootstrap: null }
  }
}

function ScrollToTop() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [location.pathname])

  return null
}

function getUserDisplayName(user: AuthUser | null) {
  return user?.email ?? user?.fullName ?? user?.phoneNumber ?? undefined
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [token, setToken] = useState<string | null>(() => getAuthToken())
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(() =>
    Boolean(getAuthToken()),
  )
  const [showAuthLoading, setShowAuthLoading] = useState(false)

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

  useEffect(() => {
    if (!isCheckingAuth) return

    const timeoutId = window.setTimeout(() => {
      setShowAuthLoading(true)
    }, 275)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isCheckingAuth])

  async function handleAuthSuccess(newToken: string, user: AuthUser) {
    saveAuthToken(newToken)
    setToken(newToken)
    setShowAuthLoading(false)
    setIsCheckingAuth(true)

    try {
      const returnTo = getSafeOwnerApplicationsReturnTo(
        (location.state as { returnTo?: unknown } | null)?.returnTo,
      )
      const preferredRestaurantId = returnTo
        ? parseOwnerApplicationsDeepLink(
            new URL(returnTo, window.location.origin).search,
          ).restaurantId
        : null
      const { path: nextPath, ownerBootstrap } = await getPostAuthPath(
        user,
        preferredRestaurantId,
      )
      const canReturnToOwnerApplications = Boolean(
        returnTo &&
          nextPath !== '/owner/profile' &&
          (user.restaurantMemberRole || user.track === 'restaurantOwner'),
      )

      setCurrentUser(user)
      navigate(
        canReturnToOwnerApplications && returnTo ? returnTo : nextPath,
        {
          replace: true,
          state: ownerBootstrap ? { ownerBootstrap } : null,
        },
      )
    } catch {
      clearAuthToken()
      setCurrentUser(null)
      setToken(null)
    } finally {
      setIsCheckingAuth(false)
    }
  }

  async function handlePublicAuthVerified(newToken: string) {
    saveAuthToken(newToken)
    setToken(newToken)

    try {
      const user = await getCurrentUser(newToken)
      setCurrentUser(user)
    } catch {
      clearAuthToken()
      setCurrentUser(null)
      setToken(null)
    }
  }

  async function handleRestaurantClaimSuccess(
    newToken: string,
    profileComplete: boolean,
  ) {
    saveAuthToken(newToken)
    setToken(newToken)
    setShowAuthLoading(false)
    setIsCheckingAuth(true)

    try {
      const user = await getCurrentUser(newToken)

      setCurrentUser(user)
      navigate(
        user.isAdmin
          ? '/admin/overview'
          : profileComplete
            ? '/owner/jobs'
            : '/owner/profile',
        { replace: true },
      )
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
    clearStoredOwnerRestaurantId()
    setCurrentUser(null)
    setToken(null)
    navigate('/login', { replace: true })
  }

  if (isCheckingAuth && showAuthLoading) {
    const language = getStoredRestaurantLanguage()
    const loadingText =
      language === 'he' ? 'מכינים את הכול…' : 'Getting things ready…'

    return (
      <section className="checking-session-screen" aria-live="polite">
        <div className="checking-session-card">
          <PeepssLogo className="checking-session-logo" />
          <p className="checking-session-text">{loadingText}</p>
        </div>
      </section>
    )
  }

  if (isCheckingAuth) {
    return null
  }

  const isAuthenticated = Boolean(token && currentUser)
  const userTrack = currentUser?.track ?? 'highTech'
  const isRestaurantOwnerAreaUser = Boolean(
    currentUser?.restaurantMemberRole || userTrack === 'restaurantOwner',
  )
  const isRestaurantWorkerOnly = Boolean(
    userTrack === 'restaurant' && !currentUser?.restaurantMemberRole,
  )
  const homePath = getHomePath(currentUser)
  const authRedirect = isAuthenticated ? (
    <Navigate to={homePath} replace />
  ) : null

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
      <Route
        element={
          <StandardLayout
            className="auth-standard-layout"
            footerClassName="auth-legal-footer"
          />
        }
      >
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
      </Route>
      <Route
        element={
          <StandardLayout
            className="public-apply-standard-layout"
            footerClassName="public-apply-legal-footer"
          />
        }
      >
        <Route
          path="/r/:restaurantSlug"
          element={
            <RestaurantPublicApplyPage
              onAuthVerified={handlePublicAuthVerified}
            />
          }
        />
      </Route>
      <Route
        element={
          <StandardLayout
            className="claim-standard-layout"
            footerClassName="claim-legal-footer"
          />
        }
      >
        <Route
          path="/claim/:restaurantSlug"
          element={
            <RestaurantClaimPage
              onClaimSuccess={handleRestaurantClaimSuccess}
            />
          }
        />
      </Route>
      <Route element={<StandardLayout className="legal-standard-layout" />}>
        <Route path="/sms/unsubscribe" element={<SmsUnsubscribePage />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route
          path="/accessibility"
          element={<LegalPage kind="accessibility" />}
        />
        <Route path="/contact" element={<LegalPage kind="contact" />} />
      </Route>

      <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
        <Route path="/admin/overview" element={<AdminOverviewPage />} />
        <Route path="/admin/candidates" element={<AdminLeadsPage />} />
        <Route
          path="/admin/leads"
          element={<Navigate to="/admin/candidates" replace />}
        />
        <Route
          path="/admin/restaurants"
          element={<AdminRestaurantsPage />}
        />
        <Route
          path="/admin/restaurants/:restaurantId"
          element={<AdminRestaurantDetailPage />}
        />

        <Route
          path="/restaurants-only"
          element={
            currentUser?.isAdmin ? (
              <Navigate to="/admin/overview" replace />
            ) : (
              <StandardLayout className="restaurant-only-standard-layout">
                <section className="restaurant-only-page">
                  <div className="restaurant-only-card">
                    <PeepssLogo className="auth-logo" />
                    <h1>Peepss is currently open for restaurants only.</h1>
                    <p>כרגע Peepss פתוחה למסעדות בלבד.</p>
                    <button
                      className="ui-button ui-button--secondary"
                      type="button"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                </section>
              </StandardLayout>
            )
          }
        />

        <Route
          element={
            currentUser?.isAdmin ? (
              <Navigate to="/admin/overview" replace />
            ) : userTrack === 'highTech' && !currentUser?.restaurantMemberRole ? (
              <Navigate to="/restaurants-only" replace />
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
            isRestaurantWorkerOnly ? (
              <ImmersiveLayout
                className="restaurant-shell restaurant-worker-shell restaurant-swipe-layout"
                mainClassName="restaurant-swipe-layout-main"
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
        </Route>

        <Route
          element={
            isRestaurantWorkerOnly ? (
              <AppLayout
                userEmail={getUserDisplayName(currentUser)}
                userTrack={userTrack}
                layoutMode="immersive"
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        >
          <Route path="/restaurant/map" element={<RestaurantMapPage />} />
        </Route>

        <Route
          element={
            isRestaurantWorkerOnly ? (
              <AppLayout
                userEmail={getUserDisplayName(currentUser)}
                userTrack={userTrack}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        >
          <Route
            path="/restaurant/profile"
            element={<RestaurantProfilePage />}
          />
          <Route
            path="/restaurant/restaurants/:restaurantId"
            element={<RestaurantJobBoardDetailPage />}
          />
          <Route
            path="/restaurant/matches"
            element={<RestaurantMatchesPage />}
          />
        </Route>

        <Route
          element={
            isRestaurantOwnerAreaUser ? (
              <OwnerRestaurantProvider
                bootstrap={getOwnerPostAuthBootstrap(location.state)}
              >
                <AppLayout
                  userEmail={getUserDisplayName(currentUser)}
                  userTrack="restaurantOwner"
                  restaurantMemberRole={currentUser?.restaurantMemberRole}
                  onLogout={handleLogout}
                />
              </OwnerRestaurantProvider>
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
          <Route
            path="/owner/profile"
            element={
              <OwnerOnlyRestaurantRoute>
                <OwnerProfilePage />
              </OwnerOnlyRestaurantRoute>
            }
          />
          <Route
            path="/owner/restaurants/new"
            element={
              <OwnerOnlyRestaurantRoute>
                <OwnerProfilePage mode="createAdditional" />
              </OwnerOnlyRestaurantRoute>
            }
          />
          <Route
            path="/owner/team"
            element={
              <OwnerOnlyRestaurantRoute>
                <OwnerTeamPage />
              </OwnerOnlyRestaurantRoute>
            }
          />
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
      </Suspense>
    </>
  )
}

export default App
