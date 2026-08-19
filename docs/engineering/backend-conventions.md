# Backend Engineering Conventions

## Scope

These conventions apply to code under `backend/`. They define the target architecture for new work and changes to existing work.

They do not claim that the current repository is fully compliant. Audited deviations are recorded in [`source-of-truth.md`](source-of-truth.md) and must not be copied merely because they already exist.

## Terminology

- **Must** or **must not** identifies a required architectural rule.
- **Current state** describes observed repository behavior.
- **Target convention** describes the intended rule even when current code differs.
- **Canonical owner** is the one module responsible for a concern. Other modules may consume it but must not recreate it.

## File and symbol naming

### Files

- All filenames must use lowercase kebab-case.
- Route files must use `<name>.routes.js`.
- Controller files must use `<name>.controller.js`.
- Service files must use `<name>.service.js`.
- Model files must use `<name>.model.js`.
- Approved background worker files must use `<name>.worker.js` under `src/workers/`.
- Middleware and utility filenames must describe their responsibility in kebab-case, such as `error-handler.js` or `generate-password.js`.
- JavaScript imports must include the `.js` extension because the backend uses ES modules.

Examples:

```text
job-application.routes.js
job-application.controller.js
job-application.service.js
job-application.model.js
validate-file-type.js
```

### Symbols

- Functions and variables use camel case.
- Classes and Mongoose models use Pascal case.
- Enum-like constant objects and module-level immutable constants use upper snake case.
- Mongoose document fields use camel case.
- Names should identify the owned responsibility rather than only its implementation mechanism.

The current repository is mostly consistent with these patterns, but still contains naming variations in router variables, Express handler arguments, and a working-tree model rename from `User.js` to `user.model.js`.

## Application composition

### Entry point

`backend/index.js` is the only production application entry point. It owns:

- infrastructure readiness orchestration;
- HTTP server startup;
- HTTP server shutdown;
- Socket.IO attach/close orchestration through the realtime-distribution owner;
- process signals;
- process-level uncaught error/rejection handling; and
- graceful resource cleanup orchestration.

It must not become the owner of feature routing, request middleware, controller behavior, or business workflows.

### Express application

`backend/src/app.js` owns:

- creation of the Express application;
- application-wide Express middleware;
- root router mounting;
- unmatched-route middleware registration; and
- final error-handler registration.

Application routes must be registered before `not-found.js`, and `error-handler.js` must remain the final error middleware.

### Root router

`backend/src/routes/index.js` is the root API router. Feature routers are mounted there and not directly in `backend/index.js`.

### Database migrations

- `backend/scripts/run-migration.js` owns explicit one-time migration invocation and database connection orchestration.
- Approved versioned migration definitions live under `backend/src/database/migrations/` and own only the data transformation required by their canonical persistence contract.
- Migration tooling must consume the canonical configuration and MongoDB connection lifecycle owners rather than configure another connection.
- Migrations must be invoked explicitly and must not run from application startup, request handling, seed files, or module import side effects.
- Seed scaffolding is not a migration runner and must not acquire migration responsibility.
- A migration definition must not add business behavior beyond its approved persistence transition.

### Background recovery

- `backend/src/workers/notification-recovery.worker.js` is the canonical scheduler and lifecycle owner for V13 pending NotificationEvent recovery.
- `backend/index.js` may start and stop this worker as part of process lifecycle orchestration, but must not contain Notification queries, materialization logic, retry loops, or event-selection rules.
- The worker performs an immediate bounded pass after database and collection/index readiness, followed by non-overlapping fixed-delay passes while the process is running.
- Recovery failures leave durable events pending and are retried by a later pass. They do not roll back a source business result that already committed.
- The worker delegates Notification persistence and materialization to `backend/src/services/notification.service.js`; it must not import Mongoose models or access collections directly.
- Multiple process-local workers may run concurrently. The Notification service and canonical unique indexes own idempotence; no worker lock, delivery receipt, retry telemetry, or generic event log is introduced.
- The worker does not own Socket/realtime distribution and must not call Notification emit directly. Any realtime fan-out happens only after durable materialization inside the Notification → realtime-distribution boundary.
- Recovery timing and batch controls, when configurable, are normalized only by `backend/src/config/index.js`; no worker may read `process.env` directly.

