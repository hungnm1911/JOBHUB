import { Outlet } from 'react-router-dom'

import AppFooter from '@/components/common/AppFooter'
import AppHeader from '@/components/common/AppHeader'
import FlashMessage from '@/components/common/FlashMessage'

function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />

      <FlashMessage />

      <main className="flex flex-1">
        <Outlet />
      </main>

      <AppFooter />
    </div>
  )
}

export default RootLayout
