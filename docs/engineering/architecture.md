# Application Architecture

## Purpose

This document records both the backend and frontend architecture that exists
today and the architecture the project intends to enforce going forward. These
are deliberately separate:

- **Current state** is evidence-based and describes the repository as it currently exists.
- **Target convention** is normative guidance for new and changed code.
- A target convention does not imply that the current repository already complies with it.

The backend is located under `backend/` and uses Node.js ES modules, Express,
MongoDB/Mongoose, Cloudinary, Multer, Nodemailer, JSON Web Tokens, and
Socket.IO. The frontend is located under `frontend/` and uses React, Vite,
React Router, Redux Toolkit, Axios, Socket.IO Client, Tailwind CSS v4,
shadcn/ui conventions, React Hook Form, and Zod.

## Backend current state

### Runtime composition

The current runtime is composed as follows:

1. [`backend/src/config/index.js`](../../backend/src/config/index.js) loads dotenv and exports normalized application configuration. [`backend/index.js`](../../backend/index.js) consumes that configuration and owns process startup and shutdown.
2. Startup connects MongoDB, verifies required infrastructure and collection invariants, initializes models/indexes where approved, starts the HTTP server, attaches the Socket.IO distribution plane, and starts the approved recovery/expiration workers.
3. [`backend/src/app.js`](../../backend/src/app.js) creates the Express application, registers application middleware, mounts the root API router at `/api`, and registers the not-found and final error middlewares.
4. [`backend/src/routes/index.js`](../../backend/src/routes/index.js) is the root API router and mounts feature routers. Feature routes assemble transport middleware and delegate to controllers.
5. Controllers translate HTTP input/output and call services. Services own business workflows and use Mongoose models, other canonical services, and approved infrastructure clients.
6. Successful durable Notification, Message, and Conversation-state transitions may trigger best-effort post-commit realtime fan-out through the shared sockets facade. Realtime delivery does not replace persisted state or HTTP resynchronization.

### Current folders and responsibilities

```text
backend/
├── index.js                 # Process entry point and server lifecycle
└── src/
    ├── app.js               # Express construction and composition
    ├── config/              # Config provider and infrastructure clients
    ├── constants/           # Shared enum-like values and fixed mappings
    ├── controllers/         # HTTP handlers
    ├── database/            # Seeds and explicit versioned migrations
    ├── middlewares/         # Request processing and final error handling
    ├── models/              # Mongoose schemas, models, and DB invariants
    ├── routes/              # Root and feature routers
    ├── services/            # Business workflows and infrastructure coordination
    ├── sockets/             # Socket.IO lifecycle and realtime transport
    ├── utils/               # Generic dependency-safe helpers
    └── workers/             # Approved background scheduling lifecycles
```

### Current request and event flows

```text
Express app
  -> root API router
  -> feature router
  -> route middleware
  -> controller
  -> service
  -> model/database and/or approved infrastructure client
  -> HTTP response
```

Optional post-commit realtime consequence:

```text
winning durable business transition
  -> canonical service post-commit hook
  -> sockets facade
  -> authenticated recipient session(s)
```

Failure path:

```text
unmatched route or forwarded error
  -> not-found middleware when applicable
  -> centralized error handler
  -> JSON error response
```

The detailed, version-specific canonical backend owners and known mismatches
remain in [`source-of-truth.md`](source-of-truth.md). This architecture document
does not duplicate that owner matrix.

## Backend target convention

### Composition and ownership