### Job Invitation expiration scheduling

- `backend/src/workers/job-invitation-expiration.worker.js` is the canonical scheduler and lifecycle owner for time-driven `PENDING → EXPIRED` catch-up.
- `backend/index.js` may start and stop this worker as part of process lifecycle orchestration, but must not contain Invitation queries, expiration evaluation, retry loops, or transition rules.
- The worker performs an immediate pass after database and Job Invitation collection/index readiness, followed by non-overlapping fixed-delay passes while the process is running.
- Pass failures leave due Invitations pending for a later pass. Delayed materialization does not change `expiresAt` or current-state actionability.
- The worker delegates expiration persistence to `backend/src/services/job-invitation.service.js` (`materializeDueExpiredJobInvitations`); it must not import Mongoose models, evaluate current state, or duplicate `PENDING → EXPIRED` decision logic.
- Multiple process-local workers may run concurrently. The Invitation service owns idempotence via conditional `PENDING` updates; no worker lock, TTL index, or `JOB_INVITATION_EXPIRED` event is introduced.
- Interval controls, when configurable, are normalized only by `backend/src/config/index.js`; no worker may read `process.env` directly.

### Realtime distribution

- `backend/src/services/realtime-distribution.service.js` is the canonical Socket.IO and Notification realtime-distribution owner for V13 Slice 09.
- `backend/index.js` attaches Socket.IO to the process HTTP server through that owner after the HTTP server exists, and closes it during graceful shutdown. The entry point must not implement handshake auth, room membership, or emit fan-out inline.
- Connection authentication reuses `authenticateAccess` from `backend/src/services/authenticate-access.service.js`. Handshake credentials must resolve to a valid AuthSession and `ACTIVE` User; onboarding-only access is not a Slice 09 realtime connection path.
- One authenticated User may have many concurrent Socket connections. Membership is in-memory only, via a User-scoped room such as `user:{userId}`. Slice 09 does not persist SocketSession, connection maps, presence, or delivery receipts.
- Notification realtime emit is recipient-scoped to that User room only. Cross-user leak, global Notification broadcast, and durable duplication per connection are forbidden.
- Emit is allowed only after the durable Notification for that recipient exists. `notification.service.js` owns the post-materialization trigger; source/application services keep post-commit `materializeNotificationEvent` and must not emit Notification realtime themselves.
- Emit is best-effort and outside MongoDB transactions. Socket failure must not delete durable Notification, must not roll back source business state, and does not require exactly-once delivery.
- Reconnect must not replay Socket event history. Missed realtime events are recovered through durable Notification / current resource APIs already owned by earlier slices.
- Read state remains durable `Notification.readAt` owned by `notification.service.js`. Socket sessions must not hold per-connection or per-device read state.
- Slice 09 reserves the authenticated User-connection plane for later Message and Conversation-state realtime slices, but must not implement those event contracts, Conversation rooms, or offline orchestration.
- Focused Socket tests own an ephemeral HTTP + Socket.IO server through the realtime-distribution lifecycle helpers. The existing HTTP `createTestAgent` harness remains HTTP-only unless a test explicitly attaches Socket.IO.
- Any Socket-related environment controls are normalized only by `backend/src/config/index.js`.

## Layer rules

### Routes

Route modules must:

- declare endpoint paths and HTTP methods;
- compose route-specific middleware in execution order;
- delegate terminal HTTP handling to controllers; and
- remain thin and declarative.

Route modules must not:

- implement business rules or workflows;
- access models, Mongoose, or database connections;
- perform direct infrastructure operations such as Cloudinary uploads or SMTP sending; or
- establish a separate error response contract.

### Middlewares

Middleware modules may:

