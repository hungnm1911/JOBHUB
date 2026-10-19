# Frontend V1 Authentication Foundation Project Status

## Current project state

The frontend foundation and V1 authentication lifecycle infrastructure are
`IMPLEMENTED AND VERIFIED` as of 2026-10-13. The
existing React + Vite application now has Tailwind CSS v4 and shadcn/ui
configuration, the `@` import alias, a Redux Toolkit provider/store, nested
React Router composition with a shared layout and runnable sample page, one
owned Axios client with normalized errors, and a lazy authenticated Socket.IO
client. React Hook Form and Zod are
integrated through the official resolver. `src/validation/index.js` is the
application-wide validation provider; reusable implementations live in focused
modules such as `common.validators.js`, and future form schemas are exported
through the provider for React Hook Form consumers. Routing is composed from
route-group modules; Protected, Guest, and Role guards now consume resolved
state from the Authentication feature, while concrete guarded routes remain
deferred until their screens and destinations exist. Authentication persists
one owned localStorage record, restores a session through refresh on reload,
marks infrastructure restoration failures as temporarily unavailable without
discarding credentials, and keeps Redux UI state and Socket.IO lifecycle in
sync. The Axios client attaches Bearer credentials only to explicitly protected
requests and performs reactive, single-flight `401` refresh with a one-retry
limit; login/refresh remain public, business `403` responses do not refresh,
and logout remains protected so it may refresh before revoking the session.
The focused authentication tests, frontend ESLint, and Vite production build
passed. Public authentication screens now exist under `/register`,
`/register/candidate`, `/register/company`, `/login`, `/forgot-password`,
`/reset-password`, and `/verify-email` (opened from the verification email;
consumes the token once through `POST /api/auth/verify-email`); login and both registrations dispatch Redux Toolkit
`createAsyncThunk` actions from
`features/authentication/services/authentication-thunks.js`, which delegate to
the authentication manager (login, Company Manager onboarding session) or the
auth API module (Candidate registration). No logout control or concrete
protected route exists yet. Sonner (`sonner`
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
