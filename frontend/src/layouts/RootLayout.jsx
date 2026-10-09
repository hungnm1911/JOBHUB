import { Outlet } from 'react-router-dom'

import AppHeader from '@/components/common/AppHeader'

function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />

      <main className="flex flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export default RootLayout
