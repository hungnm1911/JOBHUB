# Frontend V1 Authentication Foundation Project Status

## Current project state

The frontend foundation and V1 authentication lifecycle infrastructure are
`IMPLEMENTED AND VERIFIED` as of 2026-11-01. The
existing React + Vite application now has Tailwind CSS v4 and shadcn/ui
configuration, the `@` import alias, a Redux Toolkit provider/store, nested
React Router composition with a shared layout and runnable sample page, one
owned Axios client with normalized errors, and a lazy authenticated Socket.IO
client. React Hook Form and Zod are
integrated through the official resolver. `src/validation/index.js` is the
application-wide validation provider; reusable implementations live in focused
modules such as `common.validators.js`, and future form schemas are exported
through the provider for React Hook Form consumers. Routing is composed from
route-group modules; login and registration now use `GuestRoute`, while
public recovery and token screens remain accessible with or without a session.
The guest guard uses the existing post-login destination for authenticated
users. A successful password reset ends this browser's current session before
navigating to guest-only login. Protected and Role guards consume resolved
state from the Authentication feature; `RoleRoute` can also require a resolved
CompanyMember role/status for future Company Staff routes. Authentication persists
one owned localStorage record, restores a session through refresh on reload,
marks infrastructure restoration failures as temporarily unavailable without
discarding credentials, and keeps Redux UI state and Socket.IO lifecycle in
sync. For authenticated Company Staff, the bootstrap loads current membership
through `GET /auth/me` into transient Redux state; login, logout, account switch,
and reload clear or refresh that context. The Axios client attaches Bearer
credentials only to explicitly protected requests and performs reactive,
single-flight `401` refresh with a one-retry
limit; login/refresh remain public, business `403` responses do not refresh,
and logout remains protected so it may refresh before revoking the session.
The focused authentication tests, frontend ESLint, and Vite production build
passed. Guest authentication screens exist under `/register`,
`/register/candidate`, `/register/company`, and `/login`; `/forgot-password`,
`/reset-password`, and `/verify-email` remain public (email verification opens
from the verification email and consumes the token once through
`POST /api/auth/verify-email`); login and both registrations dispatch Redux Toolkit
`createAsyncThunk` actions from
`features/authentication/services/authentication-thunks.js`, which delegate to
the authentication manager (login, Company Manager onboarding session) or the
auth API module (Candidate registration). Sonner (`sonner`
2.0.8) is the transient toast library: `App.jsx` mounts the single
`<Toaster />` by spreading the application-wide `TOASTER_CONFIG`, and
consumers call `toast` from `sonner` directly without extra setup. The defaults
are:
- top-right position, light theme, rich success/error colors, and a close
  button;
- 4,000 ms duration, three visible toasts, and 24/16 px desktop/mobile
  offsets;
- Vietnamese accessible labels; and
- theme-token neutral styling with the application font.

## Implementation record (slice detail)

Toasts are not the persisted Notification feature.
`frontend/src/utils/constant.js` is now the central owner of frontend project
constants and the only `VITE_*` reader. It holds:
- `API_CONFIG`, `API_ERROR_MESSAGE`, `SOCKET_CONFIG`, `REALTIME_EVENT` (moved
  from the removed `src/socket/realtime-event.js`), `VALIDATION_MESSAGE`, and
  `TOASTER_CONFIG`.

The HTTP client, API error normalizer, socket client, common validators, and
`App.jsx` consume them. Verification after this change:
- frontend lint and build passed; and
- a browser smoke check on the dev server confirmed one Toaster with the
  configured position, theme, rich colors, close label, 24 px offset,
  inherited Inter font, `--popover` neutral background, 12 px radius, and
  automatic dismissal after about 4 seconds.

**Frontend:**
- `normalizeApiError` now reads the backend `{ error: { message, details } }`
  body. Previously it showed Axios's generic message.
- `ApiError` exposes `requestId`.
- The Axios client logs failed requests to the browser console in development
  only. The log includes status, code, request id, details, params, the server
  stack, and the cause, but not the request body.

## Verification status

- 2026-11-01 membership-aware `RoleRoute`: `cd frontend && yarn verify:agent`
  passed 20 focused authentication/route tests, ESLint, and the production
  build. Three new SSR tests cover active Company Manager access, Recruiter and
  locked/missing membership denial, loading and retry states, and unchanged
  account-only guard behavior. No browser or live-backend check was performed;
  no new Company Manager route was added.

- 2026-11-01 CompanyMember context: `cd frontend && yarn verify:agent`
  passed 17 authentication tests, ESLint, and the production build. Four new
  focused tests cover `/auth/me` load deduplication, account-switch response
  isolation, failure/retry, and skipping the request for non-staff accounts.
  No browser or live-backend check was performed for this addition.

- 2026-11-01 route grouping: `cd frontend && yarn verify:agent` passed 13
  authentication tests, ESLint, and the production build. A route matching
  check confirmed 14 paths and their guard boundaries. No browser check was
  performed for these route changes.

- Frontend `yarn lint` and `yarn build` passed.

- Frontend V1 authentication lifecycle (2026-10-13): 11 focused Node tests
  passed for explicit protected/public request behavior, one-retry prevention,
  single-flight concurrent refresh, invalid-refresh invalidation, transient
  refresh credential preservation/retry, reload bootstrap, login synchronization,
  and logout cleanup. `cd frontend && yarn verify:agent` passed the focused
  tests, ESLint, and the Vite production build. No browser/end-to-end check was
  performed.

- Frontend authentication screens and thunks (2026-10-18): `cd frontend &&
  yarn verify:agent` passed 12 focused tests (including Company Manager
  registration establishing the onboarding session), ESLint, and the Vite
  build. A browser check against the running local backend confirmed a login
  with unknown credentials renders the `401` credentials message. Successful
  login, both registrations, forgot password, and reset password were not
  exercised end to end.

- Frontend email verification screen (2026-10-19): `cd frontend && yarn
  verify:agent` passed. Against the running backend, an unknown token rendered
  the invalid-link state from the real `400`; the success state was checked
  with a simulated `200` response in the browser. A real verification link was
  not consumed end to end.

- Cross-tab authentication sync (2026-10-19): fixes a stale-tab defect where a
  tab kept the previous user's Redux state while requests used the newer
  account's shared `localStorage` access token (seen as a Platform Admin
  screen receiving `403`). `synchronizeExternalChange` mirrors another tab's
  account switch, refresh, or logout. `cd frontend && yarn verify:agent`
  passed 13 focused tests (new cross-tab test), ESLint, and the Vite build. In
  the browser, a simulated `storage` logout moved the admin tab to `/login`,
  and restoring the credential re-authenticated it. Two real tabs were not
  exercised.
