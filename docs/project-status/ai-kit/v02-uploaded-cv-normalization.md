# AI-V02 Uploaded CV Normalization Project Status

## Current project state

AI-V02 is **in progress**: Slice 1 (uploaded PDF Buffer → free text),
Slice 2 (Uploaded CV output contract and composition), Slice 3 (one-pass
LLM semantic extraction), Slice 3.1 (Codex primary provider integration),
and Slice 3.2 (remaining Gemini/Groq offline provider verification and
Engineering Contract cleanup), all part of F01, are **implemented and verified
offline**. The F01 Codex live smoke harness is prepared and focused-tested
offline; the Backend full gate is pending. F01 as a whole is not
implemented and Final Acceptance has not started. The approved
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
  provider output text against it with verbatim-evidence checks, and
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

## Deferred / not started

- Live Codex/CCPro gateway and configured model acceptance of Responses API
  Strict Structured Output is unverified; offline SDK/HTTP mocks prove request
  serialization and local response handling only. Gemini's
  provider-native JSON Schema mode has no separate `strict: true` parameter;
  offline tests verify the SDK request configuration, not server enforcement.
- Gemini/Groq actual context and output limits, provider-side truncation
  behavior, strict-schema acceptance, and long-PDF semantic completeness
  remain unverified against live providers. Offline fixtures verify only the
  installed SDK's serialization and handling of reported completion states.
- Backend Uploaded CV resolution, authorization, and Buffer supply.
- BR-AI-22 quality evaluation on representative Uploaded CV groups; Slice 1
  fixtures prove extraction mechanics only and Slice 2 tests prove contract
  mechanics only, not interpretation quality.
- OCR is out of scope for AI-V02.

## Verification status

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
