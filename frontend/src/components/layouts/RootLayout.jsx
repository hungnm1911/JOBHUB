import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'

import AppFooter from '@/components/common/AppFooter'
import AppHeader from '@/components/common/AppHeader'
import FlashMessage from '@/components/common/FlashMessage'
import UnsavedChangesProvider from '@/components/common/UnsavedChangesProvider'
import HeaderAccountMenu from '@/features/authentication/components/HeaderAccountMenu'
import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
import { cn } from '@/lib/utils'
import { USER_ROLE } from '@/utils/constant'

function RootLayout() {
  const location = useLocation()
  const viewer = useSessionViewer()
  const isAccountActivationFlow = location.pathname === '/activate-recruiter'
  const isCandidate = !isAccountActivationFlow && viewer.resolved && viewer.role === USER_ROLE.CANDIDATE
  const isFullBleedWorkspace = location.pathname.startsWith('/candidate/messages')

  return (
    <UnsavedChangesProvider>
      <div
        className={cn(
          'flex flex-col',
          isFullBleedWorkspace ? 'h-svh overflow-hidden' : 'min-h-svh',
        )}
      >
        <ScrollRestoration />
        <AppHeader
          accountArea={isAccountActivationFlow ? null : <HeaderAccountMenu />}
          isCandidate={isCandidate}
        />

        <FlashMessage />

        <main
          className={cn(
            'flex flex-1',
            isFullBleedWorkspace && 'min-h-0 overflow-hidden',
          )}
        >
          <Outlet />
        </main>

        {!isFullBleedWorkspace && <AppFooter />}
      </div>
    </UnsavedChangesProvider>
  )
}

export default RootLayout
