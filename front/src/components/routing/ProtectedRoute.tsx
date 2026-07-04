import { Navigate, Outlet } from 'react-router-dom'

type ProtectedRouteProps = {
  isAuthenticated: boolean
}

function ProtectedRoute({ isAuthenticated }: ProtectedRouteProps) {
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

export default ProtectedRoute
