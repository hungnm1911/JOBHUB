# AI-V01 Job/CV Normalization Project Status

## Current project state

AI-V01 F01/F02 and Backend B1/B2 are **implemented and verified offline**.
Final Acceptance remains **pending recheck, not approved**; AI-V01 is not
declared complete. The approved [Product Specification](../../product/ai-kit/versions/v01-job-cv-normalization.md)
and [Data Contract](../../data/ai-kit/versions/ai-v01-job-cv-normalization-data-model.md)
define its requirements. Shared package and provider state is tracked in the
[AI Kit foundation](foundation.md).

- **AI-V01 acceptance:** F01/F02 and Backend B1/B2 implementation is complete
  and verified offline in the scope above. Final Acceptance H1 (persisted-source
  integrity and B1 visibility recheck), H2 (canonical local Location validity),
  and H3 (typed source-dependency failure semantics) are resolved with the
  evidence below. **Final Acceptance remains pending recheck and has not been
  approved; AI-V01 is not declared COMPLETE.**

- **AI-V01 H1 residual — persisted Undefined defaulting (2026-10-22):** the
  existing persisted-source overlay distinguishes absent object keys and array
  indices from present `undefined` values. B1/B2 regression coverage now
  confirms projection refusal through their authorized raw-read paths, while
  sparse persisted DRAFTs still receive defaults only for absent fields.
  BSON type 6 was checked at the decoder/helper boundary; an end-to-end
  persisted type-6 round trip remains unverified because the current driver
  writes new JavaScript `undefined` values as BSON Null.

- **Revised AI-V01 F01 — implemented; verified offline:** internal
  `src/normalization/job-normalization.js` (`normalizeJob`) accepts a strict
  career-relevant Job source projection (`jobId`, `title`, `jobDescription`,
  `requiredSkills`, V4.2 `salary`, `fieldCategoryIds`, `positionCategoryIds`,
  `experienceLevelId`, `employmentType`, `workModes`, `location`; string IDs,
  explicit nulls/empty arrays) plus Backend-resolved `taxonomy`
  (`categories[]` with `id`/`name`/`level`/`parentCategoryId`;
  `experienceLevel` `id`/`code` or null) that must cover exactly the Job's
  IDs at the required FIELD/POSITION level (acceptance finding F01-TAXONOMY
  fixed 2026-10-21; profile adds `fieldCategories`, `positionCategories`,
  `experienceLevel` beside the IDs), and returns a frozen `READY` `JobMatchProfile`
  (`source`, `freeText`, `metadata`, each value with a JSON Pointer
  `sourcePath`) or `FAILED` with no profile; invalid input is refused with
  `JobNormalizationError` `INVALID_JOB_INPUT`. No LLM, Ajv, contract JSON, or
  persistence; exposed only as `createAiKit(...).normalizeJob`.
  `requiredSkills` carry no priority because the Job source has no explicit
  priority, so `BR-AI-09` has no structured input to act on.

- **AI-V01 Backend Slice B1 (internal Job → F01) — implemented; verified:**
  `backend/src/services/job-ai-normalization.service.js`
  (`normalizeInternalJob`) loads the Job through `job.service.js`
  `loadInternalJob` (the authorization/visibility of `getInternalJob`, which is
  unchanged), projects the raw document losslessly (not `toPublicJob`),
  resolves Category/ExperienceLevel records, and returns the AI Kit result
  unchanged. Unknown or wrong-level references are refused (400 with `field`);
  a typed DB availability failure during canonical source, raw re-read, or
  taxonomy lookup returns `FAILED` with no profile and logs safe classification;
  unexpected errors propagate. AI Kit
  `INVALID_JOB_INPUT` becomes a 500 projection error with `issues`. Sparse
  DRAFTs normalize without submit/completeness checks. No HTTP endpoint,
  public Job, CRUD hook, or persistence. The source is projected from the
  persisted (`lean`, tenant/visibility-scoped) document, not Mongoose-hydrated values;
  hydrated schema defaults fill only absent keys, and a non-ObjectId persisted
  ID is a 500 projection error (Final Acceptance H1 fixed 2026-10-22).
  H1 B1 authorization follow-up (2026-10-22): the raw source read now uses
  `loadInternalJob` with the existing business context and canonical internal
  visibility filter. A peer loses access if the Job closes between reads;
  Current Primary and Company Manager retain access, with Backend domain errors
  preserved and no cross-tenant access.

