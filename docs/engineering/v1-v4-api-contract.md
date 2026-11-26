# V1–V4 API completion contract

Approved scope: 2026-10-21. Product authority remains the respective
[V1](../product/backend/versions/v01-account-authentication.md),
[V2](../product/backend/versions/v02-company-onboarding-platform-administration.md),
[V3](../product/backend/versions/v3-company-recruitment-staff-management.md) and
[V4](../product/backend/versions/v4-platform-standard-catalogs.md) specifications.
This document records HTTP shapes for the approved completion work.

## Common list contract

Dynamic lists always return their existing list key plus
`pagination: { page, limit, total, totalPages }`.
`page` defaults to 1; `limit` defaults to 20 and must be at most 100.
Both must be positive decimal integers; empty, repeated, array/object,
fractional, exponential, signed, leading-zero and unsafe values return 400.
Out-of-range pages return an empty list with the filtered total; zero total
has zero totalPages. Unknown parameters, invalid enums, ids or sort return 400.

`sort=field` sorts ascending; `sort=-field` sorts descending. Each sort appends
unique `_id` in the same direction. Default is `-createdAt`, except Recruiter
lists preserve ascending membership `createdAt`. Filter/search precedes count,
sort and page selection. Search is a case-insensitive literal substring, trimmed,
nonblank and at most 200 characters; regex syntax is escaped. Filter groups are ANDed;
search fields within a group are ORed. No changes apply to V5–V17 pagination.

## V1

All account and membership DTOs whitelist public fields. No passwords, hashes,
raw action tokens, refresh credentials or session collections are returned.
Company Manager and Recruiter roles always come from CompanyMember.role;
User.role remains COMPANY_STAFF.

| Method/path | Access/input | Success body |
| --- | --- | --- |
| GET `/api/auth/me` | Valid session-bound Bearer token; supports limited Company Manager onboarding | `{ user, membership }`, membership null for non-staff |
| POST `/api/auth/forgot-password` | `{ email }`; Candidate, Company Manager including onboarding, activated Recruiter | Existing `{ message }` unchanged |
| GET `/api/platform-admin/accounts` | Platform Admin; `actorType`, `q`, `userStatus`, `companyId`, `sort`, `page`, `limit` | `{ accounts, pagination }` |
| GET `/api/platform-admin/accounts/:userId` | Platform Admin | `{ account }` |
| POST `/api/auth/change-password` | Normal ACTIVE authentication; strict `{ currentPassword, password }` | `{ message }`; all sessions revoked, client signs in again |
| POST `/api/auth/resend-verification` | Strict `{ email }`; eligible ACTIVE unverified Candidate only | `{ message }` |

User DTO: `id, fullName, email, role, status, emailVerifiedAt,
mustChangePassword, createdAt, updatedAt`.
Membership DTO: `id, companyId, role, status, employeeCode, jobTitle`.
Admin account DTO adds `actorType` and `membership` to User DTO.
`actorType`: CANDIDATE, COMPANY_MANAGER, RECRUITER, PLATFORM_ADMIN.
`userStatus`: PENDING_ACTIVATION, ACTIVE, LOCKED, TERMINATED.
Account sort fields: createdAt, updatedAt, fullName, email.
`companyId` filters the membership relationship, combined with other filters.
Admin account `q` searches fullName/email. Detail returns 400 for invalid id,
404 for an absent account. Missing authentication returns 401; a non-admin
returns 403. Company Manager list/detail reuse these Accounts endpoints only.

Change Password requires current password, applies the existing 8–64 character
policy without trimming, atomically updates passwordHash, revokes every session
and removes PASSWORD_RESET credentials. Wrong current password returns 400;
malformed bodies return 400. Lifecycle and activation state stay unchanged.

Forgot Password and Resend Verification return the same success message for
missing or ineligible emails. Company Manager uses company approval activation;
Recruiter uses Recruiter activation, so neither can bypass activation through
Resend Verification. Resends replace earlier tokens of the same type, persist
hashes with expiry, send outside the transaction and return 503 on SMTP failure,
removing only the failed issuance token. Existing account records are retained.
Consumption enforces expiration and one-time use. SMTP is not exactly-once delivery.

