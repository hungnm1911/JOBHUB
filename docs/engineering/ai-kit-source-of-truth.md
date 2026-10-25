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
| Package — factory boundary, injected dependency-shape validation, and package instance composition: AI-V01 entries (`normalizeJob`, `normalizeGeneratedCv`), AI-V02 `normalizeUploadedCv`, AI-V03 `matchJobCv`, and AI-V04 `evaluateCv` delegated to their owners | `ai-kit/src/create-ai-kit.js` (`createAiKit`) | Package-root facade; focused public-API tests; Backend integration only through the facade | A parallel factory; environment loading; persistence or authorization in the factory; wrapping, translating, or re-validating owner results or coded errors in the facade |
| LLM — Codex-compatible Responses API SDK construction and `responses.create` delegation | `ai-kit/src/llm/codex-client.js` | AI Kit Codex smoke harness; `ai-kit/src/normalization/uploaded-cv-semantic-extraction.js`; `ai-kit/src/matching/semantic-skills-assessment.js`; focused adapter tests; offline provider-chain HTTP-attempt tests | Direct `openai` imports elsewhere; Codex client construction in Backend or business capabilities; prompt, fallback, or persistence ownership in the adapter |
| LLM — Gemini provider SDK construction and `models.generateContent` delegation | `ai-kit/src/llm/gemini-client.js` | AI Kit Gemini smoke harness; `ai-kit/src/normalization/uploaded-cv-semantic-extraction.js`; `ai-kit/src/matching/semantic-skills-assessment.js`; focused adapter tests; offline provider-chain HTTP-attempt tests | Direct `@google/genai` imports elsewhere; Gemini client construction in Backend or business capabilities; prompt, scoring, fallback, or persistence ownership in the adapter |
| LLM — Groq provider SDK construction and `chat.completions.create` delegation | `ai-kit/src/llm/groq-client.js` | AI Kit Groq smoke harness; `ai-kit/src/normalization/uploaded-cv-semantic-extraction.js`; `ai-kit/src/matching/semantic-skills-assessment.js`; focused adapter tests; offline provider-chain HTTP-attempt tests | Direct `groq-sdk` imports elsewhere; Groq client construction in Backend or business capabilities; prompt, scoring, fallback, or persistence ownership in the adapter |
| LLM — normalized provider token-usage logging | `ai-kit/src/llm/provider-usage.js` (`logProviderUsage`) | Codex, Gemini, and Groq adapters; focused adapter tests | Logging prompts, private inputs, credentials, or raw provider responses; parallel token field normalization |
| LLM — provider-availability classification and bounded per-provider attempt/fallback policy | `ai-kit/src/llm/llm-fallback.js` (`executeWithLlmProviderChain`) | Focused fallback and provider-chain HTTP-attempt tests; no current capability composition | Fallback decisions inside provider adapters or Backend; duplicate status/network classifiers; further retries, circuit breakers, registries, or claims that fallback is automatic for all capabilities |
| Document — PDF.js text-layer extraction (path, and AI-V02 uploaded PDF Buffer with coded extraction failures) and per-extraction page/loading-task cleanup | `ai-kit/src/document/pdf-text-extractor.js` (`extractPdfText`, `extractPdfTextFromBuffer`, `PdfTextExtractionError`) | Focused extraction/lifecycle tests; `ai-kit/src/normalization/uploaded-cv-semantic-extraction.js` | Direct `pdfjs-dist` imports elsewhere; failure paths that omit task destruction; shared workers/disposal owners; claims of OCR support |
| Tooling — Gemini manual live-smoke adapter invocation and response-marker validation | `ai-kit/scripts/smoke-gemini.js` | `backend/scripts/smoke-gemini.js` through `@jobhub/ai-kit/tooling/smoke-gemini`; focused tooling tests when needed | Production capability use; environment reads; Backend imports; direct Gemini SDK use; inclusion in offline test gates |
| Tooling — Groq manual live-smoke adapter invocation and response-marker validation | `ai-kit/scripts/smoke-groq.js` | `backend/scripts/smoke-groq.js` through `@jobhub/ai-kit/tooling/smoke-groq`; focused tooling tests when needed | Production capability use; environment reads; Backend imports; direct Groq SDK use; inclusion in offline test gates |
| Tooling — Codex manual live-smoke adapter invocation and response-marker validation | `ai-kit/scripts/smoke-codex.js` | `backend/scripts/smoke-codex.js` through `@jobhub/ai-kit/tooling/smoke-codex`; focused tooling tests | Production capability use; environment reads; Backend imports; direct OpenAI SDK use; inclusion in offline test gates |
| Tooling — AI-V02 F01 Uploaded CV Codex preflight and opt-in one-call smoke, with synthetic source, redacted console output, and explicit ignored local full-output artifacts | `ai-kit/scripts/smoke-uploaded-cv-codex.js` | `backend/scripts/smoke-uploaded-cv-codex.js` through `@jobhub/ai-kit/tooling/smoke-uploaded-cv-codex`; focused offline tooling tests | Environment reads; Backend imports; direct SDK calls; raw PDF text, provider responses, credentials, or personal data on console or in tracked files; automatic retry or fallback |
| Tooling — package export map, production root mapping, and explicit tooling-only smoke subpaths | `ai-kit/package.json` (`exports`) | Node.js package resolution; Backend runtime integration at `.`; Backend smoke launchers at the matching tooling subpath | Unapproved production or tooling subpaths; deep filesystem imports used instead of an export; exposing internal modules merely for tests |
| AI-V01 F01/F02 and AI-V02 F01 — shared deterministic normalization support: source-gate helpers, EmploymentType/WorkMode/CategoryLevel/ExperienceLevel code sets mirrored from Backend constants, resolved Category/ExperienceLevel validation, the CandidateCV metadata gate (`preferredLocations`, resolved `taxonomy` and its reference checks) and `metadata` group shared by the Generated and Uploaded `CVMatchProfile` variants, JSON Pointer `sourced` provenance helpers, deep freeze, and the READY/FAILED result constants | `ai-kit/src/normalization/normalization-support.js` | `ai-kit/src/normalization/job-normalization.js`; `ai-kit/src/normalization/cv-normalization.js`; `ai-kit/src/normalization/uploaded-cv-normalization.js`; `ai-kit/src/matching/deterministic-field-scoring.js` (CategoryLevel and ExperienceLevel order only) | A second copy of these code sets, helpers, or the CandidateCV metadata group in a normalization module; other capability-specific source or profile shapes; any import |
| AI-V01 F02 — deterministic Generated CV normalization: career-relevant Generated CV source projection gate (`categoryId`/`experienceLevelId` plus Backend-resolved `taxonomy` validated against them, `skillTags`, `employmentTypes`, `workModes`, `preferredLocations`, and V7 `generatedContent` whose `personalInfo` carries only professional `links`, preserved verbatim as `content.links`; canonical language-proficiency and Harvard-section sets mirrored from Backend constants; ISO 8601 date strings), section/item structure and order, verbatim free text under `freeText`, per-value and per-item JSON Pointer `sourcePath` provenance, preservation self-check, and READY/FAILED `CVMatchProfile` result shape (F02; BR-AI-01/02/03/04/05/07/10/11/12/13/14) | `ai-kit/src/normalization/cv-normalization.js` (`normalizeGeneratedCv`) | The `createAiKit` instance (public runtime entry); `ai-kit/test/cv-normalization.test.js`; Backend `backend/src/services/candidate-cv-ai-normalization.service.js` through `backend/src/services/ai-kit.service.js` | LLM calls, free-text interpretation, derived skills/seniority/durations, merging `skillTags` with content skills or project technologies, semantic deduplication, or taxonomy mapping; a parallel JSON Schema contract file or contract loader; Uploaded CV input; catalog lookups, persistence, or authorization in AI Kit; a separate package-root export of the owner or its constants |
| AI-V01/V02 CVMatchProfile career consumer contract — one source-aware read view over the two approved profile variants, with shared career groups, stable item fields, and original per-source provenance; no change to either normalization result | `ai-kit/src/normalization/cv-match-profile-career.js` (`readCvCareerContent`, `CV_CAREER_GROUPS`) | `ai-kit/test/cv-match-profile-career.test.js`; AI-V04 evaluator | A second business profile or career-group list, semantic conversion of source-specific dates/proficiency, fabricated Generated paths or PDF evidence, dropping conflicting or unresolved claims, or a package-root export before an approved consumer |
| AI-V02 F01 — Uploaded CV output contract and composition: the strict structured-output JSON Schema for the LLM interpretation of extracted PDF text (`UPLOADED_CV_PDF_EXTRACTION_SCHEMA`), validation of the provider output text against it plus evidence-presence and non-empty-item checks, diagnostic-only lexical excerpt mismatch reporting (E1), the Uploaded CV source gate (`INVALID_UPLOADED_CV_INPUT`), and deterministic composition with Backend CandidateCV metadata into the `UPLOADED_CV` `CVMatchProfile` READY/FAILED result | `ai-kit/src/normalization/uploaded-cv-normalization.js` (`composeUploadedCvProfile`, `assertUploadedCvSource`) | `ai-kit/test/uploaded-cv-normalization.test.js`; the AI-V02 F01 orchestration | Provider calls, prompts, or JSON Mode fallback in this owner; Backend metadata in the LLM schema or input; overriding, merging, deduplicating, or re-normalizing PDF claims against metadata; a parallel schema copy or Ajv dependency; persistence or cache; a package-root export before an approved consumer |
| AI-V02 F01 — one-pass Uploaded CV semantic extraction: source precheck, PDF Buffer text extraction, short evidence-bound prompt, provider-native strict schema request through Codex by default or explicitly selected Gemini/Groq, response-completion checks, and delegation to the output-contract composition owner | `ai-kit/src/normalization/uploaded-cv-semantic-extraction.js` (`createUploadedCvNormalizer`) | `createAiKit` instance (`normalizeUploadedCv`); focused offline semantic-extraction and Codex HTTP tests | A copied schema or validator, Backend metadata in the prompt, second semantic pass, automatic retry/fallback or JSON Object Mode downgrade, persistence/cache, direct SDK imports, Backend authorization |
| AI-V01 F01 — deterministic Job normalization: career-relevant Job source projection gate (structured metadata, V4.2 Structured Salary matrix, SalaryType/SalaryPeriod code sets mirrored from Backend constants, shared EmploymentType/WorkMode/CategoryLevel/ExperienceLevel sets from the normalization support owner, category/experience-level IDs plus Backend-resolved `taxonomy` metadata validated for exact consistency with those IDs, opaque location codes), verbatim free text, per-value JSON Pointer `sourcePath` provenance, preservation self-check, and READY/FAILED `JobMatchProfile` result shape (revised F01; BR-AI-01/02/03/04/07/08/09/10/13/14) | `ai-kit/src/normalization/job-normalization.js` (`normalizeJob`) | The `createAiKit` instance (public runtime entry); `ai-kit/test/job-normalization.test.js`; Backend `backend/src/services/job-ai-normalization.service.js` through `backend/src/services/ai-kit.service.js` | LLM calls, free-text interpretation, priority/alias/taxonomy mapping, or semantic deduplication; a parallel JSON Schema contract file or contract loader; a second F01 profile shape; catalog lookups, persistence, or authorization in AI Kit; a separate package-root export of the owner or its constants |
| AI-V05 Slice 01 — deterministic Job embedding text from READY V01 JobMatchProfile semantic allowlist (title, resolved FIELD/POSITION names, required skills, description, descriptive ExperienceLevel); no provenance, IDs, or ranking metadata | `ai-kit/src/recommendation/job-embedding-text.js` (`buildJobEmbeddingText`) | `createAiKit` instance; Backend `job-embedding.service.js` through the shared AI Kit integration; focused formatter tests | Backend imports, persistence, provider calls, Atlas Index configuration, a second Job profile, salary/location/work-mode tokens, or V03 scoring changes |
| AI-V05 Slice 03 — deterministic query text from READY CVMatchProfile career content, excluding contact details and provenance | `ai-kit/src/recommendation/cv-query-text.js` (`buildCvQueryText`) through the shared `readCvCareerContent` owner | `createAiKit` instance; Backend Candidate retrieval through the shared AI Kit integration | A second CV profile, Backend access decisions, persistence, direct provider calls, or V03 Match Score calculation |
| AI-V03 F01/F02–F04 — runtime Match Result composition from one authorized READY Job/CV profile pair, one semantic assessment, four deterministic field scores, and fixed weighted scoring (BR-AI-23/24/25/28–34) | `ai-kit/src/matching/match-result-orchestration.js` (`createMatchResultOrchestrator`) | `createAiKit` instance (`matchJobCv`); focused offline tests; future approved Backend consumer through the shared instance | A second scorer or semantic prompt; Backend authorization, HTTP, persistence, fallback, or package-root export of internal calculators |
| AI-V03 F02 — one-inference Semantic Skills Assessment from Job/CV profiles, minimal source-ID prompt, provider-native strict output schema, response and rubric validation, priority and duplicate guards, and restoration of Job/CV provenance (BR-AI-25/26/27/33); shared internal source, rubric, provider-completion, and structured-inference helpers for AI-V04 | `ai-kit/src/matching/semantic-skills-assessment.js` (`createSemanticSkillsAssessor`) | Focused offline tests; AI-V03 Match Result orchestration; AI-V04 evaluator through internal helpers | A second copy of V03 matching source/rubric logic, provider SDK imports, scoring weights, Backend authorization, persistence, or package-root export of this internal owner |
| AI-V03 F03 — deterministic Career Category, Experience Level, Employment Type, and Work Mode scores from READY Job/CV profile metadata (BR-AI-29/30/31) | `ai-kit/src/matching/deterministic-field-scoring.js` (`scoreDeterministicFields`) | Focused AI Kit tests; AI-V03 Match Result orchestration through this internal owner | Duplicate scoring rules, LLM-derived taxonomy or metadata, weighted Match Score, persistence, or package-root export of this internal owner |
| AI-V03 F04 — Skills group aggregation and fixed-weight Match Score from one score per grouped requirement and the F03 field scores (BR-AI-28/32) | `ai-kit/src/matching/weighted-match-scoring.js` (`calculateWeightedMatchScore`) | Focused AI Kit tests; AI-V03 Match Result orchestration through this internal owner | Semantic equivalence inference, provider output schema, duplicate weighted scoring, persistence, or package-root export of this internal owner |
| AI-V04 F01 Slice 1 — one-inference CV evaluation with V03 semantic rubric and calculators, overall summary, five field reviews, CV improvements, and source-aware section/item feedback (BR-AI-02–07) | `ai-kit/src/evaluation/cv-evaluation.js` (`createCvEvaluator`) | `createAiKit` instance (`evaluateCv`); focused offline tests; approved Backend Slice 2 Candidate evaluation service through the shared instance | A parallel scoring policy, independent career read view, Backend authorization/HTTP, persistence, provider SDK imports, mutation of Job/CV, or a separate package-root export |
| Cross-boundary — Backend runtime integration, dependency injection, and shared AI Kit instance | `backend/src/services/ai-kit.service.js` | B1 `backend/src/services/job-ai-normalization.service.js`; B2 and AI-V02 Slice 4c `backend/src/services/candidate-cv-ai-normalization.service.js`; AI-V03 `backend/src/services/candidate-job-match.service.js`; AI-V04 `backend/src/services/candidate-cv-evaluation.service.js`; focused integration tests; future approved Backend services | Other Backend source imports of `@jobhub/ai-kit`; parallel AI Kit instances; deep imports; reverse AI Kit-to-Backend dependencies |
| Cross-boundary — environment loading and normalized Codex/Gemini/Groq configuration | `backend/src/config/index.js` (`config.aiKit`) | Backend AI Kit integration service; Backend smoke launchers | `process.env` reads or configuration defaults in AI Kit; secondary Backend AI Kit config owners; smoke harness environment loading |
| Cross-boundary — canonical application logger injected into runtime AI Kit composition | `backend/src/utils/logger.js` | `backend/src/services/ai-kit.service.js` and other approved Backend runtime owners | A second runtime logger in AI Kit; AI Kit logger configuration; logging secrets, private document/prompt content, or raw sensitive provider responses |
| Cross-boundary — Codex smoke CLI configuration handoff, redaction, usage output, and operator result reporting | `backend/scripts/smoke-codex.js` | Explicit `smoke:codex` command; focused launcher tests | Environment reads in AI Kit; Backend deep imports; direct SDK calls; treating Codex smoke as fallback-chain verification |
| Cross-boundary — AI-V02 F01 Uploaded CV smoke CLI PDF path, Backend Codex configuration handoff, and redacted operator output | `backend/scripts/smoke-uploaded-cv-codex.js` | Explicit `smoke:uploaded-cv:codex` command; focused launcher tests | Backend runtime integration; direct SDK calls; loading a second configuration owner; printing PDF paths or private content |
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
- For AI-V01, Backend owns canonical source validation (AI Data §11.2). B1
  `job-ai-normalization.service.js` and B2
  `candidate-cv-ai-normalization.service.js` reuse canonical access loaders,
  project the persisted source losslessly, serialize IDs/dates, and resolve
  taxonomy before invoking F01/F02 through the shared instance. Their detailed
  ownership is mapped in [Backend Sources of Truth](source-of-truth.md).
  AI Kit receives valid plain projections; its source gates check projection
  shape and resolved-reference consistency, not authorization or domain policy.
  For Location, B1/B2 reuse canonical model validators for forbidden Province
  codes and preferred-selection duplicate/exclusivity rules; F01/F02 do not
  duplicate those rules or perform external catalog lookups.
