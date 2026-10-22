# AI-V02 Uploaded CV Normalization Project Status

## Current project state

AI-V02 is **in progress**: Slice 1 (uploaded PDF Buffer → free text, part of
F01) is **implemented and verified offline**. F01 as a whole is not
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

## Deferred / not started

- LLM semantic extraction of PDF text and provider-call policy (BR-AI-16, BR-AI-17–BR-AI-19).
- Deterministic combination with Backend CandidateCV metadata into
  `CVMatchProfile`, `READY`/`FAILED` result semantics, and the AI Kit public entry (BR-AI-15, BR-AI-20).
- Backend Uploaded CV resolution, authorization, and Buffer supply.
- BR-AI-22 quality evaluation on representative Uploaded CV groups; Slice 1
  fixtures prove extraction mechanics only, not interpretation quality.
- OCR is out of scope for AI-V02.

## Verification status

- **2026-10-22 — Slice 1:** focused
  `npx vitest run test/pdf-text-extractor.test.js test/pdf-text-extractor-lifecycle.test.js`
  passed (2 files, 33 tests) using offline fixtures (text-native,
  multi-page, image-only, invalid bytes) and mocked PDF.js lifecycle cases;
  `cd ai-kit && npm run verify:agent` passed (lint; 13 files, 239 tests).
  No provider or live smoke was run. Backend gate not run: no Backend change.