- `backend/index.js` is the application entry point and owns HTTP server startup, process signals, graceful shutdown, and startup failure handling.
- `backend/src/app.js` owns the Express application instance and the composition order of application middleware, routers, not-found handling, and final error handling.
- `backend/src/routes/index.js` is the root API router and mounts feature routers.
- Infrastructure-specific configuration and clients, including MongoDB, Cloudinary, and mail transport, remain under `backend/src/config/`.
- `backend/src/config/index.js` is the canonical normalized application configuration provider.
- `backend/index.js` consumes application configuration during runtime bootstrap, but does not own environment loading, parsing, validation, normalization, or defaults.
- One-time data migrations required by an approved persistence contract are explicit database tooling. `backend/scripts/run-migration.js` owns migration invocation and connection orchestration, while versioned migration definitions live under `backend/src/database/migrations/`. Migrations are never run implicitly during application startup or seed execution.
- V4.1 Location reference data uses Province Open API v1 (`https://provinces.open-api.vn/api/v1/`) and its pre-July-2025-merger semantics. Raw Province and raw District become the JOBHUB `Province → optional District-level unit` hierarchy; raw Ward/Commune is excluded. `backend/src/services/location.service.js` is the stable consumer-facing catalog/semantic-validation boundary and, for the demo scope, calls v1 directly with no cache, fallback, static catalog, or MongoDB mirror; provider failure fails that operation closed. Job/CandidateCV mutation owners consume the boundary. Job Discovery and Candidate Search filter/sort only from persisted `provinceCode`/`districtCode`; the one search-path use of the boundary is Candidate Search resolving District → Province membership of a District-subset filter once per request (`resolveLocationFilterSelections`), because a Province-wide preference carries no District to prove membership. Job Discovery never calls the boundary, and no search consumer calls the provider directly. A future cache/provider wrapper may be inserted behind the same boundary without changing Product/API contracts or downstream consumers.
- V13 durable Notification recovery is an approved background-worker exception to request-only execution. `backend/src/workers/notification-recovery.worker.js` owns only the scheduling lifecycle for bounded, non-overlapping recovery passes and delegates materialization to `backend/src/services/notification.service.js`. `backend/index.js` starts the worker after MongoDB and required collection/index readiness, and stops it before disconnecting MongoDB during shutdown.
- V15 Job Invitation Day-15 expiration materialization is the second approved background-worker exception. `backend/src/workers/job-invitation-expiration.worker.js` owns only the scheduling lifecycle for bounded, non-overlapping catch-up passes and delegates persistence to `backend/src/services/job-invitation.service.js` (`materializeDueExpiredJobInvitations`). It does not own expiration evaluation, timezone/day-count semantics, or a second transition path. `backend/index.js` starts the worker after MongoDB and Job Invitation collection/index readiness, and stops it before disconnecting MongoDB during shutdown.
- V13 Socket.IO realtime distribution is the approved transport layer for online fan-out. `backend/src/sockets/realtime-server.socket.js` owns attaching Socket.IO to the process HTTP server, connection authentication, and in-memory User→connection membership. `backend/src/sockets/realtime-events.socket.js` owns the Notification, Message, and Conversation-state transport payloads and recipient-room fan-out. `backend/src/sockets/index.js` is their public facade. `backend/index.js` attaches the Socket server after the HTTP server exists and closes it during graceful shutdown. The layer must not introduce Socket session/delivery persistence or absorb business recipient and post-commit decisions from services.
- No repository layer is part of the current target architecture. Adding one requires explicit approval as an architecture change.

### Layer dependency direction

The intended request dependency direction is:

```text
route -> middleware -> controller -> service -> model/database
                                      |
                                      +-> approved infrastructure clients/utilities

entry point -> background worker -> service -> model/database
entry point -> sockets facade (Socket.IO on http.Server)
notification materialization -> sockets facade (best-effort emit)
application post-commit hooks -> sockets facade (best-effort emit)
```

Not every endpoint must use every layer. A layer may be omitted when it has no responsibility for that endpoint, but callers must not skip a layer in order to take over that layer's responsibility.

### Routes

Routes are the first HTTP routing layer. They:

- declare paths and HTTP methods;
- assemble route-specific middleware chains;
- delegate request handling to controllers;
- contain no business logic; and
- never access Mongoose models or the database directly.

### Middlewares

Middlewares process or enrich HTTP requests before controllers and own cross-cutting request concerns such as authentication, upload parsing, and request validation. They must not own business workflows.

### Controllers

Controllers form the HTTP boundary. They:

- receive request input;
- extract and normalize HTTP input;
- call services;
- translate service results and errors into HTTP behavior;
- never access models or the database directly; and
- do not own business logic or business validation.

### Services

Services own business workflows and business validation. Under the current target architecture, they may:

- work directly with Mongoose models and the database;
- coordinate multiple models;
- coordinate approved infrastructure clients, other services, constants, and utilities; and
- return results or throw errors without depending on Express request or response objects.

For V13, `notification.service.js` owns NotificationEvent creation support, Notification materialization, idempotent pending-event recovery, and the rule that recovery consumes immutable recipient/content snapshots rather than recomputing current recipients. Source business services remain owners of their source transitions and pass the active MongoDB session when creating a required durable obligation inside the source transaction.

For V13 Slice 09, after a durable Notification for a recipient has been materialized, `notification.service.js` may trigger a best-effort recipient-scoped emit through `backend/src/sockets/index.js`. That emit is outside any MongoDB transaction, must not run before the durable Notification exists, must not change read state, and must not roll back Notification or source business state on Socket failure. Exactly-once Socket delivery is not required.

### Realtime distribution

The approved V13 Socket.IO distribution owner under `backend/src/sockets/`:

- attaches one Socket.IO server to the process HTTP server owned by `backend/index.js`;
- authenticates each connection with the canonical `authenticateAccess` credential rules (valid access token, AuthSession, and `ACTIVE` User);
- maps one authenticated User to zero or more active Socket connections through an in-memory User-scoped room such as `user:{userId}`;
- owns connection join/leave membership for that User room;
- emits Notification realtime only to the recipient User room after durable Notification materialization;
- emits Message realtime only after the Message has committed, to trusted post-transition Conversation participants;
- emits Conversation-state realtime only after a winning source transition, to trusted post-transition participants;
- does not replay missed Socket history on reconnect;
- does not persist SocketSession, NotificationDelivery, presence, or receipt state;
- does not store Notification read state on the Socket session; durable `Notification.readAt` remains the only read-state owner; and
- uses the same authenticated connection plane for Notification, Message, and Conversation-state transport without moving recipient or post-commit business decisions into the socket layer.

Source/application services and the recovery worker must not call Notification
emit directly. They continue to create obligations and invoke materialization;
materialization owns the post-durable Notification emit trigger. Canonical
application-service post-commit hooks own Message and Conversation-state emit
decisions.

### Background workers

The approved V13 Notification recovery worker:

- performs one bounded recovery pass after startup readiness and then recurring fixed-delay passes;
- never overlaps two passes within the same process;
- calls the Notification service and does not access models directly;
- leaves failed or partial events pending for a later pass;
- does not persist retry telemetry, Socket delivery state, or a second event log;
- does not own Socket.IO or call Notification emit directly (any realtime fan-out happens only inside Notification materialization after durable writes); and
- exposes start/stop lifecycle operations for the process entry point.

The approved V15 Job Invitation expiration worker:

- performs one catch-up pass after startup readiness and then recurring fixed-delay passes;
- never overlaps two passes within the same process;
- calls `materializeDueExpiredJobInvitations` and does not access models or evaluate expiration itself;
- leaves failed or partial materialization for a later pass;
- does not persist retry telemetry, a scheduler lock, or TTL deletion;
- does not create `JOB_INVITATION_EXPIRED`; and
- exposes start/stop lifecycle operations for the process entry point.

Parallel application processes may run these passes concurrently. Exact wall-clock precision and distributed exactly-once execution are not required. Authoritative Invitation actionability remains derived from `expiresAt` and the shared current-state evaluator.

### Models

Models own Mongoose schemas, Mongoose models, and persistence representation. Model modules do not handle HTTP concerns or business workflows.

### Utils

Utilities are generic reusable helpers. They must not become owners of feature business workflows, HTTP request handling, or persistence behavior.

### Configuration

- `backend/src/config/index.js` loads `.env` through dotenv. No other module may load dotenv.
- Only `backend/src/config/index.js` may read `process.env`. It owns validation, parsing, normalization, and approved defaults for environment values.
- `backend/src/config/index.js` exports the normalized application configuration. Any backend consumer may import normalized values from it where appropriate.
- Other configuration modules, including MongoDB, Cloudinary, and mailer modules, must consume normalized values from `backend/src/config/index.js` and must not read `process.env` directly.
- MongoDB connection management, Cloudinary setup, and mail transport setup remain infrastructure-specific modules under `backend/src/config/`.