- authenticate or authorize requests;
- parse uploads or other request data;
- validate transport/request shape;
- normalize or enrich request context; and
- handle cross-cutting HTTP concerns.

Middleware modules must not:

- own a feature business workflow;
- replace a service;
- access models merely to avoid a service boundary; or
- depend on controller-specific behavior beyond an explicit request contract.

### Controllers

Controller modules must:

- receive Express request input;
- extract and normalize values from HTTP parameters, query, body, files, and request context;
- invoke services for business behavior;
- translate service outcomes into HTTP status, headers, and response data; and
- forward errors into the application error flow where required by the error contract.

Controller modules must not:

- import or access Mongoose models or the database directly;
- own business validation or workflows;
- configure or recreate infrastructure clients; or
- pass Express request or response objects into services.

Simple transport-level handling does not by itself require a service. For example, an endpoint that only reports static process-independent information may respond from a controller when there is no business workflow.

### Services

Service modules must:

- own business logic and business validation;
- expose interfaces independent of Express;
- accept explicit values or plain objects rather than `request`/`response`;
- coordinate models and database operations under the current architecture; and
- coordinate canonical infrastructure clients, services, constants, and utilities when the workflow requires them.

Service modules must not:

- depend on Express request, response, router, or middleware types;
- decide HTTP status codes or write HTTP responses;
- read environment variables directly; or
- create duplicate database, Cloudinary, SMTP, or other shared clients.

For V13 Notification recovery:

- source business services retain ownership of their existing source transitions;
- `notification.service.js` owns durable Notification obligation support, materialization, and pending-event recovery;
- source services create required NotificationEvent obligations inside the existing source transaction by passing explicit values and its active MongoDB session;
- recipient/content snapshots are fixed at source-event time and are never recomputed during recovery;
- an immediate post-commit materialization attempt may improve latency, but the background recovery worker remains the runtime recovery trigger and materialization failure must not turn an already committed source result into failure; and
- after a durable Notification exists for a recipient, materialization may best-effort call `realtime-distribution.service.js` for recipient-scoped emit without importing Express, without persisting delivery state, and without treating Socket failure as materialization or source failure.

For V13 Slice 09 realtime distribution:

- `realtime-distribution.service.js` may attach Socket.IO to a Node `http.Server` and must not depend on Express request/response objects;
- handshake authentication calls the canonical access-auth service rather than reimplementing session validation;
- Notification emit APIs accept explicit recipient User id and already-persisted Notification data rather than HTTP/Socket request objects; and
- Message/Conversation realtime helpers remain out of Slice 09 except for sharing the authenticated User-connection plane.

There is no repository layer in the approved architecture. Services work directly with models. Introducing repositories requires explicit architectural approval.

### Models

Model modules must:

- define Mongoose schemas and models;
- own persistence field names, types, indexes, defaults, and schema-level constraints; and
- export the canonical model for their entity.

Model modules must not:

- receive or write Express responses;
- implement route/controller behavior;
- own multi-step business workflows; or
- create database connections.

### Background workers

Worker modules may schedule and coordinate approved background execution. They must:

- expose explicit lifecycle functions rather than start on import;
- depend on services and normalized configuration only;
- remain independent of Express request/response objects; and
- contain no business rules or direct persistence access.

No generic worker layer is otherwise approved. A new worker responsibility requires an explicit engineering-contract and source-of-truth update.

### Utils

Utility modules must:

- be generic and reusable;
- expose narrow, explicit inputs and outputs; and
- remain independent of Express and feature workflow orchestration.

Utility modules must not become catch-all locations for business logic, HTTP behavior, model access, or infrastructure configuration.

### Constants

- A domain concept must have one canonical constants module.
- Consumers must import the canonical constant rather than reproduce literal sets across files.
- Two constant modules must not define competing representations of the same concept.
- Constants should be immutable when mutation has no valid use.

`backend/src/constants/auth-token-type.js` is the canonical owner of V1
authentication-token types.

## Configuration and infrastructure

### Environment configuration

