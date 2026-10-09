import { Navigate, Outlet } from 'react-router-dom'

function ProtectedRoute({ isAuthenticated, redirectTo, children }) {
  if (!isAuthenticated) {
    return <Navigate replace to={redirectTo} />
  }

  return children ?? <Outlet />
}

export default ProtectedRoute