## V2

All paths require normal ACTIVE authentication and Platform Admin authorization.

| Method/path | Query | Success body |
| --- | --- | --- |
| GET `/api/platform-admin/companies` | `q`, `approvalStatus`, `operationalStatus`, `sort`, `page`, `limit` | `{ companies, pagination }` |
| GET `/api/platform-admin/companies/:companyId` | None | `{ company, manager }` |
| GET `/api/platform-admin/company-registrations` | Same list queries | `{ companyRegistrations, pagination }` |

Companies include NOT_SUBMITTED and return current public Company fields,
plus public manager summary in each list entry. Detail returns the same current
Company projection with a separate manager summary. Existing `toPublicCompany`
projection retains derived managerUserId; ownership still comes from CompanyMember.
Manager summary: `id, fullName, email, role, status`.

Registrations require non-null submittedAt/reviewSnapshot and approvalStatus
other than NOT_SUBMITTED, including when the caller filters NOT_SUBMITTED
(which produces an empty page). Existing registration DTO keys remain unchanged;
search uses snapshot name/businessRegistrationNumber. Companies search current
name/businessRegistrationNumber. Approval filters: NOT_SUBMITTED, PENDING,
APPROVED, REJECTED. Operational filters: INACTIVE, ACTIVE, LOCKED.
Sort fields: createdAt, updatedAt, name, submittedAt. Registration name sorting
uses reviewSnapshot.name. Missing Company returns 404; invalid id returns 400.
No Company unlock/reactivation or lifecycle modification is introduced.

## V3

| Method/path | Access/input | Success body |
| --- | --- | --- |
| GET `/api/company/recruiters` | Valid Company Manager in approved active Company | Existing `{ message, recruiters }` plus pagination |
| GET `/api/platform-admin/companies/:companyId/recruiters` | Platform Admin; Company must exist | `{ recruiters, pagination }` |
| PATCH `/api/company/recruiters/:recruiterId` | Valid Company Manager, same Company; strict `{ employeeCode?, jobTitle? }` | `{ message, recruiter }` |
| POST `/api/company/recruiters/:recruiterId/resend-activation` | Same Company Manager scope; no credential input | `{ message }` |

Recruiter DTO remains `id, fullName, email, role, status, emailVerifiedAt,
mustChangePassword, membership, createdAt, updatedAt`; membership uses the V1 shape.
Both lists accept `q`, `membershipStatus`, `userStatus`, `sort`, `page`, `limit`.
Search: fullName, email, employeeCode, jobTitle. Sort fields: createdAt,
updatedAt (membership timestamps), fullName, email, employeeCode, jobTitle.
Membership filters: ACTIVE, LOCKED, TERMINATED. User filters use the V1 set.
The existing Company Manager `companyId` guard is preserved: it cannot expand tenant
scope (a different Company ID returns 403). No manager-specific API is introduced.

PATCH requires at least one field, trims each string, rejects blank or over-100
character values, and rejects all other fields with 400. The existing tenant guard
may reject a foreign companyId with 403 before body validation. Same-Company
ACTIVE/LOCKED memberships can be updated; TERMINATED returns 409. Identity,
role, Company, lifecycle status, activation and sessions remain unchanged.
Duplicate employeeCode in the Company (including retained TERMINATED membership)
returns 409 with no partial update. Concurrent uniqueness uses the existing index;
conditional write checks status at mutation time. Foreign/non-Recruiter/unknown
target returns 404; invalid recruiterId returns 400. PUT remains unsupported (404).

Resend Activation requires User ACTIVE, mustChangePassword=true and membership
not TERMINATED. Activated Recruiter or ineligible lifecycle returns 409;
foreign target returns 404. Replaces RECRUITER_ACTIVATION token, mails only the
Recruiter, never returns token/password to Company Manager, and cleans up the
new token on mail failure (503). Activation completion retains its existing
ACTIVE membership/Company gates. PASSWORD_RESET remains a separate post-activation
flow; Lock, Unlock and Terminate workflows are unchanged.

