# Frontend Sources of Truth

## Purpose

This document identifies the single canonical owner for each frontend responsibility. It is normative for new and changed code under `frontend/`, while the **Current known mismatches** section records where the repository does not yet match the target convention.

Backend owners are recorded separately in [`source-of-truth.md`](source-of-truth.md). Detailed frontend rules are defined in [`frontend-conventions.md`](frontend-conventions.md).

“Allowed consumers” identifies which code may import or call the owner. It does not grant a consumer permission to take ownership of the responsibility itself.

## Ownership table

| Responsibility | Canonical owner | Allowed consumers | Forbidden duplication |
| --- | --- | --- | --- |
| Browser entry point, global style import, React root, and application-wide providers | `frontend/src/main.jsx` | `frontend/index.html` | A second `createRoot`, a second Redux `Provider`, or providers composed inside features or pages |
| Top-level application composition beneath providers | `frontend/src/App.jsx` | `frontend/src/main.jsx` | Feature routing, data loading, or business state inside `App.jsx` |
| Transient feedback toast mount and defaults | `frontend/src/App.jsx` mounts the single Sonner `<Toaster />`; defaults in `TOASTER_CONFIG` of `frontend/src/utils/constant.js`; colors in `frontend/src/styles/globals.css` theme tokens | Components and feature hooks call `toast` from `sonner` directly | A second `<Toaster />`, inline Toaster props, per-call restyling, or toasts from API modules, the HTTP/socket clients, slices, or validation modules |
| Project constants, closed vocabularies, shared default messages, and library defaults | `frontend/src/utils/constant.js` (`RUNTIME_ENV`, `HTTP_HEADER`, `API_CONFIG`, `API_ERROR_MESSAGE`, `SOCKET_CONFIG`, `REALTIME_EVENT`, `VALIDATION_MESSAGE`, `TOASTER_CONFIG`) | Any frontend module through `@/utils/constant` | Redeclaring the same literal, a parallel constants module, or a role/status/event vocabulary not aligned with the backend contract |
| Reading `import.meta.env` and `VITE_*` variables | `frontend/src/utils/constant.js` | No other module reads `import.meta.env`; consumers use the derived constants | Direct `import.meta.env` access anywhere else; secrets in any `VITE_*` variable |
| Vite environment files | `frontend/.env*` at the frontend project root (`.env.example` documents the public variables) | Vite at build/dev time | Environment files under `frontend/src/` |
| Configured HTTP client, base URL, timeout, and interceptors | `frontend/src/apis/client/index.js` | Resource `*.api.js` modules | Importing Axios to send requests elsewhere, `axios.create()` outside the client, or per-module interceptors |
| Normalized API error contract | `frontend/src/apis/client/api-error.js` (`ApiError`, `normalizeApiError`; reads `{ error: { message, details } }` and `X-Request-Id`) | The HTTP client; features and components reading `ApiError` fields | Resource-specific global error classes for the same transport concern or parsing Axios internals in pages and components |
| Development logging of failed requests | `frontend/src/apis/client/index.js` (`logApiErrorInDevelopment`) | None; it runs inside the response interceptor | Additional `console.error` for API failures in API modules, features, or components |
| Resource HTTP calls | `frontend/src/apis/<name>.api.js`, one module per coherent backend resource (none exist yet) | Feature hooks and services | Endpoint calls inside pages, components, slices, or route modules |
| Socket.IO client, configuration, connection lifecycle, and handshake authentication | `frontend/src/socket/index.js` (`realtimeSocket`, `connectRealtimeSocket`, `disconnectRealtimeSocket`; lazy, `autoConnect: false`) | Feature hooks and services that own realtime behavior | `io()` or `socket.io-client` imports elsewhere; connecting at bootstrap without an authenticated workflow |
| Realtime event names | `REALTIME_EVENT` in `frontend/src/utils/constant.js`, aligned with `backend/src/constants/realtime-event.js` | Feature realtime listeners | Event-name literals in features or a second event-name module |
| Feature subscribe/unsubscribe and event interpretation | The owning `frontend/src/features/<feature>/` (none exist yet) | Pages and components of that feature | Feature event handling inside the shared socket facade, pages, or common components |
| Browser router creation and route-group composition | `frontend/src/routes/index.jsx` | `frontend/src/App.jsx` | A second router or `createBrowserRouter` outside this module |
| Route declarations for one area | `frontend/src/routes/<name>.routes.jsx` (currently `public.routes.jsx`) | `frontend/src/routes/index.jsx` | Routes declared inside layouts, pages, or features |
| Client navigation guards | `frontend/src/routes/ProtectedRoute.jsx`, `GuestRoute.jsx`, `RoleRoute.jsx` (prop-driven, not yet wired) | Route-group modules | Guard logic inside pages or layouts; guards that create auth state, call APIs, or decode authority |
| Shared structural frames | `frontend/src/layouts/` (currently `RootLayout.jsx`) | Route-group modules | Layout markup inside route modules; role-specific layouts without approved screens |
| URL-mapped screens | `frontend/src/pages/` (currently `HomePage.jsx`) | Route-group modules | Business workflows, HTTP/socket configuration, or global state defined in pages |
| Client behavior of one business feature | `frontend/src/features/<feature>/` (`components/`, `hooks/`, `services/`, `slice.js`, `utils.js` only when needed) | Pages; route modules only through pages | Feature workflows in pages, common components, `utils/`, or `lib/`; importing another feature's internals |
| Authentication client state | Not yet established; reserved for `frontend/src/features/authentication/` once an approved client contract exists | Route guards and features through the future owner | Auth state created by guards, pages, the HTTP client, or the socket facade |
| Redux store creation and reducer registration | `frontend/src/store/store.js` | `frontend/src/main.jsx` | A second store or feature slices defined under `src/store/` |
| Shared Redux hook aliases | `frontend/src/store/hooks.js` (`useAppDispatch`, `useAppSelector`) | Feature hooks and components | Parallel hook aliases in features |
| Domain-neutral UI primitives | `frontend/src/components/ui/` (shadcn/ui approach; currently `button.jsx`) | Common components, layouts, pages, and feature components | A competing primitive system; primitives aware of roles, endpoints, slices, or statuses |
| Application-level shared presentation | `frontend/src/components/common/` (currently `AppHeader.jsx`) | Layouts, pages, and features | Feature state or business API calls in common components |
| Tailwind class merging helper | `cn()` in `frontend/src/lib/utils.js` (the path referenced by `components.json`) | UI primitives and other components | A second class-merging helper |
| Library integration helpers and platform adapters | `frontend/src/lib/` | Any layer that needs the integration | Feature workflows, route behavior, or business state in `lib/` |
| Pure domain-neutral helpers | `frontend/src/utils/` beside `constant.js` (no helper module exists yet) | Any layer | Feature rules, API calls, React hooks, or imports of application layers in `utils/` |
| Application-wide validation provider | `frontend/src/validation/index.js` (re-exports `validators`, `z`, `zodResolver`, and approved schemas) | Form components and feature hooks through `@/validation` | Inline schemas in `index.js`; validation modules importing `index.js` |
| Reusable validator factories | `frontend/src/validation/<scope>.validators.js` (currently `common.validators.js`) | Schema modules in `src/validation/` | Generic validators duplicated in features or components |
| Form and payload schemas | `frontend/src/validation/<scope>.schema.js` (none exist yet) | Form components through `@/validation` | Schemas declared inline in components or duplicated across forms |
| Global CSS, theme tokens, and Tailwind v4 integration | `frontend/src/styles/globals.css` with `@tailwindcss/vite` in `frontend/vite.config.js` | `frontend/src/main.jsx` imports the stylesheet | Tailwind v3-style config or PostCSS setup; raw colors duplicating theme tokens |
| Vite plugins and runtime `@` alias | `frontend/vite.config.js` | Vite | Alias definitions that drift from `jsconfig.json` or `components.json` |
| Editor/tooling alias mirror | `frontend/jsconfig.json` | Editors and static tooling | A second alias definition source |
| shadcn/ui generation conventions and aliases | `frontend/components.json` | The shadcn/ui CLI | Generated components that bypass layer rules or aliases that disagree with Vite |
| Lint configuration | `frontend/eslint.config.js` | `yarn lint` and `yarn verify:agent` | Per-directory lint configuration files |
| Common frontend verification gate | `verify:agent` script in `frontend/package.json` (ESLint, then the Vite production build) | Agents and contributors before declaring frontend work verified | Ad hoc final gates documented elsewhere |

