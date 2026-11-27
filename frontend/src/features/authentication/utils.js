import { COMPANY_MEMBER_ROLE, USER_ROLE, USER_STATUS } from '@/utils/constant'

const USER_ROLE_LABEL = Object.freeze({
  [USER_ROLE.CANDIDATE]: 'Ứng viên',
  [USER_ROLE.COMPANY_STAFF]: 'Doanh nghiệp',
  [USER_ROLE.PLATFORM_ADMIN]: 'Quản trị viên',
})

const POST_LOGIN_INTENT = Object.freeze({
  SAVE_JOB: 'SAVE_JOB',
  APPLY_JOB: 'APPLY_JOB',
})

const BLOCKED_RETURN_PREFIXES = Object.freeze([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/onboarding',
  '/admin',
])

function toPostLoginDestination(user) {
  // V02 BR-21: a PENDING_ACTIVATION Company Manager only has an onboarding session.
  if (user?.status === USER_STATUS.PENDING_ACTIVATION) {
    return '/onboarding/company'
  }

  if (user?.role === USER_ROLE.PLATFORM_ADMIN) {
    return '/admin'
  }

  return '/'
}

function isSafeReturnPath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) {
    return false
  }

  return !BLOCKED_RETURN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function readReturnLocation(from) {
  if (typeof from === 'string') {
    return isSafeReturnPath(from) ? { pathname: from, search: '', hash: '' } : null
  }

  const pathname = from?.pathname
  if (!isSafeReturnPath(pathname)) {
    return null
  }

  return {
    pathname,
    search: typeof from.search === 'string' ? from.search : '',
    hash: typeof from.hash === 'string' ? from.hash : '',
  }
}

function toLoginNavigationState(location, intent) {
  const from = readReturnLocation(location)
  if (!from && !intent) {
    return undefined
  }

  return {
    ...(from ? { from } : {}),
    ...(intent ? { intent } : {}),
  }
}

function toPostLoginLocation(user, navigationState, membership) {
  // Onboarding and Platform Admin destinations are mandatory session landings.
  if (user?.status === USER_STATUS.PENDING_ACTIVATION) {
    return { pathname: '/onboarding/company' }
  }

  if (user?.role === USER_ROLE.PLATFORM_ADMIN) {
    return { pathname: '/admin' }
  }

  const isCompanyManager = user?.role === USER_ROLE.COMPANY_STAFF && membership?.role === COMPANY_MEMBER_ROLE.COMPANY_MANAGER
  const defaultPath = '/'
  const from = readReturnLocation(navigationState?.from)
  if (!from || (isCompanyManager && from.pathname !== '/' && !from.pathname.startsWith('/company/'))) {
    return { pathname: defaultPath }
  }

  const intent =
    user?.role === USER_ROLE.CANDIDATE && navigationState?.intent ? navigationState.intent : undefined

  return intent ? { ...from, state: { intent } } : from
}

function getInitials(fullName) {
  return (fullName ?? '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .split(/\s+/)
    .filter((part) => /^[\p{L}\p{N}]/u.test(part))
    .slice(-2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export {
  POST_LOGIN_INTENT,
  USER_ROLE_LABEL,
  getInitials,
  toLoginNavigationState,
  toPostLoginDestination,
  toPostLoginLocation,
}