## V4 optional pagination

| GET path | Existing list key |
| --- | --- |
| `/api/categories/fields` | fields |
| `/api/categories/fields/:fieldId/positions` | positions |
| `/api/locations/provinces` | provinces |
| `/api/locations/provinces/:provinceCode/district-level-units` | districtLevelUnits |
| `/api/experience-levels` | experienceLevels |

Without both page and limit, these public reads return their full legacy body
with no pagination key. With either parameter, apply the common defaults,
validation and metadata, slicing the existing catalog order. Catalog query
parameters are limited to page/limit; no catalog sort/search/filter is added.
DTOs, dataset ordering, parent validation and provider failures retain their
existing behavior. No mutation, local provider fallback or consumer change is added.

## Platform Admin integration (14 endpoints)

This section documents the existing V1–V4 Admin HTTP surface for FE handoff.
It introduces no business capability or persistence change. The version sections
above remain the shared read contract; the tables below include the existing
lifecycle and Category commands as well. Canonical implementations are
`platform-admin.routes.js`, `platform-admin.controller.js`,
`platform-admin.service.js`, and the existing Recruiter/Category owners.

### Authentication and request conventions

- All 14 endpoints below require `Authorization: Bearer <accessToken>` from
  normal ACTIVE authentication and `User.role=PLATFORM_ADMIN`. Use the existing
  `/api/auth/login`, `/api/auth/refresh`, and `/api/auth/logout` session flow;
  `/api/auth/me` supplies the signed-in public account. A browser role guard
  does not replace these backend checks.
- Base path: `/api/platform-admin`. Every path parameter ending in `Id` is a
  MongoDB ObjectId represented as a 24-character hex string.
- GET requests need no body. The lock/terminate/approve/reject commands need
  no body and define no query options. Category commands send JSON with
  `Content-Type: application/json` and strictly accept only `{ "name": "..." }`;
  name must be a nonblank string. Do not send role, level or Company selectors.
- Only the four dynamic list endpoints accept the strict list queries in the
  next table. Unknown/repeated/non-string query values return 400. Detail and
  command endpoints define no list controls; do not attach list queries there.
- Response IDs are strings; dates serialize as ISO timestamps, or null where
  the lifecycle has not reached that milestone. Profile values may be null.
  Treat IDs and timestamps as server-owned values.

### Endpoint inventory and success responses

Paths in this table are relative to the base path above. DTOs are defined below.
The `message` strings are informational; branch client behavior on HTTP status
and returned state rather than matching these strings.

| Method/path | Input and purpose | HTTP success body |
| --- | --- | --- |
| GET `/accounts` | Accounts list queries; platform-wide account management | 200 `{ accounts: AdminAccount[], pagination }` |
| GET `/accounts/:userId` | Target User ID; account and Company-role inspection | 200 `{ account: AdminAccount }` |
| POST `/accounts/:userId/lock` | Target User ID; platform account restriction | 200 `{ message, user: User }` |
| POST `/accounts/:userId/terminate` | Target User ID; platform account termination | 200 `{ message, user: User }` |
| GET `/companies` | Company list queries; current profiles including NOT_SUBMITTED | 200 `{ companies: CompanyWithManager[], pagination }` |
| GET `/companies/:companyId` | Company ID; current Company and representative | 200 `{ company: Company, manager: ManagerSummary }` |
| POST `/companies/:companyId/lock` | Company ID; stop an active Company | 200 `{ message, company: Company, manager: User }` |
| GET `/companies/:companyId/recruiters` | Company ID in path, Recruiter list queries; inspect its Recruiters | 200 `{ recruiters: Recruiter[], pagination }` |
| GET `/company-registrations` | Company list queries; submitted review snapshots only | 200 `{ companyRegistrations: RegistrationSummary[], pagination }` |
| GET `/company-registrations/:companyId` | Company ID; submitted review source | 200 `{ companyRegistration: RegistrationDetail }` |
| POST `/company-registrations/:companyId/approve` | Company ID; approve pending submitted snapshot | 200 `{ message, companyRegistration: RegistrationDetail }` |
| POST `/company-registrations/:companyId/reject` | Company ID; reject pending submitted snapshot | 200 `{ message, companyRegistration: RegistrationDetail }` |
| POST `/categories/fields` | JSON `{ name }`; create immutable platform FIELD | 201 `{ message, category: Category }` |
| POST `/categories/fields/:fieldId/positions` | Parent FIELD ID and JSON `{ name }`; create immutable POSITION | 201 `{ message, category: Category }` |

