---
name: architecture-review
description: Perform an independent, read-only review of a proposed or completed change. Use to find product, data, architecture, ownership, layering, change-quality, and verification problems and report severity-ordered remediation findings.
---

# Architecture Review

Treat the review as read-only by default. Do not modify code unless the user explicitly asks for fixes after reviewing the findings.

## Review preparation

Read in tiers, and stop at the tier the change's scope requires.

**Tier 1 — always:**

- applicable `AGENTS.md` files;
- the changed files or diff;
- relevant tests and checks.

**Tier 2 — canonical contracts, only for what the diff touches:**

- the relevant product specification and, when persistence is affected, the data contract;
- the engineering architecture;
- backend conventions only when backend code changed, and backend `source-of-truth.md` through the lookup protocol in `backend/AGENTS.md` (search the owner rows for the touched files and concepts; do not read the whole table);
- frontend conventions and frontend source-of-truth documentation only when frontend code changed.

Read specifications and data contracts by section as described in the root `AGENTS.md`: the sections matching the affected Fxx/BR-xx rules and touched entities, not the whole file. Engineering documents are scoped as in `backend/AGENTS.md` and `frontend/AGENTS.md`.

**Tier 3 — project status, after forming findings:**

Do not read project status before reviewing the code; it contains unverified claims that can anchor the review. Read it only afterwards, and only to check status handling:

- `docs/project-status/index.md`, following its "Reading a status leaf" rules for the one affected leaf.

## Review verification

Inspect the available verification evidence. For backend change reviews, when execution is practical and the review context permits it, independently run:

```sh
cd backend && npm run verify:agent
```

For frontend change reviews, under the same conditions, independently run:

```sh
cd frontend && yarn verify:agent
```

If the command cannot be run, explicitly report that limitation. Running verification does not change this skill from a read-only review workflow.

## Review scope and proportionality

Keep review depth proportional to the canonical scope and guarantees of the reviewed change.

- Do not infer stronger guarantees than the Product Specification or Data Contract defines.
- Investigate concurrency and failure paths only when an explicit requirement depends on atomicity, transactions, uniqueness or exactly-one semantics, one-time or single-use behavior, first-success-wins behavior, immutability, or forbidden partial persisted state.
- Transaction and atomicity requirements apply to system-owned persisted state unless the canonical contracts explicitly include an external side effect. Do not infer distributed atomicity across SMTP, Cloudinary, or other external services.
- Do not expand the review into production hardening, exhaustive race analysis, crash consistency, high availability, speculative scalability, or unrelated defensive checks unless the canonical contracts require them.
- Report theoretical risks as defects only when they can violate an applicable canonical requirement or a previously guaranteed behavior.

## Review criteria

Check specifically for:

### 1. Product correctness

- missing required behavior;
- behavior added without authority;
- violation of Fxx or BR-xx rules;
- version-boundary leakage.

### 2. Data correctness

- persistence behavior conflicting with the canonical data contract;
- duplicate persistence ownership;
- unauthorized schema or data-model decisions.

### 3. Architecture correctness

- duplicate sources of truth;
- duplicate configuration, client, or connection owners;
- incorrect layer responsibility;
- routes or controllers accessing models directly;
- business logic outside services;
- Express concerns inside services;
- direct `process.env` access outside its canonical owner;
- introduction of an unapproved architecture layer.

For frontend changes, also check for:

- a second router, Redux store, Axios client, Socket.IO client, or `<Toaster />`;
- `import.meta.env` access outside `src/utils/constant.js`, or secrets in `VITE_*` variables;
- HTTP calls outside resource `*.api.js` modules, or feature realtime handling inside the shared socket facade;
- feature workflows in pages, layouts, common components, `utils/`, or `lib/`;
- UI primitives aware of roles, endpoints, slices, or business statuses;
- route guards or client validation treated as authorization;
- roles, statuses, or business rules hard-coded without product and API authority.

### 4. Change quality

- symptom patches instead of root-cause fixes;
- unrelated refactoring;
- technical debt copied as a pattern;
- missing regression coverage for required behavior, explicit invariants, or a fixed defect;
- weakened tests;
- verification claims unsupported by executed commands.

### 5. Project status handling

Check only when the change claims or alters project state:

- a version or feature marked completed while implementation or required verification remains incomplete;
- a status leaf not updated when the project-level state changed, or updated for a state-neutral change (formatting, typo, import-only, comment-only);
- status content that redefines Product, Data, or Engineering authority, or duplicates leaf evidence in the index;
- history appended instead of the current state being revised in place;
- the index changed without a status file being added, moved, or renamed.

## Output format

Return findings ordered by severity:

- Critical
- High
- Medium
- Low

### Severity policy

Use severity based on impact to canonical correctness, not on how sophisticated the technical issue is.

- **Critical** — a direct issue causing a severe security or tenant-boundary breach, destructive or irrecoverable data corruption, or making required behavior fundamentally unsafe.
- **High** — a direct violation of the canonical Product/Data contract, authorization or tenant boundary, required transaction/atomicity invariant, or previously guaranteed behavior.
- **Medium** — a real localized correctness, engineering-contract, or required-verification issue that does not currently create a High-impact violation.
- **Low** — maintainability, clarity, hardening, or non-blocking verification improvement.

Do not increase severity solely because a theoretical failure mode is possible in a production environment.

When this skill is used for final version acceptance:

- `Critical` and `High` findings block completion.
- `Medium` blocks completion only when it directly violates canonical completion criteria or required verification evidence.
- Non-blocking `Medium` and `Low` findings may be documented and deferred.
- Zero findings is not required for version completion.

For every finding, provide:

- file and location;
- violated requirement, data rule, or engineering rule;
- why it matters;
- the smallest compliant remediation direction.

If no finding exists, state that clearly.

Also report:

- what was reviewed;
- what verification evidence was available;
- what could not be verified.

Do not praise unaffected code or provide a generic summary instead of findings.
