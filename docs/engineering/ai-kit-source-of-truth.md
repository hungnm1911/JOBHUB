# AI Kit Sources of Truth

## Purpose

This document identifies the current canonical owner for each implemented AI
Kit responsibility and the Backend boundaries that AI Kit must consume rather
than duplicate. It is normative for new and changed code.

[`architecture.md`](architecture.md#ai-kit--current-state) defines runtime and
dependency boundaries. [`ai-kit-conventions.md`](ai-kit-conventions.md) defines
the rules applied to those boundaries. The
[AI Kit foundation status](../project-status/ai-kit/foundation.md) records
implementation evidence only; it does not replace engineering authority.

## Ownership rules

- One responsibility has one canonical owner. Consumers reuse that owner
  rather than reconstructing its behavior or state.
- Production consumers use approved package APIs and integration boundaries.
  A focused test import or convenience re-export does not create another owner.
- Provider SDK imports remain inside their corresponding adapters. AI Kit does
  not import Backend modules.
- AI Kit does not create competing owners for Backend configuration, logging
  infrastructure, authentication, authorization, MongoDB, domain workflows, or
  persistence.
- Ownership rows are added only after an approved capability has a concrete
  implementation. Architectural direction alone does not establish an owner.

## Ownership matrix

| Responsibility | Canonical owner | Allowed consumers | Forbidden duplication |
| --- | --- | --- | --- |
| Package — production public facade and production export implementation | `ai-kit/src/index.js` | `backend/src/services/ai-kit.service.js` through `@jobhub/ai-kit`; focused public-API tests; future approved production consumers | Alternate production entrypoints; Backend deep imports; exporting internals only to support tests; treating tooling subpaths as capability APIs |
| Package — factory boundary, injected dependency-shape validation, and package instance composition | `ai-kit/src/create-ai-kit.js` (`createAiKit`) | Package-root facade; focused factory tests; Backend integration only through the facade | A parallel factory; environment loading; provider, persistence, authorization, or business-capability ownership inside the foundation factory without an approved capability |
| LLM — Gemini provider SDK construction and `models.generateContent` delegation | `ai-kit/src/llm/gemini-client.js` | AI Kit Gemini smoke harness; focused adapter tests; future approved internal capability composition | Direct `@google/genai` imports elsewhere; Gemini client construction in Backend or business capabilities; prompt, scoring, fallback, or persistence ownership in the adapter |
| LLM — Groq provider SDK construction and `chat.completions.create` delegation | `ai-kit/src/llm/groq-client.js` | AI Kit Groq smoke harness; focused adapter tests; future approved internal capability composition | Direct `groq-sdk` imports elsewhere; Groq client construction in Backend or business capabilities; prompt, scoring, fallback, or persistence ownership in the adapter |
| LLM — provider-availability classification and single primary-to-fallback attempt policy | `ai-kit/src/llm/llm-fallback.js` (`executeWithLlmFallback`) | Focused fallback tests; future approved internal capability composition | Fallback decisions inside provider adapters or Backend; duplicate status/network classifiers; retries, circuit breakers, registries, or claims that fallback is already automatic |
| Document — PDF text extraction, per-document cleanup, OCR dispatch, and shared Scribe runtime disposal | `ai-kit/src/document/pdf-text-extractor.js` | Focused extraction/lifecycle tests; future approved internal document capability | Direct `scribe.js-ocr` imports elsewhere; failure paths that omit `document.close()`; per-document `scribe.terminate()`; a second shared-runtime lifecycle owner |
| Tooling — Gemini manual live-smoke adapter invocation and response-marker validation | `ai-kit/scripts/smoke-gemini.js` | `backend/scripts/smoke-gemini.js` through `@jobhub/ai-kit/tooling/smoke-gemini`; focused tooling tests when needed | Production capability use; environment reads; Backend imports; direct Gemini SDK use; inclusion in offline test gates |
| Tooling — Groq manual live-smoke adapter invocation and response-marker validation | `ai-kit/scripts/smoke-groq.js` | `backend/scripts/smoke-groq.js` through `@jobhub/ai-kit/tooling/smoke-groq`; focused tooling tests when needed | Production capability use; environment reads; Backend imports; direct Groq SDK use; inclusion in offline test gates |
| Tooling — package export map, production root mapping, and explicit tooling-only smoke subpaths | `ai-kit/package.json` (`exports`) | Node.js package resolution; Backend runtime integration at `.`; Backend smoke launchers at the matching tooling subpath | Unapproved production or tooling subpaths; deep filesystem imports used instead of an export; exposing internal modules merely for tests |
| AI-V01 — runtime-only raw-input, extraction, match-profile, evidence/conflict, and READY/FAILED result shapes (R2; F01/F02; BR-AI-01–BR-AI-14) | `ai-kit/v01-contract.json` | Future approved F01/F02 implementation and R4 contract tests | A parallel AI-V01 schema; treating the contract as an implemented capability; `BLOCKED`; Uploaded CV/PDF or matching/scoring shapes; persisted profile, cache, history, freshness, or versioning fields |
| AI-V01 — Runtime Shape Contract verification coverage and semantic-coverage boundary (R4; F01/F02; BR-AI-01–BR-AI-14) | `ai-kit/test/v01-contract.test.js` | `npm test` and `npm run verify:agent` | A second runtime schema; mocked normalization behavior presented as production verification; claiming deferred evidence resolution, consolidation, authorization, or inference rules are verified before F01/F02 exist |
| Cross-boundary — Backend runtime integration, dependency injection, and shared AI Kit instance | `backend/src/services/ai-kit.service.js` | Focused integration tests; future approved Backend services consume its exported instance | Other Backend source imports of `@jobhub/ai-kit`; parallel AI Kit instances; deep imports; reverse AI Kit-to-Backend dependencies |
| Cross-boundary — environment loading and normalized Gemini/Groq configuration | `backend/src/config/index.js` (`config.aiKit`) | Backend AI Kit integration service; Backend smoke launchers | `process.env` reads or configuration defaults in AI Kit; secondary Backend AI Kit config owners; smoke harness environment loading |
| Cross-boundary — canonical application logger injected into runtime AI Kit composition | `backend/src/utils/logger.js` | `backend/src/services/ai-kit.service.js` and other approved Backend runtime owners | A second runtime logger in AI Kit; AI Kit logger configuration; logging secrets, private document/prompt content, or raw sensitive provider responses |
| Cross-boundary — Gemini smoke CLI configuration handoff, redaction, and operator result reporting | `backend/scripts/smoke-gemini.js` | Explicit `smoke:gemini` command; focused launcher tests | Environment reads in AI Kit; Backend deep imports; direct SDK calls; treating Gemini smoke as Groq or fallback verification |
| Cross-boundary — Groq smoke CLI configuration handoff, redaction, and operator result reporting | `backend/scripts/smoke-groq.js` | Explicit `smoke:groq` command; focused launcher tests when introduced | Environment reads in AI Kit; Backend deep imports; direct SDK calls; treating Groq smoke as Gemini or fallback verification |
| Cross-boundary — authentication, authorization, and actor/business permission decisions | Existing Backend middleware and services mapped in [`source-of-truth.md`](source-of-truth.md) | Backend request pipelines; future approved callbacks must reuse the applicable canonical Backend owners | JWT authentication, role/tenant checks, permission decisions, or authorization state in AI Kit; trusting an LLM tool request as authority |
| Cross-boundary — MongoDB/Mongoose connection lifecycle | `backend/src/config/mongodb.js` | Backend startup/shutdown and approved database tooling | A database connection or Mongoose lifecycle in AI Kit; provider/document adapters accessing MongoDB |
| Cross-boundary — JOBHUB business workflows, domain writes, and persistence representation | Canonical Backend services and models mapped in [`source-of-truth.md`](source-of-truth.md) | Backend controllers, approved services/tool callbacks, and database tooling according to the Backend matrix | Mongoose model imports, direct persistence, parallel domain workflows, or AI-output writes inside AI Kit |

## Consumption rules

- Consumers import or call the canonical owner; they do not recreate its
  configuration, policy, lifecycle, or validation.
- The package root is the production source boundary. Internal modules remain
  internal even when focused AI Kit tests import them directly.
- Backend-to-AI Kit dependency direction is one-way. Plain data, normalized
  configuration, the logger, and narrowly scoped callbacks cross the boundary;
  Backend modules do not.
- When ownership changes, update this document together with the relevant
  architecture and conventions. Project-status remains evidence, not authority.

## Deferred responsibilities without owners

No canonical implementation owner currently exists for:

- AI #1 matching, scoring, explanation, or improvement behavior;
- F01/F02 normalization behavior that produces `CVMatchProfile` or
  `JobMatchProfile`;
- business prompts or capability-specific structured-output schemas beyond the
  AI-V01 runtime shape contract;
- an agent/tool registry, capability-specific callback contract, or CV Agent
  workflow;
- retrieval, embeddings, or vector search; or
- AI-specific persistence.

The AI-V01 runtime shape contract now owns the profile structures, but no
normalization implementation owner exists because F01/F02 are not implemented
even though the R2/R4 prerequisites are complete. AI #1 matching/scoring,
agents, retrieval,
embeddings, vector search, and any AI-specific persistence beyond AI-V01's
approved runtime-only boundary remain without approved Product/Data authority
or implementation owners. Buffer-based extraction, scanned-PDF fixtures,
uploaded-CV ingestion, and Backend shutdown wiring for Scribe disposal are
likewise deferred integration decisions, not current canonical owners.