### List query reference

All four lists accept `page`, `limit`, `q`, and `sort` using the common list
contract above. Omit blank filters/search instead of sending empty strings.

| List | Additional filters | `q` searches | Sort fields; default |
| --- | --- | --- | --- |
| `/accounts` | `actorType`, `userStatus`, `companyId` | User fullName/email | createdAt, updatedAt, fullName, email; `-createdAt` |
| `/companies` | `approvalStatus`, `operationalStatus` | Current Company name/businessRegistrationNumber | createdAt, updatedAt, name, submittedAt; `-createdAt` |
| `/company-registrations` | `approvalStatus`, `operationalStatus` | Snapshot name/businessRegistrationNumber | createdAt, updatedAt, name (snapshot), submittedAt; `-createdAt` |
| `/companies/:companyId/recruiters` | `membershipStatus`, `userStatus` | User fullName/email and membership employeeCode/jobTitle | createdAt, updatedAt (membership), fullName, email, employeeCode, jobTitle; `createdAt` |

Accepted enums:

- `actorType`: CANDIDATE, COMPANY_MANAGER, RECRUITER, PLATFORM_ADMIN.
- `userStatus`: PENDING_ACTIVATION, ACTIVE, LOCKED, TERMINATED.
- `membershipStatus`: ACTIVE, LOCKED, TERMINATED.
- `approvalStatus`: NOT_SUBMITTED, PENDING, APPROVED, REJECTED.
- `operationalStatus`: INACTIVE, ACTIVE, LOCKED.

For the Admin Recruiter list, Company comes exclusively from the URL:
**any query `companyId` returns 400**, including one equal to the path ID.
This differs from `GET /api/company/recruiters`, where Company Manager's
existing same-Company query guard is retained (same ID allowed; foreign ID 403).

Example: find Company Managers in one Company:

```http
GET /api/platform-admin/accounts?actorType=COMPANY_MANAGER&companyId=507f1f77bcf86cd799439011&userStatus=ACTIVE&page=1&limit=20&sort=fullName
Authorization: Bearer <accessToken>
```

Example: the five oldest pending registrations across the full dataset:

```http
GET /api/platform-admin/company-registrations?approvalStatus=PENDING&sort=submittedAt&page=1&limit=5
Authorization: Bearer <accessToken>
```

Each list returns `pagination: { page, limit, total, totalPages }`. Defaults
are page 1 / limit 20, maximum limit 100. Use `pagination.total` for the filtered
total, not the returned array length. Search/filter/sort apply to the full
dataset before pagination. Do not compute global counts, search results or
oldest-pending order from just one page. A page beyond the last page is 200
with an empty array; it is not a resource 404.

### Public DTO reference

Field sets below reflect the current serializers. No password/hash, action
token, refresh credential or session collection is returned.