- AI-V02 Slice 4a reuses the B2 Backend owner for an Uploaded CandidateCV
  `cvSource` projection after the canonical own active access check. The
  projection rechecks the persisted source and resolves taxonomy without
  invoking AI Kit. It does not authorize a new caller or run Uploaded CV
  normalization. Slice 4c adds the internal own-Candidate runtime entry in
  that owner, binding the current PDF to the projected source and invoking the
  shared AI Kit instance; see the Backend Sources of Truth rows for boundaries.
- When ownership changes, update this document together with the relevant
  architecture and conventions. Project-status remains evidence, not authority.

## Deferred responsibilities without owners

No canonical implementation owner currently exists for:

- AI #1 Match Result orchestration, explanation, or improvement behavior beyond AI-V03 F02/F03/F04;
- business prompts and structured-output schemas for capabilities other than
  AI-V02 F01 Uploaded CV normalization and AI-V03 F02 Semantic Skills Assessment;
- an agent/tool registry, capability-specific callback contract, or CV Agent
  workflow;
- Atlas retrieval, vector search, or provider embedding calls; or
- AI-specific persistence beyond AI-V05 Job `embeddingText`.

The AI-V01 F01 and F02 normalization owners define and produce the runtime
`JobMatchProfile`, `CVMatchProfile`, and their READY/FAILED results
without an LLM or a separate JSON Schema contract; the superseded extraction
stage and its `ai-kit/v01-contract.json` contract have been retired. They are
reachable only through the `createAiKit`
instance, consumed by B1 internal Job and B2 own Generated CV through the
Backend integration service. Public Job access, Recruiter/application CV access,
and most Job/CV CRUD hooks remain deferred; AI-V05 adds a post-publish Job text
sync. AI #1/#2/#3,
including complete Match Result orchestration beyond the internal F02/F03/F04 owners, agents,
Atlas retrieval, vector search, provider embeddings, and AI-specific
persistence beyond Job `embeddingText` remain without implementation owners.
AI-V03 Product/Data authority is approved; its F02 semantic assessment, F03
deterministic field scoring, and F04 aggregation slices are implemented.
OCR is out of scope; Buffer-based extraction,
Uploaded CV output composition, and one-pass LLM orchestration exist for AI-V02;
The internal Backend Uploaded CV invocation is implemented; no downstream
consumer is approved yet. PDF.js extraction owns
its task cleanup and requires no Backend shutdown disposal owner.
