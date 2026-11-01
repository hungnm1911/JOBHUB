import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { configureStore } from '@reduxjs/toolkit'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
})

after(() => vite.close())

const { default: RoleRoute } = await vite.ssrLoadModule('/src/routes/components/RoleRoute.jsx')

const managerRoute = {
  allowedRoles: ['COMPANY_STAFF'],
  allowedStatuses: ['ACTIVE'],
  allowedMembershipRoles: ['COMPANY_MANAGER'],
  allowedMembershipStatuses: ['ACTIVE'],
  redirectTo: '/access-denied',
}

function renderRoute(authentication, routeProps = managerRoute) {
  const store = configureStore({
    reducer: { authentication: () => authentication },
  })

  return renderToStaticMarkup(
    createElement(
      Provider,
      { store },
      createElement(
        MemoryRouter,
        null,
        createElement(RoleRoute, {
          ...routeProps,
          children: createElement('span', null, 'protected content'),
        }),
      ),
    ),
  )
}

function staffAuthentication(membership, accountContextStatus = 'resolved') {
  return {
    status: 'authenticated',
    user: { id: 'staff-1', role: 'COMPANY_STAFF', status: 'ACTIVE' },
    membership,
    accountContextStatus,
  }
}

test('Company Manager route admits only an active Company Manager membership', () => {
  const manager = { role: 'COMPANY_MANAGER', status: 'ACTIVE' }
  assert.match(renderRoute(staffAuthentication(manager)), /protected content/)

  const recruiter = { role: 'RECRUITER', status: 'ACTIVE' }
  assert.doesNotMatch(renderRoute(staffAuthentication(recruiter)), /protected content/)

  const lockedManager = { role: 'COMPANY_MANAGER', status: 'LOCKED' }
  assert.doesNotMatch(renderRoute(staffAuthentication(lockedManager)), /protected content/)
  assert.doesNotMatch(renderRoute(staffAuthentication(null)), /protected content/)
})

test('membership-gated route waits for context and offers retry when it is unavailable', () => {
  const loading = renderRoute(staffAuthentication(null, 'loading'))
  assert.match(loading, /Đang xác định quyền trong doanh nghiệp/)
  assert.doesNotMatch(loading, /protected content/)

  const unavailable = renderRoute(staffAuthentication(null, 'unavailable'))
  assert.match(unavailable, /Chưa tải được quyền truy cập/)
  assert.match(unavailable, /Thử lại/)
  assert.doesNotMatch(unavailable, /protected content/)
})

test('account-only routes retain their user role and status behavior', () => {
  const adminRoute = { allowedRoles: ['PLATFORM_ADMIN'] }
  const admin = {
    status: 'authenticated',
    user: { id: 'admin-1', role: 'PLATFORM_ADMIN', status: 'ACTIVE' },
    membership: null,
    accountContextStatus: 'unresolved',
  }
  assert.match(renderRoute(admin, adminRoute), /protected content/)
  assert.doesNotMatch(renderRoute(staffAuthentication(null), adminRoute), /protected content/)
})