The root entry point imports normalized application configuration as part of bootstrap. That is configuration consumption rather than ownership of environment loading, parsing, or validation.

### Errors

- `backend/src/middlewares/not-found.js` owns unmatched-route handling.
- `backend/src/middlewares/error-handler.js` is the centralized final error handler.
- Both are registered in `backend/src/app.js` after application routes, with the final error handler last.
- Other layers forward errors according to the centralized error contract instead of establishing competing global error formats.

### File naming

- All filenames use kebab-case.
- Feature route files use `<name>.routes.js`.
- Controller files use `<name>.controller.js`.
- Service files use `<name>.service.js`.
- Model files use `<name>.model.js`.
- Socket transport files use `<name>.socket.js`; `src/sockets/index.js` is the public facade exception.

## Backend architectural constraints

- Every responsibility has one canonical owner.
- Existing configuration providers, connections, clients, constants, helpers, services, and models are reused rather than recreated.
- Routes and controllers never access models or the database directly.
- Services do not depend on Express request or response objects.
- Cross-cutting middleware does not absorb business workflows.
- Generic utility modules do not become feature service substitutes.
- New architectural layers or changes in ownership require explicit approval and corresponding documentation updates.
- Background scheduling outside the approved V13 Notification recovery worker and the approved V15 Job Invitation expiration worker requires separate architectural approval.
- Socket.IO server imports outside `backend/src/sockets/`, direct persistence or HTTP-layer access from `src/sockets/`, or realtime emits outside the approved Notification-materialization / application-post-commit → sockets boundaries require separate architectural approval.

Current deviations from these constraints are catalogued in [`source-of-truth.md`](source-of-truth.md). They are documentation of the existing state, not authorization to duplicate or extend the mismatch.

## Frontend current state

### Runtime composition

The current browser runtime is composed as follows:

1. [`frontend/src/main.jsx`](../../frontend/src/main.jsx) imports global styles, creates the React root, and mounts the application inside the single Redux `Provider`.
2. [`frontend/src/App.jsx`](../../frontend/src/App.jsx) renders the single React Router `RouterProvider`.
3. [`frontend/src/routes/index.jsx`](../../frontend/src/routes/index.jsx) composes route groups and creates the browser router. The current public route group maps `/` to `RootLayout` and its nested `HomePage` index route.
4. `RootLayout` composes the application-level `AppHeader` with an `Outlet`; the page owns the complete URL-mapped screen content.
5. One configured Axios client owns the HTTP base URL, timeout, interceptors, and normalized `ApiError` shape. No resource `*.api.js` module consumes it yet.
6. One lazy Socket.IO client owns connection configuration and access-token handshake auth. It uses `autoConnect: false`; no feature listener or bootstrap connection currently exists.
7. The Redux store is valid but empty. The `authentication` feature directory is scaffold only: it contains no state, reducer, service, hook, component, or business behavior.

### Current folders and responsibilities

```text
frontend/
├── components.json         # shadcn/ui conventions and aliases
├── eslint.config.js        # Frontend lint configuration
├── jsconfig.json           # Editor/import alias configuration
├── vite.config.js          # React, Tailwind CSS v4, and @ alias integration
└── src/
    ├── apis/
    │   └── client/         # Shared Axios instance and API error normalization
    ├── components/
    │   ├── common/         # Application-level shared components
    │   └── ui/             # shadcn/ui-style primitives
    ├── features/
    │   └── authentication/ # Empty scaffold; not an implemented feature
    ├── layouts/            # Shared route layout frames with Outlet
    ├── lib/                # External-library integration helpers such as cn()
    ├── pages/              # Complete URL-mapped screens
    ├── routes/             # Router composition, route groups, and navigation guards
    ├── socket/             # Shared lazy Socket.IO client and event names
    ├── store/              # Redux Toolkit store composition and shared hooks
    ├── styles/             # Global CSS and application theme tokens
    └── validation/         # App-wide provider, focused schemas, and RHF integration
```

