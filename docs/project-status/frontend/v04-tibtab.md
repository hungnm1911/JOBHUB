# Frontend V04 Tiptap Project Status

## Current project state

V04 has Slices 01–03 (F01 editor, F02 toolbar/presets, F03 viewer/sanitization)
and Slice 04 (F04 standalone preview) implemented with focused Node tests.
Browser acceptance and version-level completion are pending. There is no
formal BR/PT/TX specification for this technical Rich Text track.

## Deferred / not started

Job/CV forms, Backend, DB, PDF, and AI Kit integration remain deferred.
Interactive browser acceptance and the full frontend verification gate have
not been performed for this track.

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

### Slice 04 — Standalone preview and acceptance preparation (F04)

The development-only `/rich-text-preview` route composes the existing Editor
and Viewer without Job/CV forms, API calls, realtime, or persistence. It exposes Full and
Minimal presets, live HTML value and Viewer output, reset, manually supplied
HTML, a hostile HTML sample, and a legacy plain-text sample. Switching presets
clears the Editor document. External HTML input remains visible separately from
the Editor's serialized HTML immediately after loading; the Viewer uses that
serialized value. The focused preview test exercises this round trip, Editor →
HTML → Viewer, preset switching, reset, unsafe input, literal plain-text display,
and lazy development routing. The production route entry excludes Preview.

Observed frontend handoff for future Job/CV integration: `onChange(html)` emits
an HTML string; a visually empty editor emits `''` (the underlying Tiptap
document may serialize as `<p></p>`). The Minimal schema does not retain
Full-only headings or text styles. Viewer callers must pass `format="html"`
or `format="plain"` explicitly; plain text is displayed literally with line
breaks. HTML rendering passes through the preset-aware sanitizer, which keeps
supported formatting and removes unsafe tags, attributes, CSS, and URLs.
These observations do not define a Backend storage/API contract or authorize
automatic format detection for legacy records.

## Verification status

- `cd frontend && yarn test:rich-text` — 28 focused F01–F04 tests passed, including external HTML serialization without fake `onChange` or equivalent-document selection loss, and development-only lazy routing absent from the production entry.
- `cd frontend && yarn eslint src/components/common/RichTextEditor.jsx src/pages/RichTextPreviewPage.jsx src/routes/public.routes.jsx src/utils/constant.js test/rich-text-editor.test.js test/rich-text-preview.test.js` — targeted lint passed.
- `cd frontend && yarn build` — passed; Vite reported a non-failing large-chunk warning. The production entry omits Preview, but Vite emits an unreferenced Preview chunk.
- `git diff --check` — passed.
- `yarn verify:agent` and the full gate — not run per task scope. Interactive browser acceptance remains unverified because no browser executable was available in this environment. Live provider checks were not run.
