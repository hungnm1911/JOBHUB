---
name: bugfix
description: Investigate and fix bugs, regressions, incorrect behavior, and failing tests at their root cause. Use when broken behavior requires evidence, regression protection, a canonical-owner fix, verification, and an honest risk report.
---

# Bugfix

## Phase 1 — Investigation

Before editing:

1. Read the applicable `AGENTS.md` files.
2. Read the canonical product, data, and engineering documents relevant to the failing behavior, by section (see the root `AGENTS.md`): the Fxx and BR-xx sections that govern the failing behavior, not whole specifications.
3. Inspect the current implementation.
4. Reproduce the bug when practical, or trace the exact failing path when reproduction is unavailable.
5. Explain:
   - expected behavior;
   - actual behavior;
   - execution path;
   - root-cause hypothesis;
   - evidence supporting the hypothesis.
6. Identify the canonical owner of the broken responsibility. For backend owners, search `source-of-truth.md` with the lookup protocol in `backend/AGENTS.md` instead of reading it in full.
7. Search for duplicate implementations, bypasses, or local workarounds.
8. Optionally check whether the bug is already recorded: after identifying the affected application/version, search that one mapped status leaf by keyword (endpoint, entity, symptom). Do not otherwise read project status during investigation; it is not evidence of expected behavior.

Do not begin by guessing a patch or patching only the symptom.

## Phase 2 — Regression protection

When practical:

1. Add or identify a regression test or check that represents the bug.
2. Confirm that it fails for the expected reason before relying on it as regression evidence.
3. Do not weaken assertions or remove behavior merely to make tests pass.

## Phase 3 — Fix

- Fix the canonical owner instead of patching every consumer.
- Limit the change to the root cause and necessary integration points.
- Reuse existing configuration, constants, helpers, models, services, and clients.
- Do not introduce a second source of truth.
- Avoid unrelated refactoring.

If the root cause cannot safely be fixed within the current task:

- do not hide that fact;
- isolate any approved workaround;
- report the limitation and required follow-up.

## Phase 4 — Verification

Run:

1. the regression check or test;
2. affected checks and tests;
3. for backend bugs, the common backend verification gate:
   ```sh
   cd backend && npm run verify:agent
   ```
   For frontend bugs, the common frontend verification gate:
   ```sh
   cd frontend && yarn verify:agent
   ```
   A fix spanning both applications runs both gates. For other areas, run repository verification when available;
4. a final diff review.

Regression evidence remains separately required. Passing a common verification gate is not a substitute for reproducing the bug and protecting against its recurrence. Report failures honestly.

## Phase 5 — Project state

If the bug materially changes project-level status:

- read `docs/project-status/index.md` and follow its "Reading a status leaf" rules for the one affected leaf;
- update that leaf after verification, in place;
- remove or revise the corresponding recorded issue only when the fix is verified.

Update the index only when status files are added, moved, or renamed. Keep generic backend gates and cross-version operational state in `docs/project-status/backend/platform-and-operations.md`.

Do not rewrite project history.

## Final report

Report:

- root cause;
- canonical owner fixed;
- files changed;
- regression evidence;
- commands actually executed;
- verification results;
- remaining risk;
- project-status change, if any.
