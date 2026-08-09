# Backend Sources of Truth

## Purpose

This document identifies the single canonical owner for each backend responsibility. It is normative for new and changed code, while the **Current known mismatches** section records where the repository does not yet match the target convention.

“Allowed consumers” identifies which code may import or call the owner. It does not grant a consumer permission to take ownership of the responsibility itself.

## Ownership table

| Responsibility | Canonical owner | Allowed consumers | Forbidden duplication |
| --- | --- | --- | --- |
| Process entry point, server startup, shutdown, and process-level failure handling | `backend/index.js` | Package start scripts and the Node.js runtime | Additional server listeners, startup entry points, or process signal owners elsewhere |
| Express application instance and composition order | `backend/src/app.js` | `backend/index.js`; application-level test harnesses when introduced | Creating another production Express app or composing global application middleware in feature modules |
| Dotenv loading | `backend/src/config/index.js` | No other module loads dotenv | Loading dotenv in any other module or establishing multiple dotenv loaders |
| Reading environment variables | `backend/src/config/index.js` | No other module reads `process.env`; consumers use its exported configuration | Any direct `process.env` access in another module, including another module inside `src/config/` |
| Environment validation, parsing, normalization, and approved defaults | `backend/src/config/index.js` | Any backend module may consume the normalized exported values where appropriate | Secondary environment parsers, validators, normalizers, defaults, or config objects representing the same values |
| MongoDB/Mongoose connection lifecycle | `backend/src/config/mongodb.js` | Startup/shutdown owner; approved database tooling | Calling `mongoose.connect()` or owning connection lifecycle in routes, controllers, services, models, or new connection modules |
| One-time database migration invocation and connection orchestration | `backend/scripts/run-migration.js` | Explicit package scripts and operators executing an approved migration | Running migrations from application startup, request paths, seed files, or a second migration runner |
| Versioned migration data transformations | `backend/src/database/migrations/<versioned-name>.js` | Canonical migration runner and focused migration tests | Embedding migration transformations in services, models, startup, seeds, or parallel migration locations |
| Platform ExperienceLevel codes (V4 F06) | `backend/src/constants/experience-level.js` | ExperienceLevel persistence and dataset initialization | Inline redefinition of ExperienceLevel codes or expanding beyond the locked six-member set |
| ExperienceLevel persistence model | `backend/src/models/experience-level.model.js` | Approved migration tooling and future read consumers | A second ExperienceLevel schema/model, extra catalog metadata fields, or runtime CRUD/service ownership |
| ExperienceLevel canonical dataset initialization (V4 F06) | `backend/src/database/migrations/v4-experience-level-dataset.js` | Canonical migration runner and focused migration tests | Initializing ExperienceLevel from seeds, startup, request paths, or a second migration/seed owner |
| Cloudinary configured client and connection verification | `backend/src/config/cloudinary.js` | Startup owner and services that perform Cloudinary operations | Reconfiguring Cloudinary or creating another configured Cloudinary client elsewhere |
| SMTP/Nodemailer transport | `backend/src/config/mailer.js` | Mail service | Creating parallel SMTP transporters or reading SMTP environment variables directly instead of consuming `src/config/index.js` |
| Sending application email | `backend/src/services/mail.service.js` | Controllers and other services that coordinate an approved workflow | Direct `transporter.sendMail()` calls outside the mail service or additional general-purpose mail senders |
| Root API router | `backend/src/routes/index.js` | Express application | Additional root API router registries or mounting feature routers directly in the entry point |
| Feature endpoint declarations and middleware chains | `backend/src/routes/<name>.routes.js` | Root router | Defining the same feature endpoint in multiple routers; embedding business logic or database access in routes |
| HTTP request/response translation for a feature | `backend/src/controllers/<name>.controller.js` | Feature routes | HTTP handling in services/models/utils; database/model access or business workflow ownership in controllers |
| Feature business workflows and business validation | `backend/src/services/<name>.service.js` | Controllers and other approved services | Reimplementing the workflow in routes, middleware, controllers, utils, or parallel services |
| Mongoose schema, model, and persistence representation | `backend/src/models/<name>.model.js` | Services and approved database tooling | Duplicate schemas/models or model ownership in controllers, routes, middleware, or utils |
| Cross-cutting request processing | `backend/src/middlewares/<name>.js` | Express application and feature routes | Business workflows in middleware or duplicate middleware for an already-owned concern |
| Session-bound access authentication | `backend/src/services/authenticate-access.service.js` (validation); `backend/src/middlewares/authenticate-access.js` (HTTP extraction and request enrichment) | Protected feature routes and their middleware chains | Reimplementing access/session validity checks in controllers, routes, utils, or parallel auth middlewares |
| Company Manager onboarding access authentication | `backend/src/services/authenticate-access.service.js` (`authenticateOnboardingAccess`); `backend/src/middlewares/authenticate-onboarding-access.js` | V2 Company onboarding routes that require Company Staff Manager membership semantics with `PENDING_ACTIVATION` | Treating onboarding access as ACTIVE-account access or reimplementing onboarding auth outside the canonical owners |
| Company self-service GET/PATCH access composition | `backend/src/middlewares/authenticate-company-self-service-access.js` | Company GET/PATCH `/` routes | Parallel dual-mode auth for company self-service, or folding ACTIVE F09 access into onboarding auth |
| Session access for logout (ACTIVE or onboarding CM) | `backend/src/services/authenticate-access.service.js` (`authenticateSessionAccess`); `backend/src/middlewares/authenticate-session-access.js` | Logout route | Parallel logout credential checks outside the session-access owners |
| Platform Admin authorization | `backend/src/middlewares/authorize-platform-admin.js` | Platform-admin routes after access authentication | Role checks for Platform Admin workflows duplicated in controllers, routes, or services |
| Category level enum (`FIELD`, `POSITION`) | `backend/src/constants/category-level.js` | Category persistence and workflows | Inline redefinition of Category levels or a third level value |
| Category persistence model | `backend/src/models/category.model.js` | Category service and approved database tooling | A second `Category` schema/model, client-authored `normalizedName`, or direct use from routes/controllers/middleware |
| Platform Admin create Category FIELD (V4 F01) | `backend/src/services/category.service.js` (`createFieldCategory`) | Category / platform-admin controllers | Parallel FIELD-create workflows outside the category service; duplicating Platform Admin role checks in the service; accepting client `level`/`parentCategoryId` for FIELD creation |
| Platform Admin create Category POSITION (V4 F02) | `backend/src/services/category.service.js` (`createPositionCategory`) | Category / platform-admin controllers | Parallel POSITION-create workflows outside the category service; duplicating Platform Admin role checks in the service; allowing missing/non-FIELD parents; mutating the parent FIELD |
| Platform Admin account lock (V1 F10) | `backend/src/services/platform-admin.service.js` | Platform-admin controllers | Parallel account-lock workflows in auth or other services |
| Platform Admin account terminate (V1 F11) | `backend/src/services/platform-admin.service.js` | Platform-admin controllers | Parallel account-termination workflows in auth or other services |
| Platform Admin company registration review (V2 F04) | `backend/src/services/platform-admin.service.js` | Platform-admin controllers | Parallel Platform Admin company-registration list/detail workflows outside the platform-admin service |
| Platform Admin reject Company (V2 F06) | `backend/src/services/platform-admin.service.js` | Platform-admin controllers | Parallel Platform Admin company-reject workflows outside the platform-admin service |
| Platform Admin approve Company / TX-02 confirmation issue (V2 F05) | `backend/src/services/platform-admin.service.js` | Platform-admin controllers | Parallel Platform Admin company-approve or confirmation-issue workflows outside the platform-admin service |
| Platform Admin lock Company / TX-04 (V2 F10) | `backend/src/services/platform-admin.service.js` | Platform-admin controllers | Parallel Company lock or CM termination-on-lock workflows outside the platform-admin service |
| Unmatched routes | `backend/src/middlewares/not-found.js` | Express application | Feature-specific or application-wide replacement 404 handlers elsewhere |
| Final centralized HTTP error handling | `backend/src/middlewares/error-handler.js` | Express application; errors forwarded by the request pipeline | Competing global error handlers or independently defined global error response contracts |
| Operational application error type | `backend/src/utils/app-error.js` | Routes, middleware, controllers, services, and other helpers as appropriate | Additional general-purpose application error classes representing the same contract |
| Generic reusable helpers | The relevant module under `backend/src/utils/` | Any layer for which the helper is dependency-safe | Feature business workflows, HTTP handling, or persistence ownership hidden in utils |
| Shared enum-like constants and fixed mappings | The relevant module under `backend/src/constants/` | Any backend layer that needs the value | Multiple constant modules defining the same domain concept or inline redefinition of canonical values |
| Platform Location vocabulary (V4 F03) | `backend/src/constants/location.js` | Any backend layer that needs Location values | A second Location member list, persisted Location catalog, Remote-as-Location member, or auto-synced/renamed administrative geography set |
| Platform EmploymentType vocabulary (V4 F04) | `backend/src/constants/employment-type.js` | Any backend layer that needs EmploymentType values | A second EmploymentType member list or persisted EmploymentType catalog |
| Platform WorkMode vocabulary (V4 F05) | `backend/src/constants/work-mode.js` | Any backend layer that needs WorkMode values | A second WorkMode member list, persisted WorkMode catalog, or treating `REMOTE` as a Location |
| Platform account types (`CANDIDATE`, `COMPANY_STAFF`, `PLATFORM_ADMIN`) | `backend/src/constants/user-role.js` | Any backend layer that needs platform roles | Inline redefinition of platform account types or restoring removed `COMPANY_MANAGER` on `User.role` |
| Company membership roles (`COMPANY_MANAGER`, `RECRUITER`) | `backend/src/constants/company-member-role.js` | Company membership persistence and workflows | Defining Company roles on `User.role` or a second Company-role owner |
| Company membership statuses (`ACTIVE`, `LOCKED`, `TERMINATED`) | `backend/src/constants/company-member-status.js` | Company membership persistence and workflows | A second Company-membership status owner |
| Job lifecycle statuses (`DRAFT`, `PENDING_APPROVAL`, `PUBLISHED`, `CLOSED`, `EXPIRED`) | `backend/src/constants/job-status.js` | Job persistence and workflows | Inline redefinition of Job statuses or inventing Product-excluded states such as `REJECTED` |
| V1/V2/V3 authentication-token types (`EMAIL_VERIFICATION`, `PASSWORD_RESET`, `COMPANY_APPROVAL_CONFIRMATION`, `RECRUITER_ACTIVATION`) | `backend/src/constants/auth-token-type.js` | Authentication-token persistence and workflows | Additional authentication-token type owners or unsupported authentication-token types |
| File storage operations | `backend/src/services/file.service.js` | Controllers and approved services | Direct Cloudinary upload/delete operations in routes, controllers, middleware, models, or another general file service |
| User persistence model | `backend/src/models/user.model.js` | Services and approved database tooling | A second `User` schema/model or direct use from routes/controllers/middleware |
| Company persistence model | `backend/src/models/company.model.js` | Services and approved database tooling | A second `Company` schema/model or direct use from routes/controllers/middleware |
| CompanyMember persistence model | `backend/src/models/company-member.model.js` | Services and approved database tooling | A second `CompanyMember` schema/model or direct use from routes/controllers/middleware |
| Job persistence model (V5) | `backend/src/models/job.model.js` | Job service and approved database tooling | A second `Job` schema/model, Supporting Recruiter fields, replacement V4 catalog collections, or direct use from routes/controllers/middleware |
| Recruiter create Job DRAFT (V5 F01) | `backend/src/services/job.service.js` (`createDraftJob`) | Job controllers | Parallel Job-create workflows outside the job service; treating client `companyId` as tenant authority; requiring submit-complete content at create time |
| Recruiter edit Job DRAFT (V5 F02) | `backend/src/services/job.service.js` (`updateDraftJob`) | Job controllers | Parallel DRAFT-edit workflows outside the job service; mutating ownership/creator/Primary/status/`publishedAt` through content edit; allowing non-Primary or non-DRAFT content mutation |
| Internal Job visibility boundary (V5 F03) | `backend/src/services/job.service.js` (`buildInternalJobVisibilityFilter`, `listInternalJobs`, `getInternalJob`) | Job controllers and later Company Staff Job workflows that must reuse the same visibility scope | Parallel internal Job list/detail authorization outside the job service; authorizing via creator or historical Primary alone; treating Job id as tenant authority; expanding into Candidate/public discovery semantics |
| Recruiter submit Job DRAFT for approval (V5 F04) | `backend/src/services/job.service.js` (`assertJobReadyForApprovalLifecycle`, `submitDraftJob`) | Job controllers and later approve/publish revalidation | Parallel submit workflows outside the job service; applying submit completeness at create/edit time; mutating content/ownership/creator/Primary during submit; non-atomic status transition that can leave partial lifecycle state |
| Recruiter outstanding Primary Job responsibility guard (V5 BR-41) | `backend/src/services/job.service.js` (`assertNoOutstandingPrimaryResponsibility`) | Recruiter lock/terminate workflows | Reimplementing the outstanding-Primary query outside the job service; expanding TX-04/TX-05 into a jobs↔company_members multi-document transaction solely for this guard |
| Company membership / Company-role resolution (V3 F01) | `backend/src/services/company.service.js` (`resolveCompanyStaffMembership`, `findCompanyManagerMembership`, `resolveOwnedCompany`) | Auth, company, platform-admin, and approved middleware consumers | Parallel Company-role or tenant-membership resolution outside the company service |
| Company Staff tenant resolution and business authorization (V3 F02, F14, F15) | `backend/src/services/company.service.js` (`resolveCompanyStaffTenant`, `assertCompanyStaffBusinessAccess`, `resolveCompanyStaffBusinessContext`, `resolveCompanyManagerRecruiterManagementContext`, `resolveRecruiterBusinessContext`) | Approved middleware and Company Staff / Recruiter business services | Parallel tenant derivation from client `companyId`/`managerUserId`, or reimplementing layered business-access gates outside the company service |
| Company Staff business-access HTTP authorization | `backend/src/middlewares/authorize-company-staff-business-access.js` | Company Staff business routes after access authentication | Duplicating F14 layered checks in controllers, routes, or ad-hoc middleware |
| Company Manager recruiter-management HTTP authorization | `backend/src/middlewares/authorize-company-manager-business-access.js` | Company Manager Recruiter-management routes after access authentication | Duplicating BR-06/BR-24 role gates outside the approved middleware/service owners |
| Recruiter business-access HTTP authorization (V5) | `backend/src/middlewares/authorize-recruiter-business-access.js` | Recruiter Job routes after access authentication | Duplicating Recruiter role/tenant gates outside the approved middleware/service owners |
| Company Manager create Recruiter / TX-01 + activation issuance (V3 F03, F04) | `backend/src/services/recruiter.service.js` | Recruiter controllers | Parallel Recruiter-create or activation-token issuance workflows outside the recruiter service; including SMTP in TX-01; exposing bootstrap password or raw activation token to Company Manager |
| Company Manager list/detail Recruiter (V3 F08, F09) | `backend/src/services/recruiter.service.js` | Recruiter controllers | Parallel Recruiter list/detail workflows outside the recruiter service; authorizing from client `companyId`/`managerUserId`; exposing passwordHash, token, or session credential fields |
| Company Manager initiate Recruiter password reset (V3 F07) | `backend/src/services/recruiter.service.js` | Recruiter controllers | Parallel CM-initiated Recruiter password-reset issuance outside the recruiter service; creating a CM-specific token type; exposing raw reset tokens or passwords to Company Manager; treating password reset as unlock/restore |
| Company Manager lock/unlock Recruiter (V3 F11, F12 / TX-04) | `backend/src/services/recruiter.service.js` | Recruiter controllers | Parallel Recruiter lock/unlock workflows outside the recruiter service; changing User.status or Company lifecycle; restoring revoked AuthSession on unlock; unlocking platform-restricted Users or TERMINATED membership; completing lock while outstanding Primary Job responsibility remains |
| Company Manager terminate Recruiter / TX-05 (V3 F13, F16) | `backend/src/services/recruiter.service.js` | Recruiter controllers | Parallel Recruiter termination outside the recruiter service; hard-deleting User/CompanyMember; changing User.status or Company lifecycle; releasing email for reuse; restoring TERMINATED membership to ACTIVE/LOCKED; completing terminate while outstanding Primary Job responsibility remains |
| Candidate/Recruiter self password-reset issue and TX-03 completion (V1 + V3 F06) | `backend/src/services/auth.service.js` | Auth controllers; Recruiter service for shared issuance | Parallel PASSWORD_RESET issuance/completion outside the auth service; changing User.status, CompanyMember, or Company lifecycle during reset |
| V3 TX-07 Company Manager → Company Staff cutover | `backend/src/database/migrations/v3-tx07-company-manager-to-company-staff.js` | Canonical migration runner and focused migration tests | Embedding TX-07 transformation in services, models, startup, or seeds |
| Company Manager registration / TX-01 onboarding (V2 F01) adapted by V3 TX-06 | `backend/src/services/auth.service.js` | Auth controllers | Parallel Company Manager registration workflows outside the auth service |
| Company Manager confirm approval / TX-03 activation (V2 F07) | `backend/src/services/auth.service.js` | Auth controllers | Parallel confirmation-consume or Company/CM activation workflows outside the auth service |
| Recruiter activation completion / TX-02 (V3 F05) | `backend/src/services/auth.service.js` | Auth controllers | Parallel Recruiter-activation-consume workflows outside the auth service; changing User.status, CompanyMember, or Company lifecycle during activation; exposing raw activation tokens |
| Company draft profile and tenant ownership (V2 F02) | `backend/src/services/company.service.js` | Company controllers | Parallel Company draft/tenant resolution workflows outside the company service |
| Company submit and immutable review snapshot (V2 F03) | `backend/src/services/company.service.js` | Company controllers | Parallel Company submit/snapshot workflows outside the company service |
| Company Manager resend approval confirmation (V2 F08) | `backend/src/services/company.service.js` | Company controllers | Parallel approval-confirmation resend workflows outside the company service |
| Company Manager active Company profile management (V2 F09) | `backend/src/services/company.service.js` | Company controllers | Parallel active Company profile get/update workflows outside the company service |