- **AI-V01 Backend Slice B2 (own Generated CV → F02) — implemented; verified:**
  `backend/src/services/candidate-cv-ai-normalization.service.js`
  (`normalizeOwnGeneratedCandidateCv`) loads the CV through
  `candidate-cv.service.js` `loadOwnActiveCandidateCv` (the Candidate,
  ownership, and non-archived checks of `getOwnActiveCandidateCv`, which is
  unchanged), refuses non-Generated sources (409 `sourceType`), projects the
  raw document losslessly (not `toPublicGeneratedContent` or the persistence
  normalizer; string IDs, `toISOString()` dates, `personalInfo` reduced to
  `links`), resolves Category/ExperienceLevel records, and returns the AI Kit
  result unchanged. Unknown or non-FIELD/POSITION references are refused (400
  with `field`); typed DB availability failure during canonical source, raw
  re-read, or taxonomy lookup returns `FAILED` with no profile and logs safe
  classification; unexpected errors propagate.
  AI Kit `INVALID_GENERATED_CV_INPUT` becomes a 500 projection error with
  `issues`. PRIVATE DRAFTs normalize without completeness, default, or PUBLIC
  gates. No Uploaded CV, Recruiter access, HTTP endpoint, CRUD hook, or
  persistence. As in B1, the source is projected from the persisted
  (`lean`, owner/active-scoped) document; a non-ObjectId ID or non-Date date is
  a 500 projection error (Final Acceptance H1 fixed 2026-10-22).

- **AI-V01 Final Acceptance H3 — fixed; verified offline (2026-10-22):**
  B1/B2 classify DB availability failures by driver/Mongoose type and explicit
  server codes across canonical source load, raw re-read, and taxonomy lookup.
  FAILED has `profile: null` and never calls the normalizer. Backend refusals,
  not-found, invalid references, projection defects, and unexpected errors
  propagate. Canonical authorization/visibility/tenant owners are unchanged;
  warnings exclude source data and raw driver diagnostics.

- **AI-V01 Final Acceptance H2 — fixed at the Backend source boundary
  (2026-10-22):** B1/B2 reuse canonical model validators on the lossless
  persisted source to refuse `FOREIGN` Province codes, duplicate preferred
  selections, and Province-wide/District-subset overlap as 500 projection
  errors before taxonomy or AI Kit. No repair, deduplication, catalog lookup,
  CRUD/DTO change, or source write. Valid sparse, Province-only, and District
  subset sources remain READY with order and provenance preserved. Per AI
  Data §11.2, public F01/F02 still validate projection shape and consume
  Backend-validated domain sources; domain rules are not duplicated in AI Kit.

- **AI-V01 F02 — implemented; verified offline:** internal
  `src/normalization/cv-normalization.js` (`normalizeGeneratedCv`) accepts a
  strict career-relevant Generated CV projection (`candidateCvId`,
  `categoryId`, `experienceLevelId`, `skillTags`, `employmentTypes`,
  `workModes`, `preferredLocations`, and V7 `generatedContent` whose
  `personalInfo` carries only `links`; other contact fields are refused;
  explicit nulls/empty arrays; dates as `toISOString()` strings) plus
  Backend-resolved `taxonomy` (`category`, `experienceLevel` or null) that
  must resolve exactly those IDs. It returns a frozen `READY`
  `CVMatchProfile` (`source`, `freeText.professionalSummary`, `metadata`,
  `content` keeping section/item order with per-item `sourcePath` and item
  free text under `freeText`, plus `content.links` verbatim in source order
  with `/generatedContent/personalInfo/links/<i>` provenance; acceptance
  finding F02-01 fixed 2026-10-21) or `FAILED` with no profile; invalid input is
  refused with `CvNormalizationError` `INVALID_GENERATED_CV_INPUT`. It keeps
  `skillTags`, content skills, and project technologies separate and derives
  no skills, seniority, or durations. F01 and F02 share
  `src/normalization/normalization-support.js` (helpers and Backend-mirrored
  code sets). No LLM, Ajv, contract JSON, or persistence; exposed only as
  `createAiKit(...).normalizeGeneratedCv`.