`frontend/src/utils/` does not currently exist because there is no pure,
cross-application utility that needs that owner. Empty feature subdirectories
are represented by `.gitkeep` only and do not imply implemented capability.

### Current capability boundary

The frontend currently provides a runnable technical foundation and sample
screen. It does not yet implement a frontend business workflow, auth-state
owner, token refresh policy, resource API module, feature-specific realtime
handler, or role-specific application shell. The route guards are prop-driven
building blocks and are not wired to routes until concrete auth state and
redirect destinations exist.

## Frontend target convention

Detailed normative rules for frontend work are defined in
[`frontend-conventions.md`](frontend-conventions.md). This section summarizes
the architectural ownership model.

### Composition and dependency direction

The intended high-level dependency direction is:

```text
main -> application providers -> router
router -> route groups -> guards/layouts/pages
layouts -> common components + Outlet
pages -> feature components + common components + UI primitives
features -> resource API modules / socket facade / store hooks / validation
store composition -> feature-owned slice reducers
UI primitives -> lib integration helpers
```

This diagram expresses ownership, not a requirement that every screen use
every layer. A feature may omit components, hooks, services, Redux state, or
realtime behavior when it does not need them.

### HTTP API boundary

- `frontend/src/apis/client/` owns the single configured Axios instance, request/response interceptors, and normalized API error shape.
- Resource or module calls live in `frontend/src/apis/*.api.js` and consume the shared client instead of importing Axios directly or creating another instance.
- API modules contain transport calls and transport-level translation only. They do not contain JSX, route declarations, complete UI workflows, or Redux reducers.
- Feature orchestration may call API modules, but it must not duplicate backend business rules or treat client-side checks as authoritative.

### Realtime boundary

- `frontend/src/socket/index.js` owns the shared Socket.IO client, connection lifecycle, configuration, and handshake authentication mechanism.
- `frontend/src/socket/realtime-event.js` owns frontend transport event-name constants and must remain aligned with the backend realtime event contract.
- Importing the application or socket facade does not require an immediate connection. Connection begins only when an authenticated workflow needs it.
- Feature-specific subscribe/unsubscribe behavior and event handling live with the owning feature, not in the shared socket facade.
- Realtime data is not the source of business truth. Features resynchronize durable/current state through canonical HTTP reads when required.

### Routing

- `frontend/src/routes/index.jsx` composes route-group modules and creates the single application router.
- Child `*.routes.jsx` modules declare routes for a coherent area or module.
- `ProtectedRoute`, `GuestRoute`, and `RoleRoute` provide client navigation behavior and render nested children through `Outlet` when appropriate.
- Guards consume resolved auth/role state from an approved owner; they do not create auth state, call business APIs, or hard-code speculative redirect destinations.
- Frontend guards improve navigation and user experience only. Backend authentication and authorization remain mandatory and authoritative.
- Router modules may reference layouts and pages but do not contain complete layout markup, feature workflows, or business HTTP calls.

### Layouts and pages

- `frontend/src/layouts/` contains shared structural frames for a group of routes. A layout may compose headers, sidebars, navigation, footers, and an `Outlet`.
- A new layout is created only when a real structural or experience difference exists. Role-specific layouts are not pre-created from role names alone.
- `frontend/src/pages/` contains complete screens mapped to URLs. Pages compose features and shared components rather than owning an entire business workflow themselves.
- Pages do not absorb complex HTTP, realtime, persistence, or domain orchestration that belongs to a feature owner.
- Pages and page groups are created only for approved, concrete screens.

### Features

- `frontend/src/features/<feature>/` is the canonical owner for client-side behavior belonging to one business feature.
- A feature may contain `components/`, `hooks/`, `services/`, `slice.js`, and `utils.js`, but only when actual code needs those owners.
- Feature `services/` coordinate client-side feature workflows across approved boundaries when needed; they do not create parallel Axios/Socket clients or redefine backend business authority.
- Feature Redux slices remain beside the owning feature and are registered centrally by `src/store/store.js`.
- Feature-only helpers remain inside the feature. They move to shared `src/utils/` only after they are genuinely domain-neutral and reused across areas.
- An empty scaffold, including the current `authentication/` tree, is not evidence that a feature is implemented.

