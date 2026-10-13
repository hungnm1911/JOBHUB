import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import AuthenticationBootstrap from '@/features/authentication/components/AuthenticationBootstrap'
import router from '@/routes'
import { TOASTER_CONFIG } from '@/utils/constant'

function App() {
  return (
    <>
      <AuthenticationBootstrap>
        <RouterProvider router={router} />
      </AuthenticationBootstrap>
      <Toaster {...TOASTER_CONFIG} />
    </>
  )
}

export default App