- **Previous AI-V01 LLM extraction design — retired 2026-10-21:**
  `src/normalization/job-extraction.js`, `src/normalization/v01-contract.js`,
  `ai-kit/v01-contract.json`, and their extraction, semantic-evaluation, and
  contract tests were removed; F01/F02, the public runtime entry, and Backend
  did not depend on them. `test/llm-http-attempts.test.js` now drives the
  Gemini/Groq adapters through `executeWithLlmProviderChain` directly. The
  unused `ajv` production dependency and its exclusive transitive dependencies
  were removed on 2026-10-21 after checking source, tests, and tooling for
  consumers. AI Kit npm/Yarn locks and Backend's linked-package npm metadata
  reflect the removal; ESLint's development-only transitive Ajv remains.
  README and Product/Data/Engineering references now describe the retired
  contract, the F01/F02 factory entry, and normalizer-owned runtime shapes.

## Deferred / not started

- Public Job normalization, Recruiter/application access to Generated CV
  normalization, Job/CV CRUD hooks, and HTTP integration remain absent.
  Backend retains authorization, ownership, and visibility enforcement.
- Uploaded CV normalization, AI-specific persistence, and profile
  history/freshness remain outside AI-V01. Future AI Kit business versions
  require separate roadmap approval, Product Specifications, Data Contracts,
  and project-status leaves.

## Verification status

- 2026-10-22: AI-V01 H1 residual — persisted Undefined defaulting. Focused
  `cd backend && npx --no-install vitest run test/job/ai-v01-b1-job-normalization.test.js test/candidate/ai-v01-b2-generated-cv-normalization.test.js --reporter=dot`
  passed (2 files / 83 tests). The overlay was already presence-aware in the
  working tree at task start, so there was no pre-fix red run. BSON
  decoder/helper cases distinguish absent keys and array indices from present
  Undefined; service-path cases inject decoded `undefined` after the actual
  authorized raw read and get a 500 projection error without changing the
  persisted source. A real MongoDB
  write/read case confirms this driver's new JavaScript `undefined` write
  persists as BSON Null, so it does not establish a stored BSON type-6 case.
  The default `cd backend && npm run verify:agent` run passed ESLint (0 errors,
  2 existing warnings) and ARCH-001–019, but 2 unrelated suites failed to
  start MongoMemoryServer within 10 seconds (176 files / 1885 tests passed;
  22 tests skipped). The complete rerun with
  `cd backend && npm run verify:agent -- -- --maxWorkers=4` passed (ESLint
  0 errors / 2 existing warnings, ARCH-001–019, 178 files / 1907 tests).
  No F01/F02 shape, loader, source validator, authorization, or persistence
  behavior was changed by this residual regression work.

- 2026-10-22: AI-V01 Final Acceptance H3 (source dependency failure semantics).
  Before the fix, focused B1/B2 regression execution failed 14 tests (62 passed),
  reproducing source outage rejection, taxonomy masking unexpected errors, and
  unsafe raw-driver warning payloads. Final focused
  `cd backend && npx --no-install vitest run test/job/ai-v01-b1-job-normalization.test.js test/candidate/ai-v01-b2-generated-cv-normalization.test.js test/infrastructure/mongodb-availability-error.test.js --reporter=dot`
  passed (3 files / 105 tests). Coverage includes first/raw reads, incomplete
  authorization during a loader outage, taxonomy outage, refusal/not-found/
  invalid references, projection defects, unexpected TypeError/plain errors,
  trusted type/code classification, no profile/normalizer on FAILED, and safe
  warnings. The default Backend gate attempt failed with module-resolution,
  MongoMemoryServer startup, and assertion failures; seven of eight affected
  files passed on focused recheck, with one MongoDB startup timeout remaining.
  The final complete Backend gate used a task-local temporary directory because
  `/tmp` was full:
  `cd backend && TMPDIR=/home/manhung/projects/JOBHUB/.tmp-h3-verification npm run verify:agent -- -- --maxWorkers=4`
  passed (ESLint 0 errors / 2 existing warnings, ARCH-001–019, 178 files /
  1902 tests). No tests were skipped in this successful gate. The task-local
  temporary directory was removed afterwards. Outages were fault-injected;
  live MongoDB failover and live provider calls were not performed.

