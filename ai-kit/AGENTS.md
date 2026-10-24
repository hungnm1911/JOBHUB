# AI Kit Agent Contract

This file applies to `ai-kit/` and supplements the repository-level
[`AGENTS.md`](../AGENTS.md), which remains in force.

## Authority map

Use these Engineering documents as the AI Kit architecture contract:

- [`architecture.md`](../docs/engineering/architecture.md): `Purpose` and the relevant `AI Kit — …` sections;
- [`ai-kit-conventions.md`](../docs/engineering/ai-kit-conventions.md): code, integration, security, and verification conventions; and
- [`ai-kit-source-of-truth.md`](../docs/engineering/ai-kit-source-of-truth.md): canonical owners, allowed consumers, and forbidden duplication.

[`docs/project-status/index.md`](../docs/project-status/index.md) maps the
[AI Kit foundation leaf](../docs/project-status/ai-kit/foundation.md) and each
business version's status leaf, starting with
[AI-V01](../docs/project-status/ai-kit/v01-job-cv-normalization.md). These
record implementation evidence only; they do not replace authority. Record
shared package/integration state in the foundation leaf and version-specific
implementation or acceptance state in the matching version leaf.

For AI business behavior, locate the AI Kit [roadmap](../docs/product/ai-kit/roadmap.md) entry and matching approved [Product Specification](../docs/product/ai-kit/versions/) and [Data Contract](../docs/data/ai-kit/versions/). If authority is absent or unapproved, stop before inventing behavior. The AI Kit roadmap has its own version and scope authority; the Backend roadmap does not approve or gate it.

When work spans AI Kit and Backend domain behavior, also read the applicable canonical Backend [Product Specification](../docs/product/backend/versions/) and [Data Contract](../docs/data/backend/versions/). AI Kit must preserve Backend domain boundaries and canonical data semantics; in particular, it must not create competing definitions for `CandidateCV`, `Job`, or their existing relationships.

Infrastructure, tooling, tests, and documentation maintenance do not require an AI Product/Data spec unless they change business behavior or a data-defined contract. For example, maintenance of the existing Gemini-to-Groq fallback may proceed from Engineering authority. An AI business capability such as CV–Job scoring requires an approved AI Kit roadmap version, Product Specification, and Data Contract; if any is missing, stop before implementation rather than deriving behavior from AI #1/#2/#3 architecture direction.

## Minimal reading workflow

1. Read the root contract and this scoped contract.
2. Read the status-index rules, then the relevant leaf's current state, deferred section, and latest verification evidence.
3. Search AI Kit Source of Truth by responsibility, concept, and discovered path; do not scan or recreate the matrix.
4. Read only the relevant Architecture and Conventions sections.
5. For business-capability work, confirm Product/Data authority, requirements, persistence effects, and deferred scope.
6. Inspect the owning source modules and focused tests before planning or editing.

Do not read every long document when a focused lookup is sufficient. If canonical documents or code and authority conflict, stop before changing behavior and request a human decision.

## Source and dependency boundaries

- AI Kit is the private same-process ESM package `@jobhub/ai-kit`; Backend owns runtime, config, logger, auth, MongoDB, persistence, and canonical domain services.
- AI Kit source and tooling must not import Backend. Production source must not read `process.env`; dependencies cross by injection.
- Backend production code uses the package root through `backend/src/services/ai-kit.service.js`; tooling uses explicit tooling subpaths. No deep imports or reverse dependencies.
- Provider SDK imports remain in their Gemini/Groq adapters; PDF.js imports remain in the PDF extractor.
- Do not add an HTTP server, DB connection, duplicate owner, speculative layer/framework, or public export without an approved concrete need.
- Do not infer capabilities, prompts, schemas, scoring, tools, retrieval, or
  persistence from roadmap ideas or task names.

## Change discipline

- Make the smallest coherent change and extend the canonical owner.
- Do not pre-create future AI #1/#2/#3 folders or abstractions, or change architecture/ownership without approval.
- When an approved change introduces or moves an owner, update `ai-kit-source-of-truth.md` and affected Engineering contracts.
- Update the mapped status leaf after successful verification only when “Where is the project currently?” changes.
- Never log secrets, credentials, CV/JD content, business prompts, private tool arguments, or sensitive raw provider payloads.
- Cross-boundary work must also follow [`backend/AGENTS.md`](../backend/AGENTS.md) and both scopes' verification.
- Do not commit or push unless explicitly requested.

## Verification

For AI Kit source, configuration, test, or tooling changes, run focused checks
when available, then the canonical offline gate:

```sh
cd ai-kit && npm run verify:agent
```

If Backend integration or runtime behavior changes, also run:

```sh
cd backend && npm run verify:agent
```

Live provider smoke is opt-in, may consume quota, and is never part of an
offline gate:

```sh
cd ai-kit && npm run smoke:codex
cd ai-kit && npm run smoke:gemini
cd ai-kit && npm run smoke:groq
```

One provider's smoke result proves nothing about the other provider or fallback
composition. For documentation-only changes, check links and consistency, run
`git diff --check`, and check untracked-file whitespace separately; full code
gates are not required by default. Report every run, skip, and failure honestly.

## Lessons learned / reference (nonbinding)

These AI-V03 observations are reference material for later AI Kit work. They do
not add Product Rules, acceptance gates, or required process steps.

- Provider-native strict output constrains only what its schema actually
  declares. Schema acceptance alone does not establish semantic correctness.
- Keep the prompt, JSON Schema, and runtime validator consistent about the
  requested output and its constraints.
- Explain source association explicitly, especially when an LLM merges a
  structured skill with a related Job Description requirement.
- Distinguish `NO_EVIDENCE`, `MISMATCH`, `CONFLICT`, and `PARTIAL` using source
  evidence; do not infer Candidate facts absent from the CV.
- Semantic assessment and deterministic scoring have separate owners. A later
  version may reuse a calculator without adopting the entire AI-V03 prompt or
  output contract.
- Offline tests cover contracts and formulas; representative live evaluation
  examines semantic quality.
- When investigating an LLM failure, capture the output before validation to
  identify the cause. Keep sensitive payloads in approved local diagnostic
  artifacts, not tracked files or logs.
- In reviews, distinguish changes made for the current finding from changes
  already approved earlier.
- Avoid repeating provider calls or full verification without a concrete
  technical reason.