## Consumption rules

- Consumers import the canonical owner; they do not reconstruct its state or configuration.
- A convenience re-export may expose an owner, but it does not become a second owner.
- Constants representing one domain concept have one canonical module.
- Services may access models directly under the current architecture.
- A repository/data-access layer must not be introduced unless explicitly approved as an architecture change.
- When an ownership decision changes, this document and the architecture documentation must change with it.

## Current known mismatches

The following items describe the audited repository. They are not target patterns and do not propose a remediation.

### The model barrel is disconnected and empty

[`backend/src/models/index.js`](../../backend/src/models/index.js) exports an empty frozen object. Concrete model modules such as [`backend/src/models/user.model.js`](../../backend/src/models/user.model.js) are imported directly by services rather than through the barrel.

Whether model barrels should be mandatory, optional, or removed is not established by the target conventions. The mismatch recorded here is that the existing barrel presents no usable model ownership or aggregation.

### The middleware barrel is empty

[`backend/src/middlewares/index.js`](../../backend/src/middlewares/index.js) is empty. Middleware consumers currently import concrete files directly. The target conventions do not establish whether a middleware barrel is required.

### Controller error formatting overlaps centralized error handling

[`backend/src/controllers/file.controller.js`](../../backend/src/controllers/file.controller.js) directly constructs error responses for a missing upload, a missing public ID, and a Cloudinary “not found” result. [`backend/src/middlewares/error-handler.js`](../../backend/src/middlewares/error-handler.js) separately owns the centralized error response structure for forwarded errors. The current code therefore has overlapping ownership of expected error formatting.

