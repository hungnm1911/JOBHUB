# Backend Agent Contract

This file applies to all work under `backend/` and supplements the repository-level [`AGENTS.md`](../AGENTS.md).

## Canonical architecture contract

Before any significant backend modification, read:

- [`../docs/engineering/architecture.md`](../docs/engineering/architecture.md)
- [`../docs/engineering/backend-conventions.md`](../docs/engineering/backend-conventions.md)
- [`../docs/engineering/source-of-truth.md`](../docs/engineering/source-of-truth.md)

These engineering documents are the canonical backend architecture contract. Follow their distinction between current state and target convention.

## Task-specific canonical context

For backend work that implements or changes V1 behavior, read all of the following before planning or editing:

- [`../docs/product/versions/v01-account-authentication.md`](../docs/product/versions/v01-account-authentication.md)
- [`../docs/data/versions/v01-authentication-data-model.md`](../docs/data/versions/v01-authentication-data-model.md)
- [`../docs/engineering/architecture.md`](../docs/engineering/architecture.md)
- [`../docs/engineering/backend-conventions.md`](../docs/engineering/backend-conventions.md)
- [`../docs/engineering/source-of-truth.md`](../docs/engineering/source-of-truth.md)

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

The gate currently runs ESLint and deterministic architecture verification. When automated tests are introduced, extend the canonical command as appropriate so agents do not need to remember another independent final gate. Passing this command does not verify business behavior without relevant tests or prove MongoDB, Cloudinary, SMTP, or other external-service runtime behavior; claim those checks only when they were actually performed.