| DTO | Fields |
| --- | --- |
| User | id, fullName, email, role, status, emailVerifiedAt, mustChangePassword, createdAt, updatedAt |
| Membership | id, companyId, role, status, employeeCode, jobTitle |
| AdminAccount | User fields plus actorType and membership (null for non-staff) |
| ManagerSummary | id, fullName, email, role, status |
| Recruiter | User fields plus membership |
| ReviewSnapshot | name, logoUrl, bannerUrl, website, address, description, descriptionHtml, contactInfo, businessRegistrationNumber |
| Company | id, managerUserId, all ReviewSnapshot profile fields as current values, approvalStatus, operationalStatus, reviewSnapshot, submittedAt, reviewedByUserId, reviewedAt, activatedAt, createdAt, updatedAt |
| CompanyWithManager | Company fields plus manager: ManagerSummary |
| RegistrationSummary | id (Company ID), approvalStatus, operationalStatus, submittedAt, companyName (snapshot name), businessRegistrationNumber (snapshot value), manager: ManagerSummary |
| RegistrationDetail | id (Company ID), approvalStatus, operationalStatus, submittedAt, reviewedByUserId, reviewedAt, activatedAt, manager: ManagerSummary, reviewSnapshot: ReviewSnapshot |
| Category | id, name, normalizedName, level, parentCategoryId (null for FIELD) |

Company Manager and Recruiter accounts both have `User.role=COMPANY_STAFF`.
Use `actorType` and `membership.role` from Accounts reads for the Company role;
there is no separate Admin Company Manager list/detail endpoint. The `user`
returned by lock/terminate is a User DTO without actorType/membership; reread
Accounts when the screen needs the complete account/membership projection.
Company.managerUserId is a derived response field, not a second ownership source.

`User.status` is platform account state. `membership.status` is Company-level
state. They are independent: a Recruiter can have ACTIVE membership and LOCKED
User, and still has no business access. Admin account lock/terminate does not
change membership state. Platform Admin does not gain Company membership or
Company Manager authority through these APIs.

A newly created Recruiter may have ACTIVE User and ACTIVE membership while
`mustChangePassword=true`; initial activation is still required for business
access. PENDING_ACTIVATION represents Company Manager onboarding, not Recruiter
activation readiness.

### Lifecycle and error handling

All endpoints share the centralized error shape:

```json
{
  "error": {
    "message": "Invalid companyId query",
    "details": { "field": "companyId" }
  }
}
```

`details` and its `field` are optional and depend on the failure. The example
is the unsupported Recruiter-list query, not a universal message/field. Handle
HTTP status and optional field errors; production does not return a stack.
`X-Request-Id` is available for correlating an HTTP failure with backend logs.

| Scope | Expected error outcomes and client handling |
| --- | --- |
| All 14 endpoints | 401 for missing/invalid/expired/revoked access; 403 for an authenticated non-admin or a non-ACTIVE account with an otherwise valid session. Unexpected infrastructure/persistence failures can return 5xx; surface a retry/error state. |
| Four dynamic lists | 400 for unsupported query, invalid filter/id/sort or malformed pagination/search. Correct input before retrying. |
| Accounts detail | 400 malformed userId; 404 absent account. |
| Companies detail / Recruiter list | 400 malformed path ID; 404 absent Company. An existing Company with no Recruiters returns 200 with an empty list. |
| Registration detail | 400 malformed companyId; 404 absent or unsubmitted registration. |
| Account lock/terminate | 400 malformed userId; 404 absent account; 403 self-target or any Platform Admin target; 409 unsupported source state or Company Manager lifecycle conflict. |
| Company lock | 400 malformed companyId; 404 absent Company; 409 unless Company is APPROVED + ACTIVE and its Manager is ACTIVE. |
| Approve/reject registration | 400 malformed companyId; 404 absent Company; 409 unless it is PENDING + INACTIVE with a submitted snapshot and a PENDING_ACTIVATION Manager. A conflicting/repeated decision returns 409; reread detail. |
| Approve email delivery | 503 can occur **after approval is committed**. Reread registration: it remains APPROVED + INACTIVE with confirmation capability. Do not assume rollback or blindly retry approve. |
| Create FIELD | 400 invalid/extra body fields; 409 duplicate normalized FIELD name. |
| Create POSITION | 400 invalid/extra body fields or malformed fieldId; 404 absent parent; 409 non-FIELD parent or duplicate normalized name within that FIELD. |