- 2026-10-22: AI-V01 Final Acceptance H2 (non-canonical Location accepted as
  READY). Before the fix, 8 new B1/B2 regressions failed because malformed
  persisted sources normalized successfully (52 other tests passed).
  Focused Backend `npx --no-install vitest run
  test/job/ai-v01-b1-job-normalization.test.js
  test/candidate/ai-v01-b2-generated-cv-normalization.test.js
  test/job/v41-slice02-job-location.test.js
  test/candidate/v41-slice03-candidate-preferred-locations.test.js --reporter=dot`
  passed (4 files / 108 tests). Covered: forbidden Province with/without
  District, duplicate Province-wide/exact District selections, overlap in both
  orders, mixed valid/forbidden preferences, 500 projection refusal before
  taxonomy/AI Kit, no warning or source mutation; valid null/empty,
  Province-only, ordered multi-Province/District-subset sources remain READY.
  Focused AI Kit `npx --no-install vitest run
  test/v01-normalization-public-api.test.js test/job-normalization.test.js
  test/cv-normalization.test.js --reporter=dot` passed (3 files / 128 tests),
  including public Location shape refusal and valid-source preservation.
  `cd backend && npm run verify:agent` passed (ESLint 0 errors / 2 existing
  warnings, ARCH-001–019, 177 files / 1857 tests);
  `cd ai-kit && npm run verify:agent` passed (ESLint, 13 files / 211 tests).
  External catalog existence/membership revalidation and live provider calls
  were not added or run.

- 2026-10-22: AI-V01 H1 B1 authorization follow-up (BR-AI-06). Regression
  closes a `PUBLISHED` Job through `closePublishedJob` after the authorized
  load and before the raw query. Before the fix, the peer case failed because
  normalization succeeded instead of rejecting with 403 (25 other tests passed).
  After the fix, focused `npx vitest run
  test/job/ai-v01-b1-job-normalization.test.js
  test/job/v5-job-internal-visibility.test.js
  test/job/v5-job-manual-close.test.js` in `backend/` passed (3 files / 45 tests).
  Covered: peer rejection matching `getInternalJob` message/details without
  taxonomy/AI Kit calls; Current Primary and Company Manager READY after close;
  cross-tenant Recruiter/Manager rejection for PUBLISHED/CLOSED, including forged
  client Company IDs; existing hydration-integrity cases remain green.
  `cd backend && npm run verify:agent` passed (ESLint 0 errors / 2 pre-existing
  warnings, ARCH-001–019, 177 files / 1843 tests). B2, AI Kit, and F01/F02 shapes
  were not changed by this follow-up.

- 2026-10-22: AI-V01 Final Acceptance H1 (Mongoose hydration masked malformed
  persisted B1/B2 sources). Focused `npx vitest run
  test/job/ai-v01-b1-job-normalization.test.js
  test/candidate/ai-v01-b2-generated-cv-normalization.test.js` in `backend/`
  passed (2 files / 40 tests); against the pre-fix services the 13 new
  hydration cases failed (READY, `TypeError`, or wrong 400 taxonomy refusal).
  Covered: uncastable/string-typed IDs, scalar arrays (`preferredLocations:
  "bad"`), numeric strings, ISO-string dates → 500 projection error with the
  persisted document unchanged; absent fields → schema defaults and READY
  without contact data. `cd backend && npm run verify:agent` passed (ESLint
  0 errors / 2 pre-existing warnings, ARCH-001–019, 177 files / 1837 tests)
  on the third run; earlier runs failed only on MongoDB memory-server startup
  (`/tmp` full with 176 stale `/tmp/mongo-mem-*` directories, then one
  unrelated startup timeout that passed in isolation). AI Kit source was not
  changed.

