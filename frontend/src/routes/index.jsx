import { createBrowserRouter } from 'react-router-dom'

import RootLayout from '@/layouts/RootLayout'

import companyManagerRoutes from './company-manager.routes'
import guestRoutes from './guest.routes'
import platformAdminRoutes from './platform-admin.routes'
import publicRoutes from './public.routes'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [...publicRoutes, guestRoutes, companyManagerRoutes],
  },
  ...platformAdminRoutes,
])

export default router
