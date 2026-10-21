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