- `backend/src/config/index.js` must load `.env` through dotenv. No other module may load dotenv.
- Only `backend/src/config/index.js` may read `process.env`, including among modules inside `src/config/`.
- `backend/src/config/index.js` owns validation, parsing, normalization, and approved defaults for environment values.
- `backend/src/config/index.js` exports the normalized application configuration. Any backend consumer may import normalized values from it where appropriate.
- Consumers, including other modules inside `src/config/`, must use the provider instead of reading `process.env` or independently parsing, defaulting, or validating environment values.
- Validation and default behavior must not contradict each other: a setting cannot meaningfully be both unconditionally required and defaulted when absent.

Current mismatch: several currently required variables also have defaults that cannot be reached when the variable is absent.

`backend/index.js` imports application configuration as part of runtime bootstrap. That makes it a configuration consumer, not the owner of environment loading, parsing, validation, normalization, or defaults.

### Infrastructure modules

- `backend/src/config/mongodb.js` owns the Mongoose connection lifecycle.
- `backend/src/config/cloudinary.js` owns Cloudinary client configuration and verification.
- `backend/src/config/mailer.js` owns Nodemailer transport creation.
- Infrastructure clients must be reused by services rather than configured again.
- Infrastructure modules must consume normalized configuration from `src/config/index.js` and must not read `process.env` directly.

## Error handling

- `backend/src/middlewares/not-found.js` is the canonical unmatched-route handler.
- `backend/src/middlewares/error-handler.js` is the centralized final error handler.
- Both are composed in `backend/src/app.js` after application routes.
- Operational errors should use the canonical application error contract where applicable.
- Unexpected errors must reach the final error handler and must not leak production stack traces.
- Routes, middleware, controllers, and services must not introduce competing global error formats.

Controllers still translate domain/service outcomes into HTTP semantics. The exact point at which expected controller outcomes must be forwarded to the centralized formatter has not yet been decided. Current controller-level error bodies overlap the centralized handler and are documented as a mismatch rather than endorsed as convention.

## Validation boundaries

- Middleware owns cross-cutting request-shape validation and request enrichment.
- Controllers extract and normalize HTTP input.
- Services own business validation and invariants.
- Models own persistence/schema constraints.
- Validation at multiple boundaries is acceptable only when each check protects a distinct boundary; identical checks must not create ambiguous ownership.

The exact project-wide placement of feature-specific request-schema validation still requires human confirmation. Until then, new code must keep transport checks out of services and business rules out of middleware/controllers.

## Imports and dependency boundaries

The normal request dependency direction is:

```text
routes -> middlewares/controllers -> services -> models/database
                                      |
                                      +-> infrastructure clients and utils

entry point -> approved workers -> services -> models/database
```

Additional rules:

- Routes and controllers must not import models or database connection modules.
- Models must not import controllers, routes, or middleware.
- Services may import models, other approved services, config-owned infrastructure clients, constants, and dependency-safe utils.
- Configuration modules must not import feature routes, controllers, or services.
- Workers must not import routes, controllers, middlewares, models, Mongoose, or database connection modules.
- Circular feature dependencies must not be introduced.
- Existing empty barrel modules do not require consumers to import through them; their intended status remains undecided.

## Source-of-truth discipline

Before adding a configuration object, connection, client, constant, helper, service, model, middleware, or error type:

1. Check [`source-of-truth.md`](source-of-truth.md) for the canonical owner.
2. Search the repository for an existing implementation.
3. Reuse or extend the canonical owner within its responsibility.
4. Do not establish a parallel owner to work around an existing mismatch.
5. Obtain explicit approval before adding a new architecture layer or changing ownership.

## Current compliance note

The current backend demonstrates the intended top-level separation among startup, Express composition, routes, controllers, services, models, middleware, configuration, and utilities. It is not fully compliant with these conventions. Known deviations include disconnected barrels, overlapping controller/central error formatting, overlapping validation, and contradictory required/default configuration behavior.

This documentation records those facts without changing or prescribing changes to the implementation.
