# Backend Architecture

## Purpose

This document records both the backend architecture that exists today and the architecture the project intends to enforce going forward. These are deliberately separate:

- **Current state** is evidence-based and describes the repository as it currently exists.
- **Target convention** is normative guidance for new and changed backend code.
- A target convention does not imply that the current repository already complies with it.

The backend is located under `backend/` and uses Node.js ES modules, Express, MongoDB/Mongoose, Cloudinary, Multer, Nodemailer, and JSON Web Tokens.

## Current state

### Runtime composition

The current runtime is composed as follows:

1. [`backend/src/config/index.js`](../../backend/src/config/index.js) loads dotenv and exports normalized application configuration. [`backend/index.js`](../../backend/index.js) consumes that configuration, imports the application and infrastructure modules, connects MongoDB, verifies Cloudinary, and starts the HTTP listener.
2. [`backend/src/app.js`](../../backend/src/app.js) creates the Express application, registers body parsers, mounts the root API router at `/api`, and registers the not-found and final error middlewares.
3. [`backend/src/routes/index.js`](../../backend/src/routes/index.js) is the root API router. It mounts the hello-world router at `/` and mounts file test routes at `/files` outside production.
4. Feature route files delegate to controllers. The file upload route also runs Multer and content-based file-type validation before its controller.
5. The file controller calls the file service, which talks to Cloudinary. The hello-world controller returns a response directly without a service.

MongoDB is connected during startup, but no current HTTP request uses a Mongoose model or accesses MongoDB. A `User` model exists in the working tree, but it is not exported by the model barrel and is not consumed by routes, controllers, or services.

### Current folders and responsibilities

```text
backend/
├── index.js                 # Process entry point and server lifecycle
└── src/
    ├── app.js               # Express construction and composition
    ├── config/              # Config provider and infrastructure clients
    ├── constants/           # Shared enum-like values and fixed mappings
    ├── controllers/         # HTTP handlers
    ├── database/            # Presently empty seed scaffolding
    ├── middlewares/         # Request processing and final error handling
    ├── models/              # Mongoose schemas/models; barrel is disconnected
    ├── routes/              # Root and feature routers
    ├── services/            # Cloudinary file operations and mail sending
    └── utils/               # Application error, JWT, and password helpers
```

### Current endpoints and request flow

#### `GET /api/`

```text
Express app
  -> root API router
  -> hello-world feature router
  -> getHelloWorld controller
  -> HTTP response
```

This path has no feature middleware, service, model, or database interaction.

#### `POST /api/files/test-upload` (non-production only)

```text
Express app
  -> root API router
  -> file feature router
  -> Multer in-memory upload middleware
  -> file-type validation middleware
  -> uploadTestFile controller
  -> file service
  -> Cloudinary client
  -> HTTP response
```

#### `DELETE /api/files/test-delete` (non-production only)

```text
Express app
  -> root API router
  -> file feature router
  -> deleteTestFile controller
  -> file service
  -> Cloudinary client
  -> HTTP response
```

#### Failure path

```text
Unmatched route or forwarded error
  -> not-found middleware when applicable
  -> centralized error handler
  -> JSON error response
```

Some expected file errors are currently formatted and returned directly by the controller instead of flowing through the centralized error handler. This is a recorded current mismatch, not evidence of the target convention.

## Target convention

### Composition and ownership