Account lock accepts ACTIVE → LOCKED. Repeating lock on LOCKED is the same-intent
reconciliation path. Terminate accepts ACTIVE/LOCKED → TERMINATED; repeating
terminate on TERMINATED reconciles remaining consequences. Successful account
commands revoke the target's sessions. Recruiter User eligibility loss also
triggers the existing automatic Application Unassign consequence; it does not
grant Admin assignment/pipeline authority or alter Job-team/membership state.
A failure during post-commit consequences may leave the account restricted;
reread Accounts and retry the same intended command for reconciliation.

For an ACTIVE Company Manager representing an active Company, use Company
lock: it atomically sets Company APPROVED + LOCKED, terminates the Manager and
revokes the Manager's sessions. Generic account commands return 409 when they
would break the canonical Company/Manager lifecycle. Company lock is terminal;
a repeated lock returns 409. Existing Company/data are retained.

Review always uses the submitted snapshot. Approve leaves Company
APPROVED + INACTIVE and Manager PENDING_ACTIVATION until the Manager confirms
the emailed link. Reject leaves REJECTED + INACTIVE and is terminal. The Admin
reject command takes no reason. Resend approval confirmation belongs to the
existing Company Manager onboarding flow, with its existing eligibility rules.

Current Company reads include NOT_SUBMITTED; registration reads never do.
For the existing registration stage tabs/counts, combine the following filters
and read each response's `pagination.total` (limit 1 is sufficient for counts):

| Display stage | approvalStatus | operationalStatus |
| --- | --- | --- |
| Chờ duyệt | PENDING | INACTIVE |
| Chờ Manager kích hoạt | APPROVED | INACTIVE |
| Đang hoạt động | APPROVED | ACTIVE |
| Đã từ chối | REJECTED | INACTIVE |
| Đã khóa | APPROVED | LOCKED |

Registration `q` does not search Manager name/email in this phase. Category
selection reuses public `GET /api/categories/fields` and
`GET /api/categories/fields/:fieldId/positions` (optional pagination as above).
Category names are canonicalized and normalized for uniqueness; FIELD is unique
platform-wide and POSITION within its FIELD. Created Categories are immutable.
This handoff adds no dashboard/summary, unlock/reactivation, rejection reason,
Category update/delete or Admin Job-operation endpoint.

## Changed files for this completion

Implementation:

- `backend/src/services/{auth,platform-admin,recruiter}.service.js`
- `backend/src/controllers/{auth,platform-admin,recruiter}.controller.js`
- `backend/src/routes/{auth,platform-admin,recruiter}.routes.js`
- `backend/src/controllers/{category,location,experience-level}.controller.js`
- `backend/src/middlewares/validate-change-password.js`
- `backend/src/middlewares/validate-update-recruiter.js`
- `backend/src/utils/list-query.js`

Tests:

- `backend/test/auth/v1-api-completion.test.js`
- `backend/test/auth/v2-v3-api-completion.test.js`
- `backend/test/auth/v3-acceptance.test.js` (PATCH expectation replaced; PUT retained)
- `backend/test/auth/v3-recruiter-password-reset.test.js` (Company Manager self-reset expectation aligned to V1 extension; pending Recruiter remains excluded)
- `backend/test/catalog/v4-optional-pagination.test.js`

Contracts and project state:

- Product specifications: `docs/product/backend/versions/{v01-account-authentication,v02-company-onboarding-platform-administration,v3-company-recruitment-staff-management,v4-platform-standard-catalogs}.md`
- Data contracts: `docs/data/backend/versions/{v01-authentication-data-model,v02-company-onboarding-platform-administration,v3-company-recruitment-staff-management-data-model,v4-platform-standard-catalogs-data-model}.md`
- `docs/engineering/source-of-truth.md` and this API contract.
- Affected V1–V4 status leaves and the common backend verification snapshot in `docs/project-status/backend/platform-and-operations.md`; the status index remains unchanged.
