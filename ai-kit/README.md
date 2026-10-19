# JOBHUB AI Kit

`@jobhub/ai-kit` is JOBHUB's private local Node.js package for AI-specific adapters and computation. It uses JavaScript ES modules, lives beside `backend/` and `frontend/`, and is consumed by Backend through `file:../ai-kit`.

AI Kit runs in the Backend process and has no HTTP server, port, startup command, or deployment service of its own. The technical foundation is ready, and AI-V01 Product/Data authority is approved. The R2 runtime shape contract and R4 contract-test coverage are complete. The internal F01 Job extraction stage (`JobRawInput` to `JobExtractionResult`) is implemented; F01 consolidation into `JobMatchProfile` and all of F02 remain unimplemented, and no AI-V01 capability is exported. AI-V02 and AI-V03 are not approved.

## Installation

From the repository root, install AI Kit before Backend:

```bash
cd ai-kit
npm ci

cd ../backend
npm ci
```

The Backend dependency is a sibling-directory symlink. Installing or copying only `backend/` does not install AI Kit's dependencies; local and deployment contexts must contain both directories. There is no npm workspace or root bootstrap script for this flow.

## Configuration

Backend is the only runtime environment owner. Put optional provider configuration in `backend/.env`, using [`backend/.env.example`](../backend/.env.example) as the template:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Gemini credential |
| `GEMINI_MODEL` | Gemini model name |
| `GROQ_API_KEY` | Groq credential |
| `GROQ_MODEL` | Groq model name; current default is `openai/gpt-oss-120b` |

AI Kit has no `.env` file and does not read `process.env`; Backend injects normalized configuration and its canonical logger. Live smoke requires the matching provider key/model. Never commit or print credentials.

## Source structure

```text
ai-kit/
├── v01-contract.json             # AI-V01 runtime-only shape contract
├── src/
│   ├── index.js                  # Production package facade
│   ├── create-ai-kit.js          # Dependency-injection factory foundation
│   ├── llm/                      # Gemini/Groq adapters and fallback policy
│   ├── normalization/            # AI-V01 contract validation and F01 Job extraction stage
│   └── document/                 # Scribe PDF text extraction adapter
├── scripts/                      # Manual Gemini/Groq smoke harnesses
├── test/                         # Offline foundation and AI-V01 contract tests
├── AGENTS.md                     # Scoped contributor/agent contract
└── package.json                  # Package exports and npm commands
```

This is the implemented structure, not a scaffold for future agents, matching, profiles, prompts, retrieval, embeddings, or persistence.

## Public API and Backend integration

The current production entrypoint is the package root:

```js
import { createAiKit } from "@jobhub/ai-kit";
```

`createAiKit` validates injected Gemini/Groq configuration and the logger contract, then returns an empty frozen foundation object. It does not expose matching, CV analysis, recommendation, or agent operations.

[`backend/src/services/ai-kit.service.js`](../backend/src/services/ai-kit.service.js) is the sole Backend runtime integration owner. Backend startup does not yet import it, so AI Kit is not part of the full startup/shutdown lifecycle. The `tooling/smoke-gemini` and `tooling/smoke-groq` exports serve only manual smoke launchers; provider adapters and other internals are not public business APIs.

## Development commands

Run offline development checks from `ai-kit/`:

```bash
cd ai-kit

npm run lint
npm test
npm run test:watch
npm run verify:agent
```

`verify:agent` is the canonical offline gate (`lint` plus Vitest). Normal tests mock provider SDK/network behavior and consume no provider quota. The local text-native PDF fixture exercises Scribe without an external service.

Run live provider smoke explicitly when credentials and network access are available:

```bash
npm run smoke:gemini
npm run smoke:groq
```

Smoke may consume quota and reads credentials through Backend configuration. Gemini and Groq have each been live-verified separately; one does not verify the other or the fallback path. From the repository root, also run this for Backend integration/runtime changes:

```bash
cd backend
npm run verify:agent
```

## Current limitations

- Only the internal F01 Job extraction stage exists; F01 consolidation, `JobMatchProfile`, READY/FAILED results, and F02 are not implemented.
- The Gemini-to-Groq fallback policy is composed only into the internal F01 Job extraction stage, which is not yet exported or used by Backend.
- Scribe PDF extraction exists, but there is no complete uploaded-CV ingestion pipeline.
- Buffer input and scanned-PDF/OCR fixture coverage are deferred.
- Explicit Scribe disposal is not wired into Backend shutdown.
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
| [AI Kit Product roadmap](../docs/product/ai-kit/roadmap.md) | AI Kit version and scope authority; AI-V01 is approved and partially implemented (F01 Job extraction stage only) |
| [AI Kit Product Specifications](../docs/product/ai-kit/versions/) | Approved detailed AI Kit business requirements, including AI-V01 |
| [AI Kit Data Contracts](../docs/data/ai-kit/versions/) | Approved AI Kit persistence and data-defined contracts, including AI-V01 |
