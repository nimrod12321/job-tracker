import { Navigate, Outlet, useLocation } from 'react-router-dom'

type ProtectedRouteProps = {
  isAuthenticated: boolean
}

function ProtectedRoute({ isAuthenticated }: ProtectedRouteProps) {
  const location = useLocation()

  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate
      to="/login"
      replace
      state={{ returnTo: `${location.pathname}${location.search}` }}
    />
  )
}

export default ProtectedRoute
