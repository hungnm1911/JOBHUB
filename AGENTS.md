# Repository Agent Contract

This file applies to the entire repository. More specific `AGENTS.md` files apply within their directory scope and supplement or override this file for that scope.

## Working rules

- Inspect the relevant existing implementation before modifying code.
- Search for existing implementations and canonical owners before creating an abstraction.
- Treat repository documentation as authoritative over assumptions from chat history.
- Preserve one source of truth; reuse or extend canonical owners instead of creating parallel implementations.
- Make the smallest coherent change required by the task.
- Avoid unrelated refactors or cleanup.
- Do not install or remove production dependencies without explicit approval.
- Do not silently change product requirements or architectural decisions. Report conflicts or required decisions before implementation.
- Do not claim that tests, lint, builds, or other verification passed unless the stated commands were actually executed successfully.
- Report skipped, unavailable, or failed verification honestly, including the relevant reason or failure.

## Verification

- After material implementation changes, run the applicable official verification command when one exists.
- Verification claims must correspond to commands actually executed.
- Passing verification for one repository area does not automatically verify a task outside that area; in particular, backend verification does not verify frontend or other non-backend work.

## Documentation governance

- [`docs/product/roadmap.md`](docs/product/roadmap.md) is the canonical high-level product roadmap.
- Detailed business requirements are canonical only in approved files under `docs/product/versions/`.
- Do not implement a version from its roadmap title alone or invent requirements for a version without an approved specification.
- Before planning or editing a change to business behavior, read the relevant approved version specification.
- When an approved product specification exists, existing source code is not the source of truth for product requirements.
- Technical and data design must not silently redefine business requirements.
- If code, data documentation, engineering documentation, and product requirements conflict, report the conflict before modifying behavior.