Controllers are still responsible for translating service outcomes into HTTP semantics under the target convention. The precise boundary between controller translation and centralized response formatting remains a human decision.

### Required configuration values also have unreachable defaults

[`backend/src/config/index.js`](../../backend/src/config/index.js) first rejects absent values in its required-variable loop, then supplies defaults for several of those same values. Examples include `NODE_ENV`, `PORT`, `MONGODB_SERVER_SELECTION_TIMEOUT_MS`, `JWT_EXPIRES_IN`, `JWT_ALGORITHM`, `BCRYPT_SALT_ROUNDS`, `SMTP_PORT`, and `MAIL_FROM_NAME`. When these variables are absent, validation throws before the defaults can be used.

### Input and business validation ownership overlaps

The file controller checks that a delete `publicId` is a non-empty string, and [`backend/src/services/file.service.js`](../../backend/src/services/file.service.js) repeats the same check. Upload existence is checked in the controller, while content type is checked in middleware. The repository does not yet apply a uniform distinction among transport validation, normalization, and business validation.

### Placeholder barrels and database seed files have no active responsibility

The middleware barrel and model barrel do not aggregate their layers. [`backend/src/database/seed.js`](../../backend/src/database/seed.js) is empty, and `backend/src/database/seeds/seed-1.js` contains only a placeholder comment. These files currently represent structure rather than active behavior.

## Decisions still requiring human confirmation

The target conventions do not settle these points:

- whether model and middleware barrel files are required public entry points, optional conveniences, or unwanted;
- the exact boundary between controller-owned HTTP error translation and centralized error-body formatting;
- which configuration values are truly required and which are intended to have defaults;
- whether request-shape validation belongs in route middleware, controllers, or a consistent combination of both; and
- whether seed scaffolding is intended to remain and, if so, what module owns seed orchestration.

Until those decisions are made, code must not establish a second owner or infer a new architectural layer.
