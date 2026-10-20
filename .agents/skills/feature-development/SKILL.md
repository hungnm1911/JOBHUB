---
name: feature-development
description: Implement or materially change an approved product feature. Use for feature work that must trace business requirements, persistence effects, canonical engineering owners, implementation, verification, and project-state updates.
---

# Feature Development

## Phase 1 — Context and scope

Before editing, work in this order so cheap checks can end the task early:

1. Read the applicable `AGENTS.md` files.
2. **Triage with project status.** Read `docs/project-status/index.md` and follow its "Reading a status leaf" rules. Status never overrides Product, Data, or Engineering documents. If the version has no mapped leaf, treat it as not started; do not search other leaves for it.
   - If the requested slice or behavior is already recorded as implemented and verified, confirm quickly against the code and its tests (file existence, test titles) and stop to report that and ask how to proceed. Do not read the full specification first.
   - Otherwise note what is deferred and what earlier slices already own.
3. Inspect the existing implementation and the focused tests that already cover it. Search for existing canonical owners and reusable implementations.
4. Read the relevant approved product version specification, by section (see the root `AGENTS.md`), whenever the task implements or changes business behavior.
5. Read the relevant data contract by section when persistence or a data-defined contract is involved. A slice with no persistence change still reads the data-contract section that defines the shapes or relationships it relies on.
6. Read the relevant engineering documents, scoped by `backend/AGENTS.md`, `frontend/AGENTS.md`, or `ai-kit/AGENTS.md`. For backend owners, search `source-of-truth.md` with the lookup protocol there instead of reading it in full. For AI Kit owners, search `docs/engineering/ai-kit-source-of-truth.md` by responsibility, concept, and discovered path, then read only the relevant sections of `docs/engineering/architecture.md` and `docs/engineering/ai-kit-conventions.md`.

Route Backend business versions and Frontend work that consumes their contracts through `docs/product/backend/roadmap.md`, approved Product Specifications under `docs/product/backend/versions/`, and approved Data Contracts under `docs/data/backend/versions/`.

Treat `ai-kit/` as an implementation area alongside Backend and Frontend:

- Read `ai-kit/AGENTS.md` for AI Kit work and use the AI Kit leaf mapped by `docs/project-status/index.md` for current implementation and verification state.
- Apply both scoped contracts when work spans Backend and AI Kit; neither area's rules or verification replace the other's.
- Classify the AI Kit task before implementation. Infrastructure, tooling, test, or documentation maintenance may proceed from approved Engineering authority when it does not create or change business behavior or a data-defined contract.
- An AI business capability requires an approved scope/version in `docs/product/ai-kit/roadmap.md`, the matching approved Product Specification under `docs/product/ai-kit/versions/`, and the matching approved Data Contract under `docs/data/ai-kit/versions/`. If any authority is absent, stop before implementation and report the exact missing document or decision; do not infer that a missing Data Contract is unnecessary.
- When a task spans Backend and AI Kit, use the AI Kit Product/Data authority for the AI capability and also read the canonical Backend Product/Data authority under `docs/product/backend/versions/` and `docs/data/backend/versions/` whenever the task checks or changes Backend domain behavior. Preserve one business definition for existing domain concepts such as `CandidateCV`, `Job`, and their relationships; AI Kit must not redefine their canonical semantics.
- Maintenance of the existing Gemini-to-Groq fallback is Engineering work and does not require an AI version specification unless it changes business behavior or a data-defined contract. Implementing an AI version for CV–Job scoring is business-capability work and must stop if its AI Kit roadmap approval, Product Specification, or Data Contract is missing.
- AI #1/#2/#3 overview or architecture direction is not an approved version. Do not invent business rules, matching weights, AI output schemas, or persistence semantics from it.

For V1 work, identify explicitly:

- affected Fxx requirements;
- affected BR-xx rules;
- affected persistence entities;
- affected canonical engineering owners.

For frontend work, also identify the affected screens, routes, and actor roles, and the consumed API endpoints and realtime events.

Do not begin implementation when the business specification required for the affected behavior is missing.

## Phase 2 — Planning

Produce a short implementation plan before significant editing. Identify:

- files expected to change;
- existing code to reuse or extend;
- business behavior being implemented;
- persistence effects;
- tests and checks required;
- known architecture mismatches that affect the task.

Do not include unrelated cleanup. If canonical documents conflict, stop and report the conflict.

## Phase 3 — Implementation

- Make the smallest coherent change that implements the approved behavior.
- Extend canonical owners instead of creating parallel implementations.
- Preserve layer boundaries.
- Do not invent additional product behavior.
- Do not opportunistically fix unrelated technical debt.
- Do not change architecture ownership without explicit approval.

## Phase 4 — Verification

After implementation:

1. Run focused checks and tests available for the affected behavior.
2. For backend work, run the common backend verification gate:
   ```sh
   cd backend && npm run verify:agent
   ```
   For frontend work, run the common frontend verification gate:
   ```sh
   cd frontend && yarn verify:agent
   ```
   For AI Kit work, run the canonical offline AI Kit gate:
   ```sh
   cd ai-kit
   npm run verify:agent
   ```
   If AI Kit work changes Backend integration or Backend behavior, also run the common backend gate. Work that spans multiple implementation areas must pass every affected area's gate.
   Manual live provider smoke is opt-in, may consume quota, and is not part of the offline gate or a default feature-task check:
   ```sh
   cd ai-kit
   npm run smoke:gemini
   npm run smoke:groq
   ```
   For documentation-only work, check references and consistency and run `git diff --check`; full code gates are not required by default.
3. Inspect the final diff.
4. Check for:
   - architecture violations;
   - duplicate sources of truth;
   - unrelated changes;
   - missing required behavior;
   - behavior added without requirement authority.

Never claim a command passed unless it actually ran successfully. What each gate covers is defined by the application's `AGENTS.md` and `package.json` scripts, not by this skill; a gate does not prove business behavior without relevant focused tests or, for frontend, an actually performed browser check. New automated tests and architecture checks should become part of the corresponding common gate. Report exactly which checks were available and executed.

## Phase 5 — Project state

After successful implementation and verification:

- Determine whether the answer to “Where is the project currently?” changed.
- If project-level state changed, update only the affected status leaf mapped by `docs/project-status/index.md`. Revise in place as the index's "Reading a status leaf" rules describe.
- If the version has no leaf yet, create one in the matching application directory following the filename pattern of the most recent leaf there, and add it to the index (the only case where the index changes besides moves/renames).
- Keep generic backend gates and cross-version operational state in `docs/project-status/backend/platform-and-operations.md`.
- For an implemented AI Kit capability, update the mapped AI Kit status leaf with implementation and verification evidence. Do not create a status leaf or specification for an unapproved AI version merely because roadmap or overview material mentions AI #1/#2/#3.
- If AI Kit work creates, moves, or changes a canonical owner, update `docs/engineering/ai-kit-source-of-truth.md` and the affected Engineering contracts according to their governance. Project status records evidence and must not define business semantics.
- Do not mark a feature completed while implementation or required verification remains incomplete.
- Do not update project-status files for formatting, typo, import-only, comment-only, or other state-neutral changes.

## Final report

Report:

- requirements implemented;
- files changed;
- checks actually run;
- verification results;
- remaining limitations or risks;
- whether a project-status leaf or the index was updated and why.
