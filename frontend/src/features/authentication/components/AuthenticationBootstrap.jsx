import { useEffect } from 'react'

import { bootstrapAuthentication } from '../services/authentication.service'

function AuthenticationBootstrap({ children }) {
  useEffect(() => {
    bootstrapAuthentication().catch(() => {
      // Auth state distinguishes invalid credentials from temporary failures.
    })
  }, [])

  return children
}

export default AuthenticationBootstrap
