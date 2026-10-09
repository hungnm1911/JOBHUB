import { Navigate, Outlet } from 'react-router-dom'

function RoleRoute({ currentRole, allowedRoles, redirectTo, children }) {
  if (!allowedRoles.includes(currentRole)) {
    return <Navigate replace to={redirectTo} />
  }

  return children ?? <Outlet />
}

export default RoleRoute
