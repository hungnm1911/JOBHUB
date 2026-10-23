# AI-V02 Uploaded CV Normalization Project Status

## Current project state

AI-V02 Final Acceptance is **`ACCEPTED`** (2026-10-23). Slice 1
(uploaded PDF Buffer → free text),
Slice 2 (Uploaded CV output contract and composition), Slice 3 (one-pass
LLM semantic extraction), Slice 3.1 (Codex primary provider integration),
and Slice 3.2 (remaining Gemini/Groq offline provider verification and
Engineering Contract cleanup), plus Slice 4a (Backend Uploaded CandidateCV
`cvSource` projection), Slice 4b (current Uploaded PDF Buffer supply), and
Slice 4c (internal Backend runtime invocation), all part of F01, are
**implemented and verified offline**. Slice 4c binds the existing projection
and current PDF read to one file identity and calls the shared AI Kit instance.
No HTTP or downstream AI capability consumer is wired.
The F01 Codex live smoke harness is prepared and focused-tested
offline. The F01 Codex debug smoke path is instrumented and verified offline.
The E1 evidence gate change passed one Codex/CCPro live retest with full local
output inspection; 21 lexical excerpt mismatches remained diagnostic only.
The internal F01 runtime path is implemented; a downstream consumer remains
deferred to a future approved consuming capability. The
approved §16.2 three-PDF BR-AI-22 [manual Evaluation Contract](../../evaluation/ai-kit/ai-v02-br-ai-22-evaluation-contract.md)
has a completed baseline: [Smoke #3](../../evaluation/ai-kit/ai-v02-br-ai-22-smoke-3.md)
plus two synthetic text-native PDFs with an [independent expected ledger](../../evaluation/ai-kit/ai-v02-br-ai-22-expected-ledger.md)
and one live call each. The [evaluation report](../../evaluation/ai-kit/ai-v02-br-ai-22-evaluation-report.md)
records baseline review `FAIL` for Smoke #3's test-score detail, `PASS` for
the standard CV, and `LIMITATION` for the sparse two-column CV; all three had
runtime `READY`. A targeted general prompt improvement then passed offline
verification and **one** Smoke #3 live retest: the score is now in
`otherCareerClaims.value` with evidence, without an inferred certification or
proficiency; runtime remained `READY`. The authorized final new-prompt live
regression then used exactly one request per synthetic PDF: standard remained
`READY`/quality `PASS` with all 15 ledger units and no extraction change;
sparse remained `READY` but quality regressed to `FAIL` because an unnamed
practice became a work role and content from two columns was incorrectly
associated. The evaluation report records full local evidence references and
the Smoke #3 artifact gaps. The Product Owner reviewed the impact and accepted
the recorded known semantic and evidence limitations under the aligned
BR-AI-17/§16.2/§20 contract. Sparse evaluation remains quality `FAIL` despite
runtime `READY`; the unsupported work role is a documented LLM semantic
finding, not a deterministic-composition defect or an automatic runtime gate.
System-owned correctness gates and the BR-AI-22 benchmark have evidence in the
[Final Acceptance checklist](../../evaluation/ai-kit/ai-v02-br-ai-22-evaluation-report.md).
A typed test-score field is only an optional future decision. The approved
[Product Specification](../../product/ai-kit/versions/v02-uploaded-cv-normalization.md)
and [Data Contract](../../data/ai-kit/versions/ai-v02-uploaded-cv-normalization-data-model.md)
define its requirements. Shared package and document-extraction state is
tracked in the [AI Kit foundation](foundation.md).

- **Slice 1 — PDF Buffer text extraction (2026-10-22):**
  `extractPdfTextFromBuffer` in `ai-kit/src/document/pdf-text-extractor.js`
  extracts the existing text layer of a Backend-supplied PDF Buffer in page
  order without altering the caller's bytes, and reports invalid input,
  unreadable PDFs, and PDFs without a text layer as coded
  `PdfTextExtractionError` failures rather than empty successful text
  (BR-AI-16 extraction input, BR-AI-20, BR-AI-21). Runtime-only: no provider
  call, OCR, persistence, cache, package-root export, or Backend integration.
  The existing path-based `extractPdfText` is unchanged. Boundary contract:
  [AI Kit conventions — Document extraction](../../engineering/ai-kit-conventions.md#document-extraction).
- **Slice 2 — Uploaded CV output contract (2026-10-22):**
  `ai-kit/src/normalization/uploaded-cv-normalization.js` defines the strict
  PDF-interpretation schema (`UPLOADED_CV_PDF_EXTRACTION_SCHEMA`), validates
  provider output text against it with evidence-structure checks, and
  `composeUploadedCvProfile` combines it deterministically with Backend
  CandidateCV metadata into an `UPLOADED_CV` `CVMatchProfile` (separate
  `metadata`/`pdfContent` provenance, sparse READY, invalid output FAILED;
  BR-AI-15–BR-AI-20, BR-AI-22, D1–D4). The CandidateCV metadata group moved
  to `normalization-support.js` and is shared unchanged with the V01
  Generated variant. The H1 canonical compatibility finding is addressed by
  `readCvCareerContent`: one consumer read contract aligns career groups and
  item fields while retaining each variant's source values and provenance.
  No provider call, prompt, persistence, cache, package-root export, or
  Backend integration. Contract:
  [AI Kit conventions — Structured output](../../engineering/ai-kit-conventions.md#structured-output).
- **F01 E1 — evidence validation (2026-10-22):** a nonmatching excerpt no
  longer fails a schema-valid PDF interpretation. The owner still rejects
  missing evidence and empty items, and `--debug` reports lexical mismatches
  by path and count without claiming the evidence was verified. Offline
  regression tests cover the original failure and sparse READY. No live
  provider call was made for this change.
- **Slice 3 — LLM semantic extraction (2026-10-22):**
  `normalizeUploadedCv` extracts text from an uploaded PDF Buffer, invokes
  exactly one selected Gemini or Groq adapter with the Slice 2 schema in its
  native structured-output mode, and delegates validation/composition to
  `composeUploadedCvProfile`. The prompt contains PDF text only and instructs
  explicit claims, verbatim evidence, missing values, and preservation of
  conflicts. Invalid output returns FAILED; provider and PDF failures
  propagate. The M1 continuation finding is fixed: Gemini SDK automatic
  continuation is disabled at the adapter request boundary, and an unfinished
  continuation response returns FAILED. The H2 provider-response finding is
  fixed: only a completed Gemini `STOP` candidate or Groq `stop` choice without
  refusal reaches output validation; incomplete, truncated, blocked, refused,
  or missing completion states return FAILED even with schema-valid JSON. The
  M2 response-structure finding is fixed: Gemini requires one text-only part
  from the first model candidate; Groq requires assistant text without tool
  calls or other message content in the first choice. Malformed or mixed
  responses return FAILED without a profile. No retry, automatic fallback,
  JSON Object Mode downgrade, Backend integration,
  persistence, or cache.
- **Slice 3.1 — Codex primary provider integration (2026-10-22):**
  `normalizeUploadedCv` defaults to Codex through the existing Responses API
  adapter, sending the Slice 2 schema in native strict JSON Schema mode. The
  orchestration accepts only a completed response with null
  `incomplete_details` and `error`, one completed assistant text message, and
  no refusal or tool output before shared validation and composition.
  Gemini and Groq remain explicit selections. There is no automatic retry,
  continuation, fallback, persistence, or Backend integration.
- **Slice 3.2 — remaining offline verification (2026-10-22):**
  SDK HTTP fixtures for Gemini and Groq now cover long extracted text passed
  intact into the request, first-candidate/first-choice handling, reported
  output truncation or continuation with schema-valid text, and context/rate
  provider errors without retry. The AI Kit Engineering Conventions entry now
  reflects approved V01/V02 authority, runtime entries, and source layout.
  No production behavior, Backend integration, persistence, or cache changed.
- **F01 Codex smoke harness preparation (2026-10-22):**
  `smoke:uploaded-cv:codex -- --pdf <path>` performs a provider-free preflight
  by default using a real PDF and synthetic contract-valid source. Explicit
  `--live` delegates once through `createAiKit(...).normalizeUploadedCv` with
  Backend-owned Codex configuration. Output is limited to request metadata,
  completion/result status, normalized usage, duration, and redacted aggregate
  claim/evidence counts. No live provider call was made.
- **F01 D1 live-smoke diagnostics (2026-10-22):** explicit `--debug` on the
  same CLI emits a correlation ID and safe PASS/FAIL/SKIPPED records for PDF
  read/extraction, request and HTTP SDK, Responses completion, JSON/schema/
  evidence validation, and composition. Offline HTTP mocks verify the SDK
  obtains HTTP status without a second request. No live provider call was
  made for this change.
- **F01 final live smoke #3 (2026-10-22):** explicit `--live --debug
  --full-output` wrote complete extraction/profile JSON and safe diagnostics
  under ignored local `ai-kit/.smoke-output/`. One call with the previous PDF
  and synthetic smoke metadata returned HTTP 200, completed Responses output,
  and READY after JSON, schema, evidence-structure, and composition gates.
  The profile retained separate PDF and synthetic-metadata provenance. This
  accepts the Codex provider/output path for this smoke, not Backend ownership
  or BR-AI-22 representative-case quality.
- **F01 Slice 4b — current Uploaded PDF Buffer (2026-10-23):**
  `readOwnCurrentUploadedCandidateCvPdfBuffer` in the CandidateCV service
  checks Candidate ownership, active-library membership, Uploaded/ACTIVE
  source and current file metadata before authenticated storage access. It
  validates downloaded PDF bytes against the stored file metadata and returns
  only a Buffer. Invalid source and storage/PDF read failures remain distinct.
  No persistence, cache, AI Kit call, HTTP endpoint, or new consumer authority.

## Deferred / not started

- The reported Codex/CCPro live smoke #2 returned `completed` with JSON and
  schema checks passing, then failed on 24 excerpt mismatches. Smoke #3 passed
  after E1; 21 lexical mismatches remain review diagnostics. One PDF does not
  establish semantic quality across representative cases. Gemini's
  provider-native JSON Schema mode has no separate `strict: true` parameter;
  offline tests verify the SDK request configuration, not server enforcement.
- Gemini/Groq actual context and output limits, provider-side truncation
  behavior, strict-schema acceptance, and long-PDF semantic completeness
  remain unverified against live providers. Offline fixtures verify only the
  installed SDK's serialization and handling of reported completion states.
- A downstream AI capability consumer remains deferred. Slice 4c supplies an
  internal own-Candidate runtime entry without approving another actor, HTTP
  endpoint, or background trigger.
- Known limitations after the completed BR-AI-22 three-PDF baseline, one
  targeted Smoke #3 retest, and two authorized synthetic new-prompt regression
  calls: Smoke #3's score omission and test-result classification were
  corrected in its one retest, but its exact historical request/raw response
  artifacts were not saved and repeatability is
  unverified. The standard synthetic case remains quality `PASS`; the sparse
  case has a verified unsupported work-role classification and wrong
  cross-column association, so final quality review is `FAIL` despite runtime
  `READY`. The Smoke #3 ambiguous quantity merge, standard project-type-in-role
  labels, sparse team metric placement, and PDF.js two-column reading order
  remain. Smoke-only sources do not verify Backend ownership/authorization or
  an actual downstream consumer. Image-only, invalid-output and
  invalid/unauthorized-resource branches rely on offline evidence rather than
  these successful PDF cases. No runtime quality gate was added.
- OCR is out of scope for AI-V02.

## Verification status

- **2026-10-23 — Final Acceptance closure:** Product Owner accepted the known
  semantic/evidence limitations in the [three-PDF report](../../evaluation/ai-kit/ai-v02-br-ai-22-evaluation-report.md),
  without changing the sparse quality `FAIL`. The aligned Product/Data
  Contracts distinguish mandatory system-owned correctness from LLM semantic
  quality review. Existing Slice 1–4c offline verification and live PDF
  evaluation were reviewed; no new runtime run was made. Final Acceptance is
  `ACCEPTED`. Live Backend E2E and downstream consumer behavior remain
  unverified; the Product Spec does not make a separate live Backend E2E run a
  §16.2 acceptance gate, and Slice 4d remains deferred pending an approved
  consuming capability. A `python3` check passed 65 local Markdown link
  targets and trailing whitespace across eight relevant documents; authority
  and status assertions passed, and `git diff --check` passed. No code gate was
  rerun for this documentation-only alignment.

- **2026-10-23 — BR-AI-22 final new-prompt live regression:** two provider-free
  preflights passed (1,226/933 PDF.js characters). Exactly two live
  Codex/CCPro requests were made, one per existing synthetic PDF, with no
  retry. Both returned HTTP 200, Responses `completed`, JSON/schema/evidence
  structure/composition PASS, runtime `READY`; captured fetch counts are one
  each. Local ignored manifests and artifacts preserve fixture hashes,
  `cvSource`, exact PDF.js input/request body, raw HTTP response, extraction,
  profile and diagnostics. Integrity checks confirmed request input equals
  saved PDF.js text, raw assistant output parses to saved extraction, profile
  PDF content equals extraction, and the career read view preserves all items
  and evidence. Manual ledger review: standard 15/15 factual units, quality
  `PASS`, old/new extraction deep-equal; sparse 12/12 units present but an
  unsupported role and wrong cross-column association, quality `FAIL`. Ten
  sparse lexical warnings are diagnostic. Smoke #3 historical exact request,
  original PDF.js input and raw response are missing; no provider replay.
  [Final report](../../evaluation/ai-kit/ai-v02-br-ai-22-evaluation-report.md).
  Documentation/artifact checks only; no source change in this evaluation,
  no repeat of the offline code gate, and no Backend/Frontend gate.

- **2026-10-23 — BR-AI-22 targeted prompt and Smoke #3 retest:** focused
  `npx vitest run test/uploaded-cv-semantic-extraction.test.js test/uploaded-cv-normalization.test.js test/uploaded-cv-codex-http.test.js`
  passed (3 files, 91 tests); `cd ai-kit && npm run verify:agent`
  passed (lint; 21 files, 369 tests). Smoke #3 provider-free preflight
  passed (same PDF hash and 2,513 text characters). Exactly one live
  Codex/CCPro SDK request returned HTTP 200, completed structured output,
  schema/evidence/composition PASS and runtime `READY` (1,832 input,
  1,638 output tokens). `otherCareerClaims.value` and the career read view
  now carry `TOEIC: 600`; no certification or proficiency was inferred.
  The 21 lexical warnings remain diagnostic; two ambiguous quantity
  occurrences were merged in `unresolvedContent`. Full ignored local
  artifacts: `ai-kit/.smoke-output/run-5OpAD7/`. [Report](../../evaluation/ai-kit/ai-v02-br-ai-22-evaluation-report.md)
  separates this retest from the old-prompt two-synthetic baseline. No
  Backend/Frontend change or gate, and no other live provider call.

- **2026-10-23 — BR-AI-22 approved three-PDF baseline:** Product Spec §16.2
  aligned; two synthetic PDFs rendered and read through PDF.js (1,226/933
  characters), hashes and independent ledger checked before LLM output. Two
  Codex/CCPro live calls, one per new PDF, each made one SDK request and
  returned HTTP 200, completed structured output and runtime `READY` with
  unchanged prompt/configuration. Full artifacts remain ignored local.
  `cd ai-kit && npm run verify:agent` passed (lint; 21 files, 369 tests);
  fixture hashes, Python syntax, relative Markdown links, and whitespace
  checks passed. No Backend or Frontend change/gate, no extra provider call.
  Review findings and Final Acceptance decisions are in the
  [report](../../evaluation/ai-kit/ai-v02-br-ai-22-evaluation-report.md).

- **2026-10-23 — BR-AI-22 Evaluation Contract alignment:** separated system
  correctness, prompt/extraction quality and downstream UX tolerance; prepared
  an independent ordinary CV case and a sparse/layout/atypical case alongside
  Smoke #3. Documented the current-schema TOEIC option, a proposed prompt
  change awaiting live evidence, the §16.2 Product Spec change proposal and a
  two-call minimum for the next live evaluation. Documentation references and
  whitespace checks were run; no provider call or code gate was run. Final
  Acceptance remains open.

- **2026-10-23 — BR-AI-22 evaluation, step 1:** inspected the original two-page
  PDF visually, reproduced the 2,513-character PDF.js text extraction without
  a provider call, and compared the saved full LLM extraction, profile and
  diagnostics. The [redacted report](../../evaluation/ai-kit/ai-v02-br-ai-22-smoke-3.md)
  records findings and remaining acceptance coverage. Documentation reference
  and whitespace checks passed; no code gate or live provider call was run.

- **2026-10-23 — F01 Slice 4c:** focused Backend 4a/4b/4c and B2 regression
  tests passed (4 files, 71 tests). Two further 4c cases were covered by the
  complete `cd backend && npm run verify:agent` gate, which passed (lint with two existing
  warnings; architecture ARCH-001–019; 185 files, 1,972 tests). The 4c offline
  tests mock storage and AI Kit's provider entry; no live provider or Cloudinary
  request was made. No AI Kit source changed, so its gate was not rerun.

- **2026-10-23 — F01 Slice 4b:** focused Backend Buffer read, Slice 4a, and
  V7 restricted-storage regression tests passed (3 files, 29 tests).
  `cd backend && npm run verify:agent` passed (lint with two existing warnings;
  architecture ARCH-001–019; 184 files, 1,964 tests). No live Cloudinary,
  provider, or AI Kit integration was exercised.

- **2026-10-23 — F01 Slice 4a:** focused Backend Uploaded projection and B2
  regression tests passed (2 files, 54 tests). `cd backend && npm run
  verify:agent` passed (lint with two existing warnings; architecture
  ARCH-001–019; 183 files, 1,953 tests). No PDF, AI Kit/provider call,
  persistence/cache, endpoint, or consumer authorization was added.

- **2026-10-22 — F01 final live smoke #3:** focused AI Kit full-output and
  diagnostics tests passed (3 files, 20 tests); focused Backend launcher tests
  passed (6 tests). `cd ai-kit && npm run verify:agent` passed (lint; 21 files,
  369 tests); `git diff --check` passed. Provider-free preflight with the same
  PDF passed. Exactly one live `normalizeUploadedCv` request returned HTTP 200,
  Responses `completed`, READY in 41,898 ms, with 1,779 input and 1,779 output
  tokens. Full extraction/profile and diagnostic summary were inspected in
  ignored local files; all acceptance gates passed, with 21 nonblocking E1
  lexical mismatch warnings. Backend full gate was not run by request; no
  Backend runtime integration changed.

- **2026-10-22 — F01 E1:** focused AI Kit tests passed (5 files, 108 tests);
  focused Backend smoke launcher tests passed (6 tests). `cd ai-kit && npm run
  verify:agent` passed (lint; 20 files, 366 tests). `cd backend && npm run
  verify:agent` passed (lint with two existing warnings; architecture
  ARCH-001–019; 182 files, 1,939 tests). No live provider call was made.

- **2026-10-22 — F01 D1 diagnostics:** focused AI Kit debug/normalization tests
  passed (4 files, 100 tests), followed by the 12-case debug regression file;
  focused Backend launcher tests passed (6 tests).
  `cd ai-kit && npm run verify:agent` passed (lint; 20 files, 363 tests).
  `cd backend && npm run verify:agent` passed on one full rerun (lint with two
  existing warnings; architecture ARCH-001–019; 182 files, 1,938 tests).
  The first full run failed during MongoDB memory-server shutdown; a later
  full run after adding the CLI HTTP regression failed on a port collision
  and MongoDB cleanup in unrelated V11/V15 tests. Those two files then passed
  in isolation (31 tests); the final focused launcher file passed (6 tests).
  The one-request SDK HTTP mock and redaction regressions passed; no live
  provider call was made.

- **2026-10-22 — F01 Codex smoke harness preparation:** dry-run with the
  existing `ai-kit/fixture/` PDF passed without a provider call. Focused
  AI Kit harness tests passed (4 tests); focused Backend launcher and
  integration tests passed (4 tests). `cd ai-kit && npm run verify:agent`
  passed (lint; 19 files, 351 tests); `git diff --check` passed. Backend lint
  and architecture checks passed. The first Backend full-test run failed when
  `/tmp` filled and MongoDB memory-server could not start; a workspace-temp
  rerun was interrupted before completion. Backend full verification and live
  provider acceptance remain pending.

- **2026-10-22 — Slice 3.2:** focused
  `npx vitest run test/uploaded-cv-provider-http.test.js` passed (1 file,
  15 tests); `cd ai-kit && npm run verify:agent` passed (lint; 18 files,
  346 tests); `git diff --check` passed. No live provider or Backend gate ran;
  Backend behavior was unchanged.

- **2026-10-22 — Slice 3 M2 response-structure fix:** focused regressions
  first failed on malformed Gemini/Groq envelopes and unexpected Groq roles
  or content. `npx vitest run test/uploaded-cv-provider-http.test.js test/uploaded-cv-semantic-extraction.test.js`
  passed (2 files, 58 tests); `cd ai-kit && npm run verify:agent` passed
  (lint; 18 files, 335 tests). Offline HTTP fixtures exercised the installed
  Gemini and Groq SDK response shapes. No live provider or Backend gate ran;
  Backend behavior was unchanged.

- **2026-10-22 — Slice 3.1:** focused
  `npx vitest run test/uploaded-cv-codex-http.test.js test/uploaded-cv-semantic-extraction.test.js test/codex-client.test.js`
  passed (3 files, 39 tests); `cd ai-kit && npm run verify:agent` passed
  (lint; 17 files, 312 tests). Offline tests cover Codex strict request
  serialization, one HTTP request for READY, 429 and incomplete responses,
  refusal, error, malformed output, and explicit Gemini/Groq regression.
  No live provider call or Backend gate was run; Backend behavior was unchanged.

- **2026-10-22 — Slice 3 H2 provider completion fix:** focused offline
  regression tests first failed in 12 cases because schema-valid JSON from
  incomplete, blocked, missing, or refused provider states returned READY.
  After the boundary fix,
  `npx vitest run test/uploaded-cv-semantic-extraction.test.js` passed
  (21 tests); `cd ai-kit && npm run verify:agent` passed (lint; 16 files,
  295 tests). No live provider or Backend verification was run; Backend code
  and integration were unchanged.

- **2026-10-22 — Slice 3 M1 Gemini continuation fix:** a real SDK with an
  offline network mock reproduced an extra HTTP request before the fix;
  V02 also returned READY for a mocked unfinished response. Focused
  `npx vitest run test/gemini-client.test.js test/llm-http-attempts.test.js test/uploaded-cv-semantic-extraction.test.js`
  passed (3 files, 32 tests); `cd ai-kit && npm run verify:agent` passed
  (lint; 16 files, 283 tests). The network mock now observes one Gemini HTTP
  request even when continuation is requested. No live provider or Backend
  verification was run; Backend code and integration were unchanged.

- **2026-10-22 — Slice 3:** `cd ai-kit && npm run verify:agent` passed
  (lint; 16 files, 280 tests). Focused offline tests cover Gemini and Groq
  strict request configuration, prompt and PDF-only context, successful
  composition including conflicting claims and sparse READY, invalid output,
  provider failures, and pre-request failures. No live provider call was run;
  no Backend gate was run because Backend code and integration were unchanged.

- **2026-10-22 — Slice 2 H1 compatibility fix:** the new consumer contract
  test first failed because the shared reader was absent, then passed with
  source-specific provenance, all structured item groups, conflicting PDF
  claims, and unresolved content covered. Focused
  `npx vitest run test/cv-match-profile-career.test.js test/uploaded-cv-normalization.test.js test/cv-normalization.test.js`
  passed (3 files, 73 tests); `cd ai-kit && npm run verify:agent` passed
  (lint; 15 files, 273 tests). No provider or live smoke was run. Backend gate
  not run: no Backend change.

- **2026-10-22 — Slice 2:** focused
  `npx vitest run test/uploaded-cv-normalization.test.js` passed (31 tests);
  V01 `test/cv-normalization.test.js` and
  `test/v01-normalization-public-api.test.js` passed (62 tests) after the
  metadata helper move; `cd ai-kit && npm run verify:agent` passed (lint;
  14 files, 270 tests). No provider or live smoke was run. Backend gate not
  run: no Backend change.

- **2026-10-22 — Slice 1:** focused
  `npx vitest run test/pdf-text-extractor.test.js test/pdf-text-extractor-lifecycle.test.js`
  passed (2 files, 33 tests) using offline fixtures (text-native,
  multi-page, image-only, invalid bytes) and mocked PDF.js lifecycle cases;
  `cd ai-kit && npm run verify:agent` passed (lint; 13 files, 239 tests).
  No provider or live smoke was run. Backend gate not run: no Backend change.
