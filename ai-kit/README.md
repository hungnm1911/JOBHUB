# JOBHUB AI Kit

`@jobhub/ai-kit` is JOBHUB's private local Node.js package for AI-specific adapters and computation. It uses JavaScript ES modules, lives beside `backend/` and `frontend/`, and is consumed by Backend through `file:../ai-kit`.

AI Kit runs in the Backend process and has no HTTP server, port, startup command, or deployment service of its own. The technical foundation is ready, and AI-V01 Product/Data authority is approved. Deterministic AI-V01 F01 Job normalization and F02 Generated CV normalization are implemented through the `createAiKit` instance (`normalizeJob`, `normalizeGeneratedCv`). Backend Slice B1 consumes F01 for internal Jobs, and Slice B2 consumes F02 for a Candidate's own Generated CVs. AI-V01 Final Acceptance remains PENDING; AI-V02 and AI-V03 are not approved.

## Installation

From the repository root, install AI Kit before Backend:

```bash
cd ai-kit
npm ci

cd ../backend
npm ci
```

The Backend dependency is a sibling-directory symlink. Installing or copying only `backend/` does not install AI Kit's dependencies; local and deployment contexts must contain both directories. There is no npm workspace or root bootstrap script for this flow.

## PDF text extraction

The internal `src/document/pdf-text-extractor.js` owner uses Mozilla PDF.js
(`pdfjs-dist/legacy/build/pdf.mjs`). `extractPdfText(pdfPath)` accepts a non-empty
path string and returns page text in document order, with line breaks and blank
lines between pages. It cleans up pages and destroys the loading task on success
or failure, including failed document loading. Concurrent calls own separate tasks.
This module is not exported from the package root.