- `backend/index.js` is the application entry point and owns HTTP server startup, process signals, graceful shutdown, and startup failure handling.
- `backend/src/app.js` owns the Express application instance and the composition order of application middleware, routers, not-found handling, and final error handling.
- `backend/src/routes/index.js` is the root API router and mounts feature routers.
- Infrastructure-specific configuration and clients, including MongoDB, Cloudinary, and mail transport, remain under `backend/src/config/`.
- `backend/src/config/index.js` is the canonical normalized application configuration provider.
- `backend/index.js` consumes application configuration during runtime bootstrap, but does not own environment loading, parsing, validation, normalization, or defaults.
- One-time data migrations required by an approved persistence contract are explicit database tooling. `backend/scripts/run-migration.js` owns migration invocation and connection orchestration, while versioned migration definitions live under `backend/src/database/migrations/`. Migrations are never run implicitly during application startup or seed execution.
- V13 durable Notification recovery is the approved background-worker exception to request-only execution. `backend/src/workers/notification-recovery.worker.js` owns only the scheduling lifecycle for bounded, non-overlapping recovery passes and delegates materialization to `backend/src/services/notification.service.js`. `backend/index.js` starts the worker after MongoDB and required collection/index readiness, and stops it before disconnecting MongoDB during shutdown.
- V13 Socket.IO realtime distribution is the approved transport exception for online fan-out. `backend/src/services/realtime-distribution.service.js` owns attaching Socket.IO to the process HTTP server, connection authentication, in-memory User→connection membership, and recipient-scoped Notification emit. `backend/index.js` attaches the Socket server after the HTTP server exists and closes it during graceful shutdown. This is not a new architectural layer and must not introduce Socket session/delivery persistence.
- No repository layer is part of the current target architecture. Adding one requires explicit approval as an architecture change.

### Layer dependency direction

The intended request dependency direction is:

```text
route -> middleware -> controller -> service -> model/database
                                      |
                                      +-> approved infrastructure clients/utilities

entry point -> background worker -> service -> model/database
entry point -> realtime distribution service (Socket.IO on http.Server)
notification materialization -> realtime distribution service (best-effort emit)
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

For V13 Slice 09, after a durable Notification for a recipient has been materialized, `notification.service.js` may trigger a best-effort recipient-scoped emit through `realtime-distribution.service.js`. That emit is outside any MongoDB transaction, must not run before the durable Notification exists, must not change read state, and must not roll back Notification or source business state on Socket failure. Exactly-once Socket delivery is not required.

### Realtime distribution

The approved V13 Socket.IO distribution owner:

- attaches one Socket.IO server to the process HTTP server owned by `backend/index.js`;
- authenticates each connection with the canonical `authenticateAccess` credential rules (valid access token, AuthSession, and `ACTIVE` User);
- maps one authenticated User to zero or more active Socket connections through an in-memory User-scoped room such as `user:{userId}`;
- owns connection join/leave membership for that User room;
- emits Notification realtime only to the recipient User room after durable Notification materialization;
- does not replay missed Socket history on reconnect;
- does not persist SocketSession, NotificationDelivery, presence, or receipt state;
- does not store Notification read state on the Socket session; durable `Notification.readAt` remains the only read-state owner; and
- reserves the same authenticated connection plane for later Message and Conversation-state realtime slices without implementing those event contracts in Slice 09.

Source/application services and the recovery worker must not call Notification emit directly. They continue to create obligations and invoke materialization; materialization owns the post-durable emit trigger.

### Background workers

The approved V13 Notification recovery worker:

- performs one bounded recovery pass after startup readiness and then recurring fixed-delay passes;
- never overlaps two passes within the same process;
- calls the Notification service and does not access models directly;
- leaves failed or partial events pending for a later pass;
- does not persist retry telemetry, Socket delivery state, or a second event log;
- does not own Socket.IO or call Notification emit directly (any realtime fan-out happens only inside Notification materialization after durable writes); and
- exposes start/stop lifecycle operations for the process entry point.

Parallel application processes may run recovery passes concurrently. Correctness comes from the canonical unique indexes and idempotent Notification service, not from an in-memory or distributed worker lock. Exactly-once execution is not required.

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

## Architectural constraints

- Every responsibility has one canonical owner.
- Existing configuration providers, connections, clients, constants, helpers, services, and models are reused rather than recreated.
- Routes and controllers never access models or the database directly.
- Services do not depend on Express request or response objects.
- Cross-cutting middleware does not absorb business workflows.
- Generic utility modules do not become feature service substitutes.
- New architectural layers or changes in ownership require explicit approval and corresponding documentation updates.
- Background scheduling outside the approved V13 Notification recovery worker requires separate architectural approval.
- Socket.IO realtime distribution outside `backend/src/services/realtime-distribution.service.js`, or Notification realtime emit outside the Notification materialization → distributor boundary, requires separate architectural approval.

Current deviations from these constraints are catalogued in [`source-of-truth.md`](source-of-truth.md). They are documentation of the existing state, not authorization to duplicate or extend the mismatch.
