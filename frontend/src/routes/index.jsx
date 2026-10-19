import { createBrowserRouter } from 'react-router-dom'

import platformAdminRoutes from './platform-admin.routes'
import publicRoutes from './public.routes'

const router = createBrowserRouter([...publicRoutes, ...platformAdminRoutes])

export default router