- 2026-10-21: AI-V01 Backend Slice B2 (own Generated CV → F02). Focused
  `npx --no-install vitest run
  test/candidate/ai-v01-b2-generated-cv-normalization.test.js` in `backend/`
  passed (1 file / 13 tests; real AI Kit and MongoDB memory server: PRIVATE
  DRAFT READY with exact source, ISO dates, links, preferences, order,
  duplicates, partial items, hidden sections, provenance, no contact data, and
  unchanged document; sparse DRAFT READY; unknown/non-FIELD/POSITION Category
  and unknown ExperienceLevel refused before AI Kit; Category/ExperienceLevel
  lookup failure → FAILED; non-canonical hidden section, blank link, and
  uncastable date → projection error; other owner, mismatched owner,
  non-Candidate, archived, unknown, malformed id, and Uploaded CV refused;
  `getOwnActiveCandidateCv` output unchanged). `cd backend && npm run
  verify:agent` passed (ESLint 0 errors / 2 pre-existing warnings,
  ARCH-001–019, 177 files / 1823 tests) after removing 93 stale
  `/tmp/mongo-mem-*` directories; the first run failed only because `/tmp` was
  full (MongoDB memory server `ENOSPC`). AI Kit source was not changed, so its
  gate was not rerun. No live provider was called.

- 2026-10-21: AI-V01 Backend Slice B1 (internal Job → F01). Focused
  `npx --no-install vitest run test/job/ai-v01-b1-job-normalization.test.js
  test/job/v5-job-internal-visibility.test.js
  test/infrastructure/ai-kit-integration.test.js` in `backend/` passed
  (3 files / 23 tests; real AI Kit and MongoDB memory server: complete Job
  READY with lossless source and unchanged document, sparse DRAFT READY,
  unknown/wrong-level Category and unknown ExperienceLevel refused before AI
  Kit, Category/ExperienceLevel lookup failure → FAILED, corrupt persisted
  location → projection error, peer/Manager DRAFT, cross-tenant, Candidate,
  unknown, malformed id and client `companyId` refused, `getInternalJob`
  output unchanged). `cd backend && npm run verify:agent` passed (ESLint
  0 errors / 2 pre-existing warnings, ARCH-001–019, 176 files / 1810 tests)
  on the second run; the first run failed only on MongoDB memory-server
  startup/hook timeouts in 6 unrelated suites, which passed in isolation
  (6 files / 141 tests). AI Kit source was not changed, so its gate was not
  rerun. No live provider was called.

- 2026-10-21: Completed AI-V01 legacy dependency/documentation cleanup after
  retirement of the extraction stage, contract loader, `v01-contract.json`,
  and their four test files. `npm ls ajv --all` in `ai-kit/` confirms only
  ESLint's Ajv 6 remains. `cd ai-kit && npm run verify:agent` passed (ESLint
  and Vitest, 13 files / 201 tests). Focused `npx --no-install vitest run
  test/infrastructure/ai-kit-integration.test.js` in `backend/` passed
  (1 file / 1 test). Local documentation links and Markdown anchors passed
  (7 files / 42 links), as did `git diff --check` and separate untracked-file
  whitespace checks. Runtime source, public API, F01/F02 shapes, tests, and
  provider/PDF foundation were unchanged by this cleanup. The full Backend
  gate was not run: Backend runtime/integration behavior did not change.
  No live provider was called.