`pdfjs-dist` is pinned to `5.6.205`, which supports the verified Node 20.19.1
runtime (`>=20.19.0 || >=22.13.0 || >=24`); newer PDF.js releases require newer
Node versions. Recheck runtime compatibility before upgrading. PDF.js needs no
provider key, OCR language assets, or separate worker configuration in Node.
The extractor resolves standard font data from the installed `pdfjs-dist`
package, so text extraction needs no external font download.
The legacy Node import and task lifecycle follow the
[Mozilla Node example](https://github.com/mozilla/pdf.js/blob/v5.6.205/examples/node/getinfo.mjs).
PDF.js does not recognize text in scanned images; OCR is deferred.

## Configuration

Backend is the only runtime environment owner. Put optional provider configuration in `backend/.env`, using [`backend/.env.example`](../backend/.env.example) as the template:

| Variable | Purpose |
| --- | --- |
| `CCPRO_API_KEY` | Codex-compatible API credential |
| `CCPRO_BASE_URL` | Codex-compatible Responses API base URL |
| `CCPRO_MODEL` | Codex model name |
| `GEMINI_API_KEY` | Gemini credential |
| `GEMINI_MODEL` | Gemini model name |
| `GROQ_API_KEY` | Groq credential |
| `GROQ_MODEL` | Groq model name; current default is `openai/gpt-oss-120b` |

AI Kit has no `.env` file and does not read `process.env`; Backend injects normalized configuration and its canonical logger. Live smoke requires the matching provider key/model. Never commit or print credentials.

## Source structure

```text
ai-kit/
├── src/
│   ├── index.js                  # Production package facade
│   ├── create-ai-kit.js          # Dependency-injection factory and F01/F02 composition
│   ├── llm/                      # Codex/Gemini/Groq adapters, usage logs, and fallback policy
│   ├── normalization/            # AI-V01 deterministic F01 Job and F02 Generated CV normalization
│   └── document/                 # PDF.js text extraction adapter
├── scripts/                      # Manual provider smoke harnesses
├── test/                         # Offline foundation and AI-V01 normalization tests
├── AGENTS.md                     # Scoped contributor/agent contract
└── package.json                  # Package exports and npm commands
```

This is the implemented structure, not a scaffold for future agents, matching, recommendation, retrieval, embeddings, or profile persistence.

## Public API and Backend integration

The current production entrypoint is the package root:

```js
import { createAiKit } from "@jobhub/ai-kit";
```

`createAiKit` validates optional injected Codex/Gemini/Groq configuration and the required logger contract, then returns a frozen instance exposing exactly `normalizeJob` (F01) and `normalizeGeneratedCv` (F02). These synchronous, deterministic functions need no provider configuration and do not log. The package root exports only `createAiKit`.

The normalizer owners ([Job](src/normalization/job-normalization.js) and [Generated CV](src/normalization/cv-normalization.js)) define the source projections, runtime profile shapes, `READY`/`FAILED` results, and coded input-refusal errors. The factory exposes those functions unchanged. The former LLM extraction stage, contract loader, and `v01-contract.json` have been retired; F01/F02 use no LLM or JSON Schema validator. Matching, recommendation, and agent operations remain outside the current public API.

[`backend/src/services/ai-kit.service.js`](../backend/src/services/ai-kit.service.js) is the sole Backend runtime integration owner. [B1 `normalizeInternalJob`](../backend/src/services/job-ai-normalization.service.js) calls F01 for authorized internal Jobs; [B2 `normalizeOwnGeneratedCandidateCv`](../backend/src/services/candidate-cv-ai-normalization.service.js) calls F02 for a Candidate's own active Generated CVs. Backend startup does not yet import the AI Kit integration, so AI Kit is not part of the full startup/shutdown lifecycle. The `tooling/smoke-codex`, `tooling/smoke-gemini`, and `tooling/smoke-groq` exports serve only manual smoke launchers; provider adapters and other internals are not public business APIs.

## Development commands

Run offline development checks from `ai-kit/`:

```bash
cd ai-kit

npm run lint
npm test
npm run test:watch
npm run verify:agent
```

`verify:agent` is the canonical offline gate (`lint` plus Vitest). Normal tests mock provider SDK/network behavior and consume no provider quota. The local text-native PDF fixture exercises PDF.js without an external service.

Run live provider smoke explicitly when credentials and network access are available:

```bash
npm run smoke:codex
npm run smoke:gemini
npm run smoke:groq
```

All three smoke commands log the provider/model at start, each API request's
provider/model/SDK operation before sending, normalized token usage from the
adapter, and pass/fail with elapsed `durationMs`. The request-start log is also
emitted for regular adapter calls and every retry/fallback attempt. Success is
logged only after the expected response marker is validated. CLI output
redacts the configured API key; unexpected response text is not printed.

Smoke may consume quota and reads credentials through Backend configuration. Each provider must be verified separately; one provider's result does not verify another provider or the fallback path. From the repository root, also run this for Backend integration/runtime changes:

```bash
cd backend
npm run verify:agent
```

## Current limitations

- Public Job and Uploaded CV normalization, HTTP endpoints, Job/CV CRUD hooks, and AI-specific persistence remain deferred. B1/B2 are runtime service entries only.
- AI #1/#2/#3 matching/scoring, recommendation/retrieval, and CV agents remain deferred.
- The internal provider-chain fallback utility is not composed into any capability.
- PDF.js extracts existing text layers; it does not perform OCR. PDFs without extractable text return an empty string. There is no complete uploaded-CV ingestion pipeline.
- Buffer input and OCR remain outside the current extractor API.
- Each extraction destroys its own loading task/worker; no shared disposal or Backend shutdown hook is required.
- The tracked Node 20 compatibility warning remains unresolved: `file-type@22.0.1` requires Node `>=22`, while the verified environment uses Node 20.19.1.

See the [AI Kit foundation status](../docs/project-status/ai-kit/foundation.md) for current evidence and deferred work.

## Documentation references

| Document | Responsibility |
| --- | --- |
| [AI Kit agent contract](AGENTS.md) | Required reading and operational workflow for work under `ai-kit/` |
| [Application architecture](../docs/engineering/architecture.md) | Current state, target convention, and architectural constraints |
| [AI Kit conventions](../docs/engineering/ai-kit-conventions.md) | Enforceable coding, integration, security, and verification rules |
| [AI Kit sources of truth](../docs/engineering/ai-kit-source-of-truth.md) | Canonical owners, consumers, and forbidden duplication |
| [AI Kit foundation status](../docs/project-status/ai-kit/foundation.md) | Implementation and verification evidence |
| [AI Kit Product roadmap](../docs/product/ai-kit/roadmap.md) | AI Kit version and scope authority; F01/F02 and Backend B1/B2 are implemented and verified offline; Final Acceptance remains PENDING |
| [AI Kit Product Specifications](../docs/product/ai-kit/versions/) | Approved detailed AI Kit business requirements, including AI-V01 |
| [AI Kit Data Contracts](../docs/data/ai-kit/versions/) | Approved AI Kit persistence and data-defined contracts, including AI-V01 |
