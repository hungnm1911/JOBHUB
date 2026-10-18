# Backend Agent Contract

This file applies to all work under `backend/` and supplements the repository-level [`AGENTS.md`](../AGENTS.md).

## Canonical architecture contract

Before any significant backend modification, read:

- [`../docs/engineering/architecture.md`](../docs/engineering/architecture.md): its `Purpose` and the `Backend …` sections only; the `Frontend …` sections do not apply to backend work
- [`../docs/engineering/backend-conventions.md`](../docs/engineering/backend-conventions.md)
- [`../docs/engineering/source-of-truth.md`](../docs/engineering/source-of-truth.md), using the lookup protocol below instead of reading the whole file

These engineering documents are the canonical backend architecture contract. Follow their distinction between current state and target convention.

### Looking up owners in `source-of-truth.md`

The ownership table is about 135 KB, one row per line, and grows with every slice. Do not read it in full.

1. Read only `Purpose` and `Consumption rules` (the top of the file and the short section after the table).
2. Inspect the existing implementation first, then search the table with `rg -n` using the file paths and basenames you found plus the concept words from the task. Match the first two columns (`Responsibility`, `Canonical owner`), for example ``rg -in "^\|([^|]*\|)?[^|]*location" docs/engineering/source-of-truth.md``; the other columns are for confirming a row you already selected.
3. A version tag such as `V4.1` or `Slice 04` in a row is a pointer to the matching spec, data model, and status leaf, not a filter that excludes owners from other versions. If a broad keyword returns many rows, narrow it by owner path instead of reading them all.
4. Open `Current known mismatches` only when the change touches a file or layer it names.
5. The table can lag the code. If no row matches a responsibility the code already implements, report the missing row instead of assuming there is no owner; if neither code nor table has an owner, treat the responsibility as new and follow the working rules below.

## Task-specific canonical context

For backend work that implements or changes V1 behavior, read all of the following before planning or editing:

- [`../docs/product/backend/versions/v01-account-authentication.md`](../docs/product/backend/versions/v01-account-authentication.md)
- [`../docs/data/backend/versions/v01-authentication-data-model.md`](../docs/data/backend/versions/v01-authentication-data-model.md)
- [`../docs/engineering/architecture.md`](../docs/engineering/architecture.md) (sections as above)
- [`../docs/engineering/backend-conventions.md`](../docs/engineering/backend-conventions.md)
- [`../docs/engineering/source-of-truth.md`](../docs/engineering/source-of-truth.md) (lookup protocol above)

Each canonical document is authoritative only for its own concern:

- The product specification defines required business behavior and version boundaries. Do not add, remove, or change that behavior without an explicitly approved requirement change.
- The data contract defines persistence requirements that support the business behavior; it must not redefine the product specification.
- The engineering documents define architecture, ownership, layer boundaries, and code conventions; they must not redefine product behavior.
- Source code is the current implementation and must be inspected before changes, but existing behavior is not automatically canonical when it conflicts with an approved product, data, or engineering contract.

If canonical documents genuinely contradict one another, do not guess or silently reconcile them. Stop before implementation and report the conflict for human decision.

Before a significant V1 backend change, state:

1. the affected functional requirements, such as F01 or F02;
2. the relevant business rules, when applicable;
3. the affected persistence entities;
4. the affected canonical engineering owners; and
5. a short implementation plan.

## Working rules

- Identify the canonical owner of every responsibility affected by the task.
- Search the backend for an existing implementation before creating a config, client, constant, utility, middleware, model, service, controller, route, or other abstraction.
- Reuse or extend the canonical owner instead of creating a parallel implementation.
- Preserve the documented layer and dependency boundaries.
- Treat items under **Current known mismatches** as technical debt, not patterns to copy.
- Do not opportunistically fix unrelated known mismatches unless the current task explicitly requires it.
- Do not introduce a repository layer or change architectural ownership without explicit approval.
- If a task appears to conflict with the documented architecture, stop before implementation and report the conflict.
- For non-trivial changes, provide a short plan before editing.
- After implementation, inspect the final diff for architecture violations and unrelated changes.

## Verification

For material backend code, configuration, or tooling changes, run focused tests and checks when they exist, then run the common backend gate before declaring the task successfully verified:

```sh
cd backend && npm run verify:agent
```

The gate runs ESLint, deterministic architecture verification, and the Vitest suite (see the `verify:agent` script in `backend/package.json`). New automated tests and checks join this command so agents do not need to remember another independent final gate. Passing this command does not verify business behavior without relevant tests or prove MongoDB, Cloudinary, SMTP, or other external-service runtime behavior; claim those checks only when they were actually performed.
