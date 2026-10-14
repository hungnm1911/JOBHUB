# Backend V4 Platform Standard Catalogs Project Status

## Current project state

V4 Slices 01–05 are implemented and verified.

## Deferred / not started

- V4 approved business functions F01–F06 are complete; acceptance/regression closure is verified. No further V4 business slices remain in the approved specification. Deferred V4 items (Category list/read, Job/CV integration, dynamic catalog management) stay out of scope without a new approved specification.

## Previously completed and verified baseline

- **Implemented; verified:** V4 Slice 05 — V4 acceptance and regression closure (F01–F06; BR-01–BR-20): cross-cutting suite confirms FIELD→POSITION structure and schema immutability, Platform Admin-only Category creation (Candidate/Company Manager/Recruiter denied), absence of Category/ExperienceLevel mutation/list/CRUD surfaces beyond create endpoints, exact closed Location/EmploymentType/WorkMode vocabularies plus six-record ExperienceLevel dataset, no CompanyMember catalog role, and V1/V2/V3 identity surfaces unchanged; Data Contract authorization ownership is aligned to Engineering SoT middleware enforcement without changing business behavior. Coverage in `test/catalog/v4-acceptance.test.js` plus prior V4 slice suites.

- **Implemented; verified:** V4 Slice 04 — ExperienceLevel canonical dataset (F06; BR-01, BR-15, BR-16, BR-17, BR-20): persisted `experience_levels` documents expose only `_id` + immutable unique `code` from the locked six-member set; dataset initialization is owned by `src/database/migrations/v4-experience-level-dataset.js` through the existing `scripts/run-migration.js` runner (idempotent upsert; no seed/startup/API path); re-application does not create duplicates and verification requires exactly the six canonical records. Focused coverage in `test/catalog/v4-experience-level-dataset.test.js`.

- **Implemented; verified:** V4 Slice 03 — Category POSITION creation (F02; BR-01, BR-02, BR-04, BR-05, BR-06, BR-07, BR-08, BR-10, BR-18, BR-19, BR-20): valid Platform Admin creates immutable platform-scoped `Category` documents at `level=POSITION` under an existing `FIELD` via `POST /api/platform-admin/categories/fields/:fieldId/positions`; parent must exist and be `FIELD` (not another POSITION); uniqueness is scoped by `{ parentCategoryId, normalizedName }` so same names may exist under different FIELDs while same-FIELD duplicates including concurrent creates are rejected; parent FIELD is not mutated; authorization reuses `authorize-platform-admin` without service role re-checks. Focused coverage in `test/catalog/v4-category-position-creation.test.js`.

- **Implemented; verified:** V4 Slice 02 — Category FIELD creation (F01; BR-01, BR-02, BR-03, BR-05, BR-06, BR-07, BR-08, BR-09, BR-18, BR-19, BR-20): valid Platform Admin creates immutable platform-scoped `Category` documents at `level=FIELD` with `parentCategoryId=null` via `POST /api/platform-admin/categories/fields`; `normalizedName` is derived by the Category model (trim, collapse whitespace, case-fold) and compound unique `{ parentCategoryId, normalizedName }` rejects duplicates including concurrent creates; authorization reuses `authorize-platform-admin` without service role re-checks; no POSITION creation, list/read, edit/delete, or tenant ownership fields. Focused coverage in `test/catalog/v4-category-field-creation.test.js`.

- **Implemented; verified:** V4 Slice 01 — Fixed platform vocabularies (F03, F04, F05; BR-01, BR-11, BR-12, BR-13, BR-14, BR-17, BR-20): canonical non-persisted constant modules provide closed platform sets for `Location` (exactly 64 Data Contract members: 63 Vietnam province/city snapshot values plus `FOREIGN`; `REMOTE` excluded), `EmploymentType` (8 fixed values), and `WorkMode` (`ONSITE`, `HYBRID`, `REMOTE`); no collections, seeds, admin CRUD, or Job/CV integration. Focused coverage in `test/catalog/v4-fixed-vocabularies.test.js`.

- **Prepared; verified:** V4 implementation readiness — the approved Product/Data contract paths are established, the Product Location definition is aligned to the canonical fixed snapshot of 63 Vietnam province/city members plus `FOREIGN`, and roadmap/project state now mark V4 `READY FOR IMPLEMENTATION`. No V4 business behavior or persistence was introduced by the readiness step itself. Slice 01 requires only fixed non-persisted vocabularies, so the existing unit-test infrastructure and backend gate are sufficient; Category authorization ownership is deferred to Slice 02 and ExperienceLevel dataset initialization ownership is deferred to Slice 04.

## Verification status

- Focused automated tests cover `test/catalog/v4-fixed-vocabularies.test.js`, `test/catalog/v4-category-field-creation.test.js`, `test/catalog/v4-category-position-creation.test.js`, `test/catalog/v4-experience-level-dataset.test.js`, and `test/catalog/v4-acceptance.test.js`.