### Components

- `frontend/src/components/ui/` contains general UI primitives managed with shadcn/ui conventions and Tailwind CSS. Primitives contain no JOBHUB-specific business logic.
- `frontend/src/components/common/` contains application-level presentation shared by multiple pages or features, such as the current `AppHeader`.
- `frontend/src/features/<feature>/components/` contains presentation tied to one business feature.
- Components are promoted from feature scope to `common/` only when their semantics are application-level and they have real cross-area use.
- UI primitives such as inputs, dialogs, dropdown menus, tables, and badges are added only when a screen actually needs them; empty primitive inventories are not created.

### Redux state

- `frontend/src/store/store.js` owns the single Redux Toolkit store and registers feature-owned reducers.
- `frontend/src/store/hooks.js` owns shared JavaScript hook aliases such as `useAppDispatch` and `useAppSelector`.
- Global Redux state is introduced only for state that must cross component/route boundaries or otherwise has a concrete global owner.
- Feature slices remain in their feature directories. `src/store/` does not become a collection of unrelated module slices.
- Slice modules do not import the configured store; store composition may import slice reducers, avoiding a circular ownership path.

### Helpers, validation, and styling

- `frontend/src/lib/` contains external-library integration helpers and platform adapters. The shadcn/ui-compatible `cn()` helper is owned there.
- `frontend/src/utils/` is reserved for pure, domain-neutral utilities reused across multiple application areas, such as general formatting or data conversion. It is not a dumping ground for unowned logic.
- `frontend/src/validation/index.js` is the application-wide validation provider/public facade. Validator implementations and form/payload schemas live in focused `*.validators.js` and `*.schema.js` modules under `src/validation/`, then are imported and re-exported by the provider. Internal validation modules do not import the provider, avoiding circular dependencies; form consumers import schemas and `zodResolver` through `@/validation` for React Hook Form integration.
- `frontend/src/styles/` owns global CSS, application theme tokens, and application-wide styling rules.
- Tailwind configuration follows the installed major version. The current Tailwind CSS v4 integration uses the Vite plugin, CSS imports, and `@theme`; legacy configuration files are not added without a concrete requirement.

### Configuration

- `frontend/vite.config.js` owns Vite plugins and the runtime `@` alias; `frontend/jsconfig.json` mirrors the alias for editor/tooling resolution.
- `frontend/components.json` owns shadcn/ui generation conventions and aliases.
- Vite environment files belong at the frontend project root (`frontend/.env*`), not under `frontend/src/`.
- Only public browser configuration uses the `VITE_*` prefix. Secrets must never be placed in frontend environment variables because Vite bundles them into client assets.
- `VITE_API_BASE_URL` and `VITE_SOCKET_URL` configure the shared HTTP and realtime clients; their code defaults remain development-safe fallbacks, not secret configuration.

### File naming

- React component, page, layout, and guard filenames use PascalCase with `.jsx`.
- Route-group modules use `<name>.routes.jsx`.
- Resource HTTP modules use `<name>.api.js`.
- General non-component modules use descriptive lowercase or kebab-case `.js` names; `index.js`/`index.jsx` is reserved for a real public facade or composition entry point.

## Frontend architectural constraints

- The application has one browser router, one Redux store, one configured Axios client, and one configured Socket.IO client.
- Route guards never replace backend authentication or authorization.
- Routes, layouts, shared components, and UI primitives do not own feature business workflows.
- Pages compose features; they do not become parallel feature service layers.
- Feature-specific state, services, hooks, components, realtime handlers, and utilities stay with their feature until real reuse justifies promotion.
- `components/ui/`, `components/common/`, and `features/<feature>/components/` remain distinct ownership levels.
- `lib/` and `utils/` do not absorb business logic merely because ownership is unclear.
- New route groups, layouts, pages, UI primitives, feature subfolders, reducers, and shared helpers require concrete consumers; scaffolding does not imply behavior.
- Frontend technical design must not invent business rules absent from an approved product specification or duplicate backend sources of truth.
