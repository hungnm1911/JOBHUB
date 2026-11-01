import { Outlet, ScrollRestoration } from 'react-router-dom'

import AppFooter from '@/components/common/AppFooter'
import AppHeader from '@/components/common/AppHeader'
import FlashMessage from '@/components/common/FlashMessage'
import HeaderAccountMenu from '@/features/authentication/components/HeaderAccountMenu'

function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <ScrollRestoration />
      <AppHeader accountArea={<HeaderAccountMenu />} />

      <FlashMessage />

      <main className="flex flex-1">
        <Outlet />
      </main>

      <AppFooter />
    </div>
  )
}

export default RootLayout
