# Frontend V04 Tiptap Project Status

## Current project state

V04 has Slice 01 (F01 core editor) and Slice 02 (F02 toolbar and presets)
implemented with focused Node tests. No version-level completion or acceptance
is claimed. There is no formal BR/PT/TX specification for this technical Rich
Text track.

## Deferred / not started

Viewer, Job/CV forms, Backend, DB, PDF, and AI Kit integration remain deferred.
Browser acceptance and the full frontend verification gate have not been
performed for this track.

## Implementation record (slice detail)

### Slice 01 — Core editor (F01)

The reusable `RichTextEditor` component accepts `value`, `onChange(html)`,
`disabled`, `placeholder`, and `preset` (`full` or `minimal`). It has no screen,
route, actor, API, realtime, or persistence integration. F01-EMPTY-01 empty HTML
normalization is covered by focused regression tests.

### Slice 02 — Toolbar and presets (F02)

`RichTextToolbar` is composed by the reusable editor. The `full` preset provides
H1–H3, bold/italic/underline, bullet/numbered lists, links, alignment, font
family/size, color, highlight, and undo/redo. The `minimal` preset provides
bold/italic/underline, lists, links, and undo/redo. Toolbar controls follow the
preset's Tiptap extension/schema configuration; the editor retains F01 value,
empty, disabled, and selection behavior. There is no screen, route, actor, API,
realtime, or persistence integration in this slice.
Focused F02 acceptance fixes now cover `rgb(...)` color picker display and
inline feedback when a link command rejects a URL, including recovery on retry.

## Verification status

- `cd frontend && node --test test/rich-text-editor.test.js` — 14 focused F01/F02 tests passed, including color HTML round-trip, rejected link retry, active state, selection, and preset isolation.
- `cd frontend && yarn eslint src/components/common/RichTextToolbar.jsx test/rich-text-editor.test.js` — focused lint for this fix passed.
- `cd frontend && yarn eslint src/components/common/RichTextEditor.jsx src/components/common/RichTextToolbar.jsx test/rich-text-editor.test.js` — focused lint passed.
- `yarn verify:agent`, full gate, browser acceptance, and live provider checks — not run, per task scope.