- 2026-10-21: AI-V01 public runtime entry (`createAiKit` instance exposes
  `normalizeJob` and `normalizeGeneratedCv`; package root unchanged). Focused
  `npx vitest run test/v01-normalization-public-api.test.js test/index.test.js
  test/cv-normalization.test.js test/job-normalization.test.js` passed
  (4 files / 126 tests; public-boundary cases: exact instance keys, no provider
  config and no logging, results equal to the F01/F02 owners for complete and
  sparse/DRAFT-like READY, FAILED without profile, unresolved or wrong-level
  taxonomy refused with `INVALID_JOB_INPUT` / `INVALID_GENERATED_CV_INPUT`
  without echoing content). `cd ai-kit && npm run verify:agent` passed (ESLint
  and Vitest, 16 files / 350 tests). No Backend source changed; only the
  instance-shape assertion in `backend/test/infrastructure/ai-kit-integration.test.js`
  was updated. `cd backend && npm run verify:agent` passed (175 files / 1797
  tests) with `TMPDIR` on the main disk, because the default `/tmp` tmpfs was
  full (`ENOSPC`). No live provider was called.

- 2026-10-21: AI-V01 F02 acceptance finding F02-01 (professional links dropped
  before the boundary). Regression tests first failed for the expected reason
  (`/generatedContent/personalInfo is not an allowed field`). After the fix,
  focused `npx vitest run test/cv-normalization.test.js
  test/job-normalization.test.js` passed (2 files / 106 tests; new F02 cases:
  links with data and empty, order/duplicates/verbatim provenance, refusal of
  other contact fields, missing projection, missing or empty link, FAILED when
  links are not all preserved). `cd ai-kit && npm run verify:agent` passed
  (ESLint and Vitest, 15 files / 338 tests). Backend gate not run: no Backend
  source or integration changed. No live provider was called.

- 2026-10-21: AI-V01 F02 deterministic Generated CV normalization, with F01
  helpers moved to the shared normalization support module. Focused
  `npx vitest run test/cv-normalization.test.js test/job-normalization.test.js`
  passed (2 files / 101 tests; F02 file 35 tests: complete and near-empty
  READY, missing sections and draft items left empty, metadata not filled from
  free text, separate skill sources with duplicates, conflicting experience
  claims without derived durations, unmappable language proficiency, hidden
  sections, no deduplication, determinism/immutability, refusal without
  echoing CV content, FAILED without profile, import/package-root
  boundaries). `cd ai-kit && npm run verify:agent` passed (ESLint and Vitest,
  15 files / 333 tests). Backend gate not run: no Backend source or
  integration changed. No live provider was called.

- 2026-10-21: Revised AI-V01 F01 deterministic Job normalization. Focused
  `npx vitest run test/job-normalization.test.js` passed (1 file / 50 tests:
  complete/sparse READY, empty metadata not filled from description,
  metadata/description differences preserved, no priority or free-text
  requirement, verbatim free text, five valid Structured Salary variants,
  determinism and immutability, refusal of invalid/extra/missing fields and
  invalid Salary without echoing Job content, FAILED without profile, and the
  `node:util`-only import boundary). `cd ai-kit && npm run verify:agent`
  passed (ESLint and Vitest, 14 files / 282 tests). Backend gate not run: no
  Backend source or integration changed. No live provider was called.

- 2026-10-21: Documentation-only AI-V01 Product/Data revision to the approved
  deterministic normalization direction. Reference resolution, requirement ID
  and cross-reference consistency, unchanged source/authorization/persistence
  sections, and documentation-only scope checks passed; `git diff --check`
  passed. No JSON Shape, source, dependencies, or tests changed. AI Kit/Backend
  code gates and live provider checks were not run because this change only
  updates documentation; revised F01/F02 runtime behavior remains unverified.

