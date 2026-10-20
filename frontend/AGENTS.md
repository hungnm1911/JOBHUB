# Frontend Agent Contract

This file applies to all work under `frontend/` and supplements the repository-level [`AGENTS.md`](../AGENTS.md).

## Canonical architecture contract

Before any significant frontend modification, read:

- [`../docs/engineering/architecture.md`](../docs/engineering/architecture.md): its `Purpose` and the `Frontend …` sections only; the `Backend …` sections do not apply to frontend work
- [`../docs/engineering/frontend-conventions.md`](../docs/engineering/frontend-conventions.md)
- [`../docs/engineering/frontend-source-of-truth.md`](../docs/engineering/frontend-source-of-truth.md)

These engineering documents are the canonical frontend architecture contract. Follow their distinction between current state and target convention.

## Canonical visual design contract

Before planning or editing frontend presentation, read the relevant sections of
[`../docs/engineering/frontend-design-contract.md`](../docs/engineering/frontend-design-contract.md).
It is the approved visual baseline, including component reuse rules and the
Company Preview pilot reference. Preserve its `[Chuẩn]`, `[Đo]`, and
`[Ngoài scope]` distinctions; baseline approval alone does not authorize a UI
implementation or override Product/Data/API and architectural authority.

## Task-specific canonical context

For frontend work that implements or changes the client behavior of a product version, read all of the following before planning or editing:

- the approved product specification for that version under [`../docs/product/backend/versions/`](../docs/product/backend/versions/);
- the backend routes, controllers, and response/error shapes of every endpoint or realtime event the change consumes;
- the matching data contract under [`../docs/data/backend/versions/`](../docs/data/backend/versions/) only when field semantics are needed to present or submit data;
- [`../docs/engineering/architecture.md`](../docs/engineering/architecture.md) (sections as above);
- [`../docs/engineering/frontend-conventions.md`](../docs/engineering/frontend-conventions.md); and
- [`../docs/engineering/frontend-source-of-truth.md`](../docs/engineering/frontend-source-of-truth.md).

Each canonical document is authoritative only for its own concern:

- The product specification defines required business behavior, actors, and version boundaries. Do not add, remove, or change that behavior, including screens, roles, statuses, or flows, without an explicitly approved requirement change.
- The backend implementation is the current API contract for paths, payloads, response bodies, error codes, and realtime events. It does not override the product specification; a conflict between them must be reported, not silently absorbed by client code.
- The data contract defines persistence. It must not be treated as the API response shape or as authority for client-side business rules.
- The engineering documents define architecture, ownership, layer boundaries, and code conventions; they must not redefine product behavior.
- Source code is the current implementation and must be inspected before changes, but existing behavior is not automatically canonical when it conflicts with an approved product, API, or engineering contract.

If canonical documents genuinely contradict one another, do not guess or silently reconcile them. Stop before implementation and report the conflict for human decision.

Before a significant frontend change, state:

1. the affected functional requirements, such as F01 or F02;
2. the relevant business rules, when applicable;
3. the affected screens, routes, and actor roles;
4. the consumed API endpoints and realtime events;
5. the affected canonical frontend owners; and
6. a short implementation plan.

## Working rules

- Identify the canonical owner of every responsibility affected by the task.
- Search the frontend for an existing implementation before creating a constant, API module, socket handler, route group, guard, layout, page, feature service, hook, slice, component, primitive, helper, validator, schema, or other abstraction.
- Reuse or extend the canonical owner instead of creating a parallel implementation.
- Preserve the documented layer and dependency boundaries.
- Keep exactly one browser router, Redux store, configured Axios client, Socket.IO client, `<Toaster />`, and `VITE_*` reader.
- Treat route guards and client validation as user-experience aids only; never describe them as security controls or rely on them instead of backend authorization.
- Do not hard-code roles, statuses, catalogs, or business rules that are not backed by the approved product specification and the backend contract.
- Treat empty scaffolds as structure, not implemented behavior.
- Treat items under **Current known mismatches** as technical debt, not patterns to copy.
- Do not opportunistically fix unrelated known mismatches unless the current task explicitly requires it.
- Adding a shadcn/ui component or any other package that changes `package.json` dependencies requires explicit approval, per the repository-level contract.
- Do not introduce a new architectural layer, a server-state library, or change architectural ownership without explicit approval.
- If a task appears to conflict with the documented architecture, stop before implementation and report the conflict.
- For non-trivial changes, provide a short plan before editing.
- After implementation, inspect the final diff for architecture violations and unrelated changes.

## Primer Design Reference Policy

For new screens or significant UI redesigns:

1. Read the canonical JOBHUB Design Contract.
2. Before choosing layout and components, consult
   the relevant Primer patterns through Primer MCP.
3. Use `list_patterns`/`get_pattern` for UX structure,
   forms, navigation, disclosure and data presentation.
4. Consult component usage, typography and color
   guidelines when making visual decisions.
5. Apply Impeccable to design the screen using
   those patterns and JOBHUB's visual identity,
   when available.
6. Implement using existing React/shadcn components,
   not Primer React.
7. Briefly explain chosen patterns and why they fit.
8. Do not copy Primer's tokens, palette or branding.
9. Never introduce business states or actions
   without canonical product authority.

Do not consult every Primer pattern unnecessarily.
Use only guidance relevant to the current screen.


## Verification

For material frontend code, configuration, or tooling changes, run focused checks when they exist, then run the common frontend gate before declaring the task successfully verified:

```sh
cd frontend && yarn verify:agent
```

The gate runs the focused authentication Node tests, ESLint, and the Vite production build (see the `verify:agent` script in `frontend/package.json`). No browser-oriented test harness or deterministic architecture verification exists yet; when either is introduced, extend the canonical command so agents do not need to remember another independent final gate. Passing this command proves the focused authentication behavior, lint rules, module resolution, and bundling only. It does not verify other business behavior, rendering, accessibility, or integration with the running backend; claim a browser or end-to-end check only when it was actually performed.

Frontend verification does not verify backend work, and backend verification does not verify frontend work. A change that spans both applications must pass both gates.
