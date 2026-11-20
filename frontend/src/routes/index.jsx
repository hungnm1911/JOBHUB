import { createBrowserRouter } from 'react-router-dom'

import RootLayout from '@/components/layouts/RootLayout'

import candidateRoutes from './candidate.routes'
import companyManagerRoutes from './company-manager.routes'
import guestRoutes from './guest.routes'
import platformAdminRoutes from './platform-admin.routes'
import publicRoutes from './public.routes'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [...publicRoutes, guestRoutes, companyManagerRoutes, ...candidateRoutes],
  },
  ...platformAdminRoutes,
])

export default router