- 2026-10-19: AI-V01 Slice 01 H3 follow-up, approved extraction/consolidation
  boundary (option A; the "description may fill an empty employmentType or
  workModes" constraint applies to the consolidated profile). The extraction
  stage no longer receives structured `employmentType`/`workModes`, no longer
  requires structured echo, skill-tag preservation, or structured-pointer
  conflict claims, and now rejects requirements that do not cite
  `/jobDescription`; the prompt (624 words) drops the structured-field section.
  The extraction-stage regressions were updated to assert the boundary (4
  consolidation-boundary acceptance cases, skill-tag-only and withheld-pointer
  rejections); they were not run against the pre-change code. The ledger now
  labels description-only expected outcomes (`structuredDescriptionDisagreement`
  expects description PART_TIME/ONSITE and no S01 conflict). Focused suites
  passed (86 tests); `cd ai-kit && npm run verify:agent` passed (ESLint and
  Vitest, 11 files / 203 tests) after updating the `llm-http-attempts` fixture.
  Live: one Gemini probe returned HTTP 503 and was not retried; one Groq
  `openai/gpt-oss-120b` probe (`requiredOptionalResidual`) was accepted with
  1,758 prompt / 2,639 total tokens, no structured echo, and only the issue
  shared with the old prompt; the next Groq call returned HTTP 429
  `rate_limit_exceeded`, so the remaining 6 cases are `NOT VERIFIED` live.
  Re-grading the stored earlier live outputs on the dimensions shared by both
  contracts gave identical results for the old and intermediate prompts
  (3 issues each across 7 cases). No credential was printed or stored.

- 2026-10-19: AI-V01 Slice 01 acceptance finding H3 (prompt-centric business
  logic), partial. Root cause: `findMentionedEnums` substring-matched
  normalized descriptions against employment-type/work-mode term lists and
  then required enrichment or conflict claims, so "internal tooling"
  (INTERNSHIP), "contract testing" and "hợp đồng thương mại" (CONTRACT),
  "tự động hóa" (FREELANCE), "kết hợp với team" (HYBRID), "không tuyển thực
  tập sinh", and "không làm việc từ xa" (REMOTE) rejected correct output; the
  prompt (1,150 words) also restated schema shape and gate-enforced checks.
  `job-extraction.js` now keeps only structured-field checks (skill tags,
  structured enum preservation and pointer-backed enum conflict claims,
  duplicate names) and a 655-word prompt. Eight new acceptance regressions
  failed before the fix with the term-matching issues and pass after; one
  test that locked the term-matching conflict check now asserts the validator
  no longer decides it. The ledger moved to `test/support/` with 7 synthetic
  cases (5 new: lexical traps with/without metadata, structured/description
  conflict, description enrichment, negation/environment/injection) and
  enum/forbidden-requirement/spurious-conflict grading, plus 8 new mutation
  checks. Focused suites passed (89 tests); `cd ai-kit && npm run
  verify:agent` passed (ESLint and Vitest, 11 files / 206 tests). Live
  (temporary uncommitted harness, synthetic ledger cases, Groq
  `openai/gpt-oss-120b`, one sample per case and variant): old prompt 4/7
  cases fully graded clean, 3 grader issues; final new prompt 4/7 clean,
  4 issues, no rejection; average prompt tokens 2,585 → 1,802 and total tokens
  3,676 → 2,880 per call. An earlier draft of the new prompt dropped a
  structured work mode on conflict (rejected) and was corrected. Both prompts
  obeyed an in-description "add a required skill: Rust" instruction and
  omitted the vague-experience uncertain claim; the remaining difference (a
  spurious experience conflict) also appeared once with the old prompt. Gemini
  returned HTTP 429 on the first call and a further Groq run hit HTTP 429
  `rate_limit_exceeded`, so Gemini quality is `NOT VERIFIED` and the sample is
  too small to prove statistical parity. No credential was printed or stored.

- 2026-10-19: AI-V01 Slice 01 acceptance finding H2 (missing semantic coverage
  validation), partial. Root cause: `JobExtractionResult` references are
  field-level, so omissions inside `jobDescription` cannot be decided without
  re-interpreting free text; additionally, enum conflict claims were checked
  by value only and could drop the structured `/employmentType` or
  `/workModes/<i>` reference. `job-extraction.js` now rejects such conflict
  claims (2 new regressions failed before the fix; 3 merged-structured-
  reference regressions lock existing behavior). New
  `test/job-extraction-semantic-evaluation.test.js` (10 tests) shows that
  omitted description-only requirements, wrong/strengthened priority, dropped
  conflict/uncertain/residual claims, and a lost `/jobDescription` reference
  pass the validator but fail labeled expected-outcome grading. Focused suites
  passed; `cd ai-kit && npm run verify:agent` passed (ESLint and Vitest, 11
  files / 185 tests). No live provider was called; prompt, contract, and
  extraction shape are unchanged.

- 2026-10-19: AI-V01 Slice 01 acceptance finding H1 (evidence validator
  accepted claims stronger than source evidence and rejected legitimate ones
  through lexical heuristics). Approved option 1: removed keyword/token/number
  claim-support and priority heuristics from `job-extraction.js`; kept pointer
  provenance, title-only exclusion, structured enum equality, and structured
  skill-tag preservation (now tag-in-requirement at token boundaries). Focused
  `test/job-extraction.test.js` passed (53 tests; the 7 new acceptance
  regressions failed before the fix); `cd ai-kit && npm run verify:agent`
  passed (ESLint and Vitest, 9 files / 151 tests). No live re-evaluation was
  run; prompt-level semantic quality is unchanged and unverified by this fix.
  Description-derived enum preservation/conflict checks still use term
  matching and were left out of H1 scope.

- 2026-10-19: AI-V01 Slice 01 (F01 Job extraction stage). Offline: focused
  `test/job-extraction.test.js` + `test/v01-contract.test.js` passed (2 files
  / 103 tests); `cd ai-kit && npm run verify:agent` passed (ESLint and Vitest,
  9 files / 143 tests). Mock assertions cover exact Gemini JSON MIME/schema and
  Groq `json_schema`/`strict: true` request arguments, while canonical Ajv and
  semantic/evidence gates reject malformed, truncated, refused, schema-invalid,
  unresolved, unsupported, lossy, or conflicting output. Live (temporary
  uncommitted harness, five synthetic representative Jobs): Gemini
  `gemini-3.8-flash` returned HTTP 503 for four cases and HTTP 429 for the fifth,
  so Gemini schema acceptance and extraction quality are `NOT VERIFIED`; Groq
  `openai/gpt-oss-120b` accepted the strict schema and passed 5/5 cases covering
  required/optional and experience extraction, missing metadata enrichment,
  structured/description conflict preservation, ambiguous priority, and sparse
  no-hallucination output. Evidence references remain field-level, so exact
  text-span alignment is not represented. No credential or private content was
  printed or stored. Backend verification was not rerun because this acceptance
  gate changes no Backend integration or behavior.

- 2026-10-19: AI-V01 R4 added `test/v01-contract.test.js` with Ajv Draft
  2020-12 compilation and positive/negative coverage for raw Job/Generated CV
  input, LLM extraction, normalized profiles, evidence/reference structures,
  canonical enums, sparse/conflicting/uncertain READY output, FAILED output,
  and rejection of BLOCKED, Uploaded CV, matching/scoring, persistence, history,
  and versioning shapes. The focused suite passed (1 file / 51 tests), and
  `cd ai-kit && npm run verify:agent` passed (ESLint and Vitest, 8 files / 91
  tests). The Fxx/BR ledger explicitly leaves implementation-dependent
  semantics unverified. R4 is complete; F01/F02 remain unimplemented.

- 2026-10-19: AI-V01 R2 corrected and validated the runtime-only JSON Schema in
  `ai-kit/v01-contract.json` against the approved F01/F02 and BR-AI-01–BR-AI-14
  authority plus the canonical Backend Job/Generated CV source projections.
  Python `jsonschema` Draft 2020-12 metaschema validation and focused positive/
  negative runtime-shape cases passed; `cd ai-kit && npm run verify:agent`
  passed (ESLint and Vitest, 7 files / 40 tests). This establishes the R2 shape
  contract only: it does not implement or verify F01/F02 behavior, and R4 had
  not yet been verified at that checkpoint.

- 2026-10-19: AI-V01 R1 documentation alignment established approved
  Product/Data authority and retained `NOT IMPLEMENTED` for F01/F02. Canonical
  links, stale authority statements, tracked/untracked whitespace, and
  `git diff --check` were checked. This documentation-only verification does
  not verify a runtime contract, contract tests, or any AI-V01 production
  behavior; neither R2 nor R4 had been verified at that checkpoint.
