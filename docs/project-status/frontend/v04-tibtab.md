# Frontend V04 Tiptap Project Status

## Current project state

V04 has Slice 01 (F01 core editor) implemented. No version-level completion or
acceptance is claimed. There is no formal BR/PT/TX specification for this
technical Rich Text track.

## Deferred / not started

Toolbar, Viewer, Job/CV forms, Backend, DB, PDF, and AI Kit integration remain
outside the implemented Slice 01. Browser acceptance and the full frontend
verification gate have not been performed for this track.

## Implementation record (slice detail)

### Slice 01 — Core editor (F01)

The reusable `RichTextEditor` component accepts `value`, `onChange(html)`,
`disabled`, `placeholder`, and `preset` (`full` or `minimal`). It has no screen,
route, actor, API, realtime, or persistence integration. F01-EMPTY-01 empty HTML
normalization is covered by focused regression tests.

## Verification status

- `cd frontend && node --test test/rich-text-editor.test.js` — passed (8 focused tests, including F01-EMPTY-01 regression).
- `cd frontend && yarn eslint src/components/common/RichTextEditor.jsx test/rich-text-editor.test.js` — passed before F01-EMPTY-01; not rerun after this fix.
- `yarn verify:agent`, full gate, and live provider checks — not run, per task scope.
