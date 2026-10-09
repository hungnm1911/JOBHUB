import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import router from '@/routes'
import { TOASTER_CONFIG } from '@/utils/constant'

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster {...TOASTER_CONFIG} />
    </>
  )
}

export default App
