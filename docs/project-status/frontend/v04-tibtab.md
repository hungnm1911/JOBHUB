# Frontend V04 Tiptap Project Status

## Current project state

V04 has Slice 01 (F01 core editor), Slice 02 (F02 toolbar and presets), and
Slice 03 (F03 viewer and HTML sanitization) implemented with focused Node tests.
No version-level completion or acceptance is claimed. There is no formal
BR/PT/TX specification for this technical Rich Text track.

## Deferred / not started

Job/CV forms, Backend, DB, PDF, and AI Kit integration remain deferred.
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

### Slice 03 — Viewer and HTML sanitization (F03)

`RichTextViewer` accepts explicit `format="html"` or `format="plain"` input and
the F02 `full`/`minimal` preset. HTML uses DOMPurify plus tag, attribute, CSS
property/value, and URL allowlists; new-tab links receive safe `rel` values.
Plain text renders literally with line breaks. Shared theme-token CSS keeps
Editor and Viewer typography, list, link, and highlight presentation aligned.
This slice has no screen, route, actor, API, realtime, or persistence integration.
Focused F03 acceptance fixes preserve valid ordered-list `start`/`type` markers
and align Editor link entry, paste, autolink, and reload with the Viewer URL
allowlist. Viewer sanitization remains the rendering boundary.

## Verification status

- `cd frontend && yarn test:rich-text` — 25 focused F01/F02/F03 tests passed, including ordered-list and URL Editor → Viewer regressions for both presets, paste/autolink, and Viewer URL sanitization.
- `cd frontend && yarn eslint src/lib/sanitize-rich-text.js src/components/common/RichTextEditor.jsx src/components/common/RichTextToolbar.jsx src/components/common/RichTextViewer.jsx test/rich-text-editor.test.js test/rich-text-viewer.test.js` — focused lint passed.
- `git diff --check` — passed.
- `yarn verify:agent`, full gate, browser acceptance, and live provider checks — not run, per task scope.