## Consumption rules

- Consumers import the canonical owner; they do not reconstruct its state or configuration.
- A convenience re-export, such as `@/validation` or the `ApiError` re-export from the HTTP client, exposes an owner but does not become a second owner.
- Cross-area imports use the `@` alias; relative imports stay inside one local module boundary.
- Feature-specific code stays with its feature until real cross-area reuse justifies promotion to `components/common/` or `utils/`.
- Server-owned facts, such as authorization, lifecycle state, and catalogs, are consumed from the backend and are never re-derived as client authority.
- When an ownership decision changes, this document, [`frontend-conventions.md`](frontend-conventions.md), and [`architecture.md`](architecture.md) must change with it.

## Current known mismatches

The following items describe the audited repository. They are not target patterns and do not propose a remediation.

### Authentication feature placeholder files have no content

[`frontend/src/features/authentication/slice.js`](../../frontend/src/features/authentication/slice.js) and [`frontend/src/features/authentication/utils.js`](../../frontend/src/features/authentication/utils.js) contain only an empty comment. The conventions allow `slice.js` and `utils.js` only when they have real content, and represent explicitly requested empty scaffolds with `.gitkeep`. Neither file is registered, imported, or evidence of implemented behavior.

### The UI primitive filename does not follow the component filename rule

[`frontend/src/components/ui/button.jsx`](../../frontend/src/components/ui/button.jsx) uses the lowercase name generated by shadcn/ui, while the conventions require PascalCase `.jsx` filenames for React components. The conventions do not state whether shadcn/ui primitives are an exception.

### The shadcn/ui `hooks` alias has no documented owner

[`frontend/components.json`](../../frontend/components.json) declares `"hooks": "@/hooks"`, but `frontend/src/hooks/` does not exist and the conventions define no shared hooks folder. Hooks are currently owned by features (`features/<feature>/hooks/`) or by `src/store/hooks.js`.

## Decisions still requiring human confirmation

The target conventions do not settle these points:

- whether shadcn/ui primitives under `components/ui/` keep the generated lowercase filenames or are renamed to PascalCase;
- whether a shared `src/hooks/` owner is wanted for domain-neutral hooks, or the `components.json` alias should point elsewhere;
- which module owns authentication client state, token storage, and refresh policy once an approved client contract exists;
- whether a server-state library is introduced or server responses stay in feature hooks and slices; and
- which frontend test harness, and which deterministic architecture checks, become part of `verify:agent`.

Until those decisions are made, code must not establish a second owner or infer a new architectural layer.
