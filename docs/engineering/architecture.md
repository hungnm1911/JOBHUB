# Application Architecture

## Purpose

This document records the backend, AI Kit, and frontend architecture that
exists today and the architecture the project intends to enforce going
forward. These are deliberately separate:

- **Current state** is evidence-based and describes the repository as it currently exists.
- **Target convention** is normative guidance for new and changed code.
- A target convention does not imply that the current repository already complies with it.

The backend is located under `backend/` and uses Node.js ES modules, Express,
MongoDB/Mongoose, Cloudinary, Multer, Nodemailer, JSON Web Tokens, and
Socket.IO. AI Kit is the private local Node.js package under `ai-kit/` and uses
JavaScript ES modules. The frontend is located under `frontend/` and uses
React, Vite, React Router, Redux Toolkit, Axios, Socket.IO Client, Tailwind CSS
v4, shadcn/ui conventions, React Hook Form, and Zod.

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
  -> request logger (request id + access log)
  -> CORS and body parsing
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
  -> centralized error handler (logs with request id)
  -> JSON error response + X-Request-Id header
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
- `backend/src/services/ai-kit.service.js` is the sole Backend integration
  boundary for the local `@jobhub/ai-kit` package. It creates the shared AI Kit
  instance through the package-root public API, injecting normalized AI Kit
  configuration from `backend/src/config/index.js` and the canonical Backend
  logger. Other Backend source modules must consume this service rather than
  import the package or its internals. AI Kit-specific ownership and dependency
  rules are defined under [AI Kit target convention](#ai-kit--target-convention)
  and [AI Kit architectural constraints](#ai-kit--architectural-constraints).
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

### Logging

- `backend/src/utils/logger.js` is the single application logger; `backend/src/middlewares/request-logger.js` (registered first in `app.js`) owns request-id assignment, the `X-Request-Id` response header, and per-request access logging.
- `LOG_LEVEL` is normalized by `backend/src/config/index.js`. Development defaults to `debug`, and other environments default to `info`. Production output is JSON lines.
- Detailed level semantics and redaction rules are defined in [`backend-conventions.md`](backend-conventions.md#logging-and-request-tracing).

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

## AI Kit — Current State

### Package and runtime boundary

- `ai-kit/` is the private local package `@jobhub/ai-kit`, located beside
  `backend/` and `frontend/`. It has its own `package.json`, dependencies,
  ESLint, and Vitest configuration and uses JavaScript ES modules.
- Backend declares it through `file:../ai-kit`. AI Kit executes in the Backend
  Node.js process; it has no Express application, HTTP port, independent
  process, deployment service, or `start`/`dev` entrypoint. The repository does
  not compose it as an npm workspace.
- [`ai-kit/src/index.js`](../../ai-kit/src/index.js) is the production package
  entrypoint and exports only `createAiKit`. The factory validates
  optional Codex/Gemini/Groq configuration and the injected logger contract, then
  returns a frozen instance with AI-V01 entries `normalizeJob` (F01) and
  `normalizeGeneratedCv` (F02), AI-V02 `normalizeUploadedCv` (F01),
  AI-V03 `matchJobCv` (F01 orchestration), AI-V04 `evaluateCv` (F01 Slice 1),
  and AI-V05 `assessRecommendationBatch` (Slice 04 F03) and
  `scoreRecommendationAssessment` (Slice 05 F04). The AI-V01 entries
  remain synchronous, deterministic, and provider-free; they
  need no LLM configuration and do not log. The AI-V02 entry is asynchronous
  and calls one explicitly selected provider after PDF text extraction.
- AI-V01 Product/Data authority is approved and deterministic. The F01 owner,
  `src/normalization/job-normalization.js` (`normalizeJob`), turns a
  career-relevant Job source projection plus Backend-resolved taxonomy into a
  runtime-only READY `JobMatchProfile` or FAILED result; the F02 owner,
  `src/normalization/cv-normalization.js` (`normalizeGeneratedCv`), does the
  same for a Generated CV projection and `CVMatchProfile`. Each owner defines
  its source projection and profile shape, refuses invalid input (including
  taxonomy that does not resolve the source references) with a coded error
  (`JobNormalizationError` `INVALID_JOB_INPUT`,
  `CvNormalizationError` `INVALID_GENERATED_CV_INPUT`), and returns FAILED with
  no profile when normalization cannot complete. Both share
  `src/normalization/normalization-support.js` for source-gate helpers, the
  Backend-mirrored EmploymentType/WorkMode/CategoryLevel/ExperienceLevel code
  sets, provenance helpers, and the READY/FAILED result. They use no LLM or
  JSON Schema validator. The earlier LLM extraction design for F01 (its
  extraction stage, contract loader, and `v01-contract.json`) has been retired.
- [`backend/src/services/ai-kit.service.js`](../../backend/src/services/ai-kit.service.js)
  is the sole Backend package importer and creates the shared runtime instance
  with normalized Backend configuration and the canonical Backend logger.
  B1 `job-ai-normalization.service.js` (`normalizeInternalJob`) and B2
  `candidate-cv-ai-normalization.service.js` (`normalizeOwnGeneratedCandidateCv`)
  consume that instance for F01/F02. They reuse `job.service.js`
  `loadInternalJob` and `candidate-cv.service.js` `loadOwnActiveCandidateCv`
  for canonical authorization, visibility, ownership, and tenant boundaries.
  Backend owns canonical source validation, lossless persisted-source
  projection, string-ID/ISO-date serialization, and taxonomy resolution. AI Kit
  receives valid plain projections, validates their shape and resolved-reference
  consistency, and performs deterministic normalization. B1/B2 reuse canonical
  model validators for local Location invariants; AI Kit does not duplicate
  domain validation or perform catalog lookups.
  Malformed persisted sources become projection errors rather than being
  repaired by hydration or public serializers. Typed MongoDB availability
  failures in source or taxonomy reads return FAILED with no profile;
  domain refusals and unexpected errors propagate. AI-V03's Candidate matching
  HTTP entry now consumes the same lossless projection path through a V8-visible
  Job loader and the own-CandidateCV normalization entries. There are no source
  writes, profile persistence, or separate AI Kit lifecycle. AI-V04's Candidate
  evaluation HTTP entry reuses the same authorized READY profile preparation
  and calls `evaluateCv` through the shared AI Kit instance.
- AI-V02 Slice 4a adds a Backend-only Uploaded CandidateCV `cvSource`
  projection in the same CandidateCV AI service. It requires a previously
  authorized own active CV, rechecks the persisted source and taxonomy, and
  returns plain metadata without reading the PDF or invoking AI Kit.
  Slice 4c adds the internal own-Candidate runtime invocation in that service,
  binding the projection and current PDF read to one file identity before
  calling the shared AI Kit instance. AI-V03 Candidate matching consumes this
  entry after the existing own-CandidateCV and V8 Job access checks.
- Explicit `tooling/smoke-codex`, `tooling/smoke-gemini`, and
  `tooling/smoke-groq` package subpaths are
  manual provider-smoke tooling only. They are not production capability APIs.
- AI-V03 `matchJobCv` composes the internal F02 Semantic Skills Assessment, F03
  deterministic field scoring, and F04 Skills/weighted aggregation owners into
  one runtime Match Result. F02 makes one provider-native strict structured-output
  call and restores Job/CV source provenance. The public instance entry returns
  Job/CV identities, all five field scores, weights, contributions, and the
  overall score. Backend now calls it from the authenticated Candidate matching
  HTTP entry after V01/V02 normalization. Persistence remains absent.
- AI-V04 `evaluateCv` accepts one READY Job/CV normalization pair and makes one
  strict structured-output inference for semantic skills assessment and CV
  feedback. It reuses V03 semantic source/rubric validation and scoring
  calculators, returns the total score, summary, five field reviews, and CV
  improvements, and uses the existing CV career read view for source-aware
  feedback. The Backend Candidate HTTP entry consumes it after own-CV and V8
  Job access checks, returning the evaluation without persistence.

### Implemented foundations

- `src/llm/codex-client.js`, `src/llm/gemini-client.js`, and
  `src/llm/groq-client.js` are internal, provider-specific adapters and the
  only direct consumers of `openai`, `@google/genai`, and `groq-sdk`,
  respectively. Manual live smoke tests have verified Codex through the
  compatible endpoint with `gpt-5.6-sol`, Gemini with `gemini-3.8-flash`, and
  Groq with `openai/gpt-oss-120b`.
- `src/llm/llm-fallback.js` implements a bounded provider chain in which the
  composing capability declares the provider order and per-provider attempt
  count. Retry or fallback is eligible only for HTTP 429, 500, 502, 503,
  or 504, or a recognized connection/timeout failure with no HTTP response.
  Authentication, configuration, request-validation, and programming failures
  are not eligible. This utility is not exported and no capability currently
  composes it, so fallback is not automatic for AI Kit calls.
- `src/document/pdf-text-extractor.js` is the sole direct `pdfjs-dist`
  consumer, using the legacy ESM Node build. It extracts existing text layers
  in page order, cleans each page, and destroys its loading task/worker in a
  `finally` block, including loading failures. PDF.js does not perform OCR;
  path extraction returns an empty string for documents without extractable
  text, while the AI-V02 Buffer boundary (`extractPdfTextFromBuffer`) reports
  invalid input, unreadable PDFs, and empty text layers as coded extraction
  failures. The extractor is internal, with no shared disposal or Backend
  lifecycle hook.
- The package-local verification gate covers the public boundary, provider
  adapters, fallback policy, dependency boundaries, a real text-native PDF
  fixture, and per-extraction resource lifecycle behavior. Detailed evidence is
  recorded in the [AI Kit foundation status](../project-status/ai-kit/foundation.md).
- AI-V06 Slice 01 owns its internal strict Optimization Result schema and parser
  in `src/optimization/optimization-result.js`. Slice 02 adds compact source
  and V04 advisory context, a seven-section prompt, and one selected provider's
  structured inference in `src/optimization/cv-optimization.js`. Slice 03
  composes Codex → Gemini → Groq through `src/llm/llm-fallback.js`, with
  completion and contract validation inside each attempt. Baseline merge,
  Draft creation, and Backend integration are not yet connected.

## AI Kit — Target Convention

### Runtime composition and dependency direction

```text
Frontend
    |
    | HTTP
    v
JOBHUB Backend
    |
    | same-process package call
    v
@jobhub/ai-kit
    |
    +-- document text extraction (PDF.js)
    +-- LLM adapters (Codex / Gemini / Groq)
    +-- LLM fallback policy
    +-- approved future AI capabilities
```

The dependency direction is `Backend -> @jobhub/ai-kit`. AI Kit never imports
Backend modules. Backend remains the application and transport boundary; AI Kit
is an in-process computation package, not a microservice.

### Ownership and integration

- Backend owns process startup/shutdown, environment loading and normalized
  configuration, the canonical logger, HTTP, authentication, authorization,
  business permissions, canonical source validation, persistence, and canonical
  JOBHUB domain services. AI Kit projection-shape gates do not replace those
  domain owners.
- AI Kit owns provider adapters, document extraction, internal provider
  fallback policy, and approved AI-specific computation and orchestration.
- Backend passes normalized configuration, the logger, input data, and any
  authorized operation callbacks through the AI Kit public API. AI Kit does not
  load environment state or reach into Backend internals.
- `ai-kit/src/index.js` remains the production package boundary. New capability
  exports are added there only when an approved feature requires them. Backend
  consumes them only through `backend/src/services/ai-kit.service.js`; neither
  side deep-imports the other's filesystem internals.
- Manual provider smoke composition remains split between Backend environment
  composition and AI Kit adapter invocation, connected only through explicit
  tooling package subpaths. Tooling exports do not become production APIs.

### Provider and document conventions

- AI-V02 Uploaded CV normalization selects Codex through the compatible
  Responses API endpoint by default; Gemini (`gemini-3.8-flash` through
  `@google/genai`) and Groq (`openai/gpt-oss-120b` through `groq-sdk`) are
  explicit alternatives. The separate provider-chain utility does not run for
  this capability.
- Each provider adapter owns only its provider SDK construction and delegation.
  `llm-fallback.js` owns the provider-agnostic fallback decision. Capability
  composition must opt into that policy explicitly; adapters do not retry or
  select one another.
- AI-V06 composes Codex → Gemini → Groq through the canonical fallback owner.
  Its capability-specific policy advances after provider errors, timeouts,
  incomplete responses, or output that fails the structured contract, and
  reports AI-processing failure if no provider returns a completed, valid
  result. This applies only to AI-V06 and leaves the single-provider V02–V05
  flows and default provider-availability classifier unchanged.
- The PDF extractor owns PDF.js document handling. Every extraction cleans
  its pages and destroys its own loading task/worker, without affecting
  concurrent calls. It extracts existing text only; OCR is deferred. There is
  no shared runtime to dispose from Backend shutdown.

### Future capability direction

Subject to approved Product and Data contracts, the intended capability groups
are AI #1 (CV–Job evaluation, explanation, and improvement), AI #2
(retrieval/embedding-based Job recommendation), and AI #3 (a bounded-tool CV
draft agent). They are expected to reuse canonical CV/Job match profiles and
the deterministic Matching Engine. AI-V04 and AI-V05 Product/Data contracts
govern the approved scopes for AI #1 and AI #2; this architectural direction
does not approve AI #3 or imply AI-V05 implementation.

A future tool-calling capability preserves Backend ownership of authorization
and domain writes:

```text
Backend authenticates actor
    -> Backend invokes AI Kit
    -> LLM requests tool
    -> AI Kit calls injected callback
    -> Backend validates permission and executes canonical service
    -> AI Kit continues
```

## AI Kit — Architectural Constraints

- AI Kit remains a private, in-process package. It does not gain its own HTTP
  server, port, process lifecycle, deployment unit, or independent environment
  loader without an explicit architecture decision.
- AI Kit must not import Backend modules or access Mongoose models, MongoDB,
  JWTs, Express request/response objects, Backend services, or Backend-internal
  configuration. Dependency injection must not be replaced by reverse imports.
- Authentication, authorization, business permissions, persistence, and
  canonical domain mutations remain Backend responsibilities. AI Kit may
  request an operation only through an injected callback whose Backend owner
  revalidates permission and invokes the canonical service.
- Production consumers use the package-root API. Backend modules do not
  deep-import AI Kit internals, bypass `backend/src/services/ai-kit.service.js`,
  or create parallel shared instances.
- Provider SDK imports remain confined to their adapters, and PDF.js imports
  remain confined to the PDF extractor. Provider fallback remains an explicit
  internal policy, not a claim that every AI request falls back automatically.
- AI capability APIs, persistence shapes, workflows, matching semantics, and
  business rules require approved Product/Data authority. Architecture work
  must not invent those contracts.

### Deferred decisions

- Retries, circuit breakers, and a provider registry are deferred to the
  capability that needs them.
- OCR is out of scope. Buffer text extraction, Uploaded CV output
  composition, and one-pass LLM orchestration exist for AI-V02. The source-aware
  `readCvCareerContent` reader gives both CVMatchProfile variants one career
  consumption contract without changing their source representations. The
  internal Backend Uploaded CV invocation is implemented and consumed by
  AI-V03 Candidate matching; the rest of AI-V02 F01 acceptance remains
  deferred. PDF.js task
  cleanup is owned by each extraction and does not require Backend shutdown
  wiring.
- Recruiter/application access to Generated CV normalization remains deferred.
  AI-V03 Candidate HTTP matching uses V8 public Job visibility and own
  CandidateCV normalization. AI-V05 Slice 01 adds Job `embeddingText`
  persistence and post-publish synchronization; Slice 03 adds runtime Default CV
  query text and Atlas retrieval with Backend visibility revalidation. Persisted
  CV embedding, profile history/freshness, and tool schemas/limits remain deferred.
  AI #1/#2/#3 require their own approved
  Product/Data contracts.

## Frontend current state

### Runtime composition

The current browser runtime is composed as follows:

1. [`frontend/src/main.jsx`](../../frontend/src/main.jsx) imports global styles, creates the React root, and mounts the application inside the single Redux `Provider`.
2. [`frontend/src/App.jsx`](../../frontend/src/App.jsx) composes authentication bootstrap around the single React Router `RouterProvider` and renders the single Sonner `<Toaster />` for transient action feedback. The Toaster receives the application-wide defaults from `TOASTER_CONFIG` in `frontend/src/utils/constant.js`: top-right position, rich success/error colors, close button, 4,000 ms duration, and theme-token styling. Components and feature hooks call `toast` from `sonner` directly without extra setup; toasts are not persisted business notifications.
3. [`frontend/src/routes/index.jsx`](../../frontend/src/routes/index.jsx) composes route groups and creates the browser router. The current public route group maps `/` to `RootLayout` and its nested `HomePage` index route.
4. `RootLayout` composes the application-level `AppHeader` with an `Outlet`; the page owns the complete URL-mapped screen content.
5. One configured Axios client applies `API_CONFIG` (base URL and timeout) from `frontend/src/utils/constant.js`, attaches access credentials only to requests declaring `requiresAuthentication: true`, coordinates reactive single-flight refresh/retry through the Authentication feature, and owns normalized `ApiError` output (including `requestId` from the backend `X-Request-Id` header) plus development-only console logging. `authentication.api.js` is its first resource consumer.
6. One lazy Socket.IO client applies `SOCKET_CONFIG` from `frontend/src/utils/constant.js` and owns connection lifecycle and access-token handshake auth. Authentication login/bootstrap connects it, access refresh updates its credential and reconnects an active connection, and logout/session invalidation disconnects it.
7. The Redux store registers the Authentication feature reducer. Authentication storage is an owned localStorage record; Redux reflects restoration, authenticated, unauthenticated, and temporarily-unavailable UI state without becoming the token source of truth.

### Current folders and responsibilities

```text
frontend/
├── components.json         # shadcn/ui conventions and aliases
├── eslint.config.js        # Frontend lint configuration
├── jsconfig.json           # Editor/import alias configuration
├── vite.config.js          # React, Tailwind CSS v4, and @ alias integration
└── src/
    ├── apis/
    │   ├── client/         # Shared Axios instance, auth interceptors, and error normalization
    │   └── authentication.api.js # Authentication HTTP endpoints
    ├── components/
    │   ├── common/         # Application-level shared components
    │   └── ui/             # shadcn/ui-style primitives
    ├── features/
    │   └── authentication/ # Auth storage/state, lifecycle services, and bootstrap
    ├── layouts/            # Shared route layout frames with Outlet
    ├── lib/                # External-library integration helpers such as cn()
    ├── pages/              # Complete URL-mapped screens
    ├── routes/             # Router composition, route groups, and navigation guards
    ├── socket/             # Shared lazy Socket.IO client
    ├── store/              # Redux Toolkit store composition and shared hooks
    ├── styles/             # Global CSS and application theme tokens
    ├── utils/
    │   └── constant.js     # Central project constants and environment-derived config
    └── validation/         # App-wide provider, focused schemas, and RHF integration
```

`frontend/src/utils/constant.js` is the single owner of frontend project
constants: `RUNTIME_ENV`, `HTTP_HEADER`, `API_CONFIG`, `API_ERROR_MESSAGE`,
`AUTH_STORAGE_KEY`, `SOCKET_CONFIG`, `REALTIME_EVENT`, `VALIDATION_MESSAGE`, and `TOASTER_CONFIG`. It is the only
module that reads `VITE_*` variables. No shared helper module exists beside it
yet.

### Current capability boundary

The frontend currently provides a runnable technical foundation, sample
screen, and V1 authentication lifecycle infrastructure. It still has no
concrete login/logout screen, feature-specific realtime listener, or
role-specific application shell. Route guards consume the Authentication
feature's resolved state, but no concrete guarded routes or redirect
destinations have been approved and declared yet.

The canonical frontend owners and known mismatches remain in
[`frontend-source-of-truth.md`](frontend-source-of-truth.md). This architecture
document does not duplicate that owner matrix.

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
- `REALTIME_EVENT` in `frontend/src/utils/constant.js` owns frontend transport event-name constants and must remain aligned with the backend realtime event contract.
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
- `frontend/src/utils/` contains pure, domain-neutral helpers reused across multiple application areas, such as general formatting or data conversion, and the central `constant.js`. It is not a dumping ground for unowned logic.
- `frontend/src/utils/constant.js` is the canonical owner of project constants, including environment-derived configuration, closed vocabularies, shared default messages, and library defaults such as `TOASTER_CONFIG`. Other modules import from `@/utils/constant` rather than redeclaring literals.
- `frontend/src/validation/index.js` is the application-wide validation provider/public facade. Validator implementations and form/payload schemas live in focused `*.validators.js` and `*.schema.js` modules under `src/validation/`, then are imported and re-exported by the provider. Internal validation modules do not import the provider, avoiding circular dependencies; form consumers import schemas and `zodResolver` through `@/validation` for React Hook Form integration.
- `frontend/src/styles/` owns global CSS, application theme tokens, and application-wide styling rules.
- Tailwind configuration follows the installed major version. The current Tailwind CSS v4 integration uses the Vite plugin, CSS imports, and `@theme`; legacy configuration files are not added without a concrete requirement.

### Configuration

- `frontend/vite.config.js` owns Vite plugins and the runtime `@` alias; `frontend/jsconfig.json` mirrors the alias for editor/tooling resolution.
- `frontend/components.json` owns shadcn/ui generation conventions and aliases.
- Vite environment files belong at the frontend project root (`frontend/.env*`), not under `frontend/src/`.
- Only public browser configuration uses the `VITE_*` prefix. Secrets must never be placed in frontend environment variables because Vite bundles them into client assets.
- `VITE_API_BASE_URL` and `VITE_SOCKET_URL` are read only by `frontend/src/utils/constant.js` (`API_CONFIG`, `SOCKET_CONFIG`) and configure the shared HTTP and realtime clients; their code defaults remain development-safe fallbacks, not secret configuration.

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

Current deviations from these constraints are catalogued in [`frontend-source-of-truth.md`](frontend-source-of-truth.md). They are documentation of the existing state, not authorization to duplicate or extend the mismatch.
