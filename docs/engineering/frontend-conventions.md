# Frontend Engineering Conventions

## Scope

These conventions apply to code under `frontend/`. They define the target
architecture for new frontend work and changes to existing frontend work.

They do not claim that every planned frontend capability already exists. The
current implementation is described in [`architecture.md`](architecture.md),
and an empty scaffold must not be treated as implemented behavior. Canonical
owners and audited deviations are recorded in
[`frontend-source-of-truth.md`](frontend-source-of-truth.md) and must not be
copied merely because they already exist.

Product specifications under `docs/product/versions/` remain authoritative for
business behavior. These conventions define code ownership and dependency
boundaries; they must not invent or silently redefine product rules.

## Terminology

- **Must** or **must not** identifies a required architectural rule.
- **Current state** describes observed repository behavior.
- **Target convention** describes the intended rule even when current code differs.
- **Canonical owner** is the one module responsible for a concern. Other modules may consume it but must not recreate it.
- **Feature** is a cohesive client-side business capability, not merely a folder or a screen.
- **Primitive** is a domain-neutral UI building block such as a button, input, dialog, or table.

## File and symbol naming

### Files

- React component, page, layout, and route-guard filenames must use PascalCase with `.jsx`.
- Route-group modules must use `<name>.routes.jsx`.
- Resource HTTP modules must use `<name>.api.js`.
- Form and payload schema modules under `src/validation/` must use a descriptive `<scope>.schema.js` name.
- Reusable validator collections under `src/validation/` must use a descriptive `<scope>.validators.js` name.
- General non-component JavaScript files should use descriptive lowercase or kebab-case names.
- `index.js` or `index.jsx` is reserved for a real public facade or composition entry point. It must not hide unrelated ownership behind a generic barrel.
- A feature may use the conventional names `slice.js` and `utils.js` when those files have real content and one clear owner.
- Empty directories must not be created speculatively. An explicitly requested scaffold may use `.gitkeep`, but it does not establish implemented behavior.

Examples:

```text
HomePage.jsx
RootLayout.jsx
ProtectedRoute.jsx
public.routes.jsx
authentication.api.js
constant.js
```

### Symbols

- React components use Pascal case.
- Functions, hooks, variables, and object fields use camel case.
- Custom hooks begin with `use` and obey the Rules of Hooks.
- Enum-like immutable objects and module-level constants use upper snake case when they represent a closed vocabulary.
- Names identify the owned responsibility rather than only an implementation detail.
- Frontend role, status, and event literals must have one client-side owner aligned with the approved backend/API contract; they must not be reproduced ad hoc across screens.

## Application composition

### Entry point

`frontend/src/main.jsx` is the browser entry point. It owns:

- importing application-global styles;
- creating the React root;
- composing application-wide providers such as the Redux `Provider`; and
- mounting the root application component.

It must not own feature routing, business workflows, API calls, socket event
handling, or feature state initialization beyond provider composition.

### Root application

`frontend/src/App.jsx` owns the top-level application composition beneath the
providers. The current application renders the single `RouterProvider` and the
single Sonner `<Toaster />`.

`App.jsx` must remain small. Feature pages, layouts, data loading, route groups,
and business state must stay with their canonical owners.

### Transient feedback toasts

Sonner is the application toast library for immediate, non-persisted feedback
about a user action, such as a save succeeding or a request failing.

- `App.jsx` mounts the single `<Toaster />` by spreading `TOASTER_CONFIG` from `src/utils/constant.js`. Another `<Toaster />` must not be mounted elsewhere, and props must not be added inline in `App.jsx`.
- `TOASTER_CONFIG` is the application-wide default contract, not sample data: top-right position, light theme, rich success/error/warning/info colors, a close button, 4,000 ms duration, three visible toasts, 24 px desktop and 16 px mobile offsets, Vietnamese accessible labels, and neutral toasts mapped to the `--popover`, `--popover-foreground`, `--border`, and `--radius` theme tokens with the inherited application font.
- Default behavior changes are made only in `TOASTER_CONFIG`; colors change through the theme tokens in `src/styles/globals.css`. When a dark theme is introduced, `TOASTER_CONFIG.theme` must follow the same theme owner.
- Components and feature hooks that handle an event or request outcome import `toast` directly from `sonner` and need no further setup: `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`, `toast.loading()`, and `toast.promise()` all use the defaults.
- Per-call options such as `description`, `duration`, `action`, or a stable `id` (to replace or de-duplicate a toast) are passed only when one call has a real need; they must not be used to restyle toasts ad hoc.
- For a failed request, the owning component or hook shows `ApiError.message`, or a feature-specific message when an approved error code requires one.
- A wrapper or helper around Sonner is introduced only when a repeated handling rule exists, consistent with the library-integration rule below.
- API modules, the shared HTTP/socket clients, Redux slices, and validation modules must not trigger toasts.
- Toasts are not the JOBHUB Notification feature. Persisted, recipient-owned business notifications, their read state, and their realtime delivery belong to the Notification feature defined by the approved product specification; Sonner must not replace or simulate them.

### Dependency direction

The normal frontend dependency direction is:

```text
main -> application providers -> router
router -> route groups -> guards/layouts/pages
layouts -> common components + Outlet
pages -> feature components + common components + UI primitives
features -> API modules / socket facade / store hooks / validation
store composition -> feature-owned slice reducers
UI primitives -> lib integration helpers
```

Not every feature must use every layer. A layer is added only when it has an
actual responsibility.

## Folder and layer rules

### HTTP APIs

`frontend/src/apis/` is the HTTP transport boundary.

`frontend/src/apis/client/` must own:

- the single configured Axios instance;
- base URL and transport timeout configuration;
- cross-cutting request/response interceptors; and
- normalized API errors through the canonical `ApiError` contract.

Resource or module API files must:

- use the shared client rather than importing Axios directly;
- use the `<name>.api.js` naming convention;
- declare endpoint functions grouped by coherent backend resource or module;
- accept explicit values rather than React components, events, or router objects; and
- remain free of JSX, complete UI workflows, route declarations, and Redux reducer logic.

API modules must not:

- create another Axios instance;
- own screen state or toast/navigation behavior;
- duplicate backend authorization or business invariants; or
- become feature service substitutes merely because they call HTTP.

### Realtime socket

`frontend/src/socket/` is the shared realtime transport boundary.

- `src/socket/index.js` owns the single Socket.IO client, URL/configuration, connection lifecycle, and handshake authentication mechanism.
- Realtime event-name constants are owned by `REALTIME_EVENT` in `src/utils/constant.js` and must remain aligned with the backend transport contract (`backend/src/constants/realtime-event.js`). Feature listeners import them from `@/utils/constant`.
- The shared socket must use lazy connection when no authenticated workflow requires an immediate connection.
- Feature-specific subscribe/unsubscribe behavior and event interpretation belong to the owning feature.
- Shared socket modules must not contain page UI, feature reducers, or the complete business response to Notification, Message, or Conversation-state events.
- Realtime events are hints for timely updates, not a durable source of truth. Features must use canonical HTTP reads to resynchronize durable/current state when required.
- Disconnect/logout handling must clear client authentication material without inventing persisted delivery, presence, or read state.

### Routes

`frontend/src/routes/` is the sole routing composition boundary.

- `src/routes/index.jsx` composes route groups and creates the single browser router.
- Child `*.routes.jsx` files declare routes for a coherent area or module.
- Route declarations may reference guards, layouts, and pages, but must not contain complete layout markup or business HTTP workflows.
- Nested routes and `Outlet` should be used when routes share a real layout or guard boundary.
- Routes must not be split into files solely to pre-create hypothetical modules.

Route guards have these responsibilities:

- `ProtectedRoute` redirects users who do not have resolved authenticated state.
- `GuestRoute` redirects authenticated users away from guest-only routes.
- `RoleRoute` checks resolved client role state against the roles allowed by the route.
- Guards may render nested content through `Outlet` and may preserve navigation context when an approved flow requires it.
- Guards must consume auth/role state from the approved authentication owner. They must not create auth state, call business APIs, decode authority independently, or hard-code speculative destinations.
- Frontend guards improve navigation and user experience only. Backend authentication and authorization remain mandatory and authoritative.

### Layouts

`frontend/src/layouts/` contains shared structural frames for groups of pages.

- A layout may compose headers, sidebars, navigation, footers, and an `Outlet`.
- Layouts may own responsive structural behavior but not feature business workflows.
- A new layout requires a real structural or experience difference.
- Role-specific layouts must not be created from role names alone before approved screens require different shells.
- Shared application presentation extracted from a layout belongs in `components/common/` when it has an application-level identity, as with `AppHeader`.

### Pages

`frontend/src/pages/` contains complete screens mapped to URLs.

Pages may:

- compose feature components, shared application components, and UI primitives;
- connect route parameters to feature-facing interfaces; and
- coordinate screen-level presentation states.

Pages must not:

- own an entire business workflow that belongs to a feature;
- configure HTTP or Socket.IO clients;
- contain complex reusable realtime handlers;
- define global Redux state; or
- become collections of unrelated domain utilities.

Pages and page groups are created only for approved, concrete screens.

### Features

`frontend/src/features/<feature>/` is the canonical owner for client-side
behavior belonging to one business feature.

A feature may contain only the parts it actually needs:

```text
features/<feature>/
├── components/  # Feature-only UI
├── hooks/       # Feature-only React hooks
├── services/    # Client-side feature workflow coordination
├── slice.js     # Feature-owned Redux state, when global state is justified
└── utils.js     # Pure helpers used only by the feature
```

Feature modules must follow these rules:

- Feature components and hooks may consume shared UI, API modules, socket facade, store hooks, and the application validation provider.
- Feature services may coordinate multiple client boundaries when a workflow needs it, but must not create parallel Axios or Socket.IO clients.
- Feature services do not become a second backend business layer. Backend responses and authorization remain authoritative.
- Feature slices remain beside the feature and are registered by the central store.
- Feature-only helpers remain inside the feature until they are genuinely domain-neutral and reused across application areas.
- Features must not import pages, route composition, or application entry points.
- An empty scaffold, including the current `authentication/` tree, is not evidence that a feature is implemented.

### UI primitives

`frontend/src/components/ui/` contains domain-neutral UI primitives managed
with the shadcn/ui approach.

- Prefer adding or adapting shadcn/ui component source over creating a competing primitive system.
- Primitives use Tailwind CSS and may use approved Radix primitives and class-variance-authority.
- Shared class merging uses `cn()` from `src/lib/utils.js`.
- Primitives may expose visual variants and accessibility-oriented behavior.
- Primitives must not know about JOBHUB roles, endpoint payloads, Redux slices, business statuses, or feature workflows.
- Inputs, dialogs, dropdown menus, tables, badges, and other primitives are added only when a real screen needs them.

### Common components

`frontend/src/components/common/` contains application-level presentation
shared across multiple pages or features.

- Common components may compose UI primitives and router presentation helpers.
- They may accept explicit display data and callbacks.
- They must not own feature state, perform business API calls, or interpret one feature's domain rules.
- A component stays in a feature until it has real cross-area use and domain-neutral application semantics.
- `components/common/` must not become a second layouts or features folder.

### Redux store

`frontend/src/store/` owns application-wide Redux Toolkit composition.

- `store.js` creates the single store and registers feature-owned reducers.
- `hooks.js` owns shared JavaScript aliases such as `useAppDispatch` and `useAppSelector`.
- Redux state is introduced only when state genuinely crosses component/route boundaries or otherwise requires application-wide ownership.
- Feature slices live with the feature, not centrally under `src/store/`.
- Slice modules must not import the configured store. Store composition may import feature reducers, preventing a circular ownership path.
- Components should keep ephemeral local UI state local rather than moving every value into Redux.
- Server responses must not be copied into multiple slices without a defined canonical client owner and invalidation/update policy.

### Library integrations

`frontend/src/lib/` contains helpers that integrate external libraries or
provide platform-level adapters.

- `src/lib/utils.js` owns the shadcn/ui-compatible `cn()` helper.
- Library helpers must expose narrow, reusable interfaces.
- They must not own feature workflows, route behavior, or business state.
- A library wrapper is introduced only when it centralizes real integration policy or prevents repeated configuration.

### Shared utilities

`frontend/src/utils/` contains pure, domain-neutral helpers reused by multiple
application areas and the central project constant module.

- `src/utils/constant.js` is the canonical owner of project constants: application configuration values (including the only reads of `VITE_*` variables), closed vocabularies such as `REALTIME_EVENT`, shared default messages, and library default configuration such as `TOASTER_CONFIG`.
- Constants are declared there as named upper-snake-case exports, frozen with `Object.freeze`, and imported through `@/utils/constant`. Other modules must not redeclare the same literal or keep a parallel constant module.
- Object keys normally use upper snake case. A configuration object passed directly to a library as props, such as `TOASTER_CONFIG`, keeps the library's prop names.
- Frontend role, status, and event vocabularies must mirror the approved backend/API contract. They are added only when a real consumer needs them, not pre-declared from the roadmap.
- Page-local display content, such as a list rendered by one page, is not a project constant and remains with its component.
- Existing module-level constants elsewhere are moved here when their module is next changed; new constants are added here directly.
- Shared helper modules are added beside `constant.js` with descriptive lowercase or kebab-case names, such as general date formatting or domain-neutral data conversion, only when genuine cross-area reuse exists.
- Feature rules, role authorization, API calls, React hooks, and component behavior do not belong here.
- A helper remains inside its feature until genuine cross-area reuse exists.
- `src/utils/` must not be used as a dumping ground for logic whose owner is unclear.
- `src/utils/` modules must not import application layers such as APIs, socket, store, routes, pages, or features.
- `src/lib/utils.js` remains the owner of the shadcn/ui `cn()` helper because `components.json` points shadcn/ui at that path.

## Validation boundaries

### Provider and module ownership

Frontend validation has distinct ownership levels:

```text
src/validation/index.js          -> application-wide public validation provider
src/validation/*.validators.js   -> reusable validator implementations
src/validation/*.schema.js       -> form/payload schemas grouped by scope
page or feature component        -> RHF wiring and presentation of errors
src/apis/client/                 -> normalized server/API error transport
backend                          -> authoritative business, authorization, and persistence validation
```

Checks may exist at more than one boundary only when they protect different
concerns. Client validation improves feedback and prevents obviously malformed
requests; it never makes a request authorized or guarantees that a business
transition is valid.

`frontend/src/validation/index.js` is the provider and public facade for the
entire application. It must:

- import approved validators, schemas, and form adapters from focused modules;
- re-export the supported validation surface for application consumers;
- keep consumer imports stable through `@/validation`; and
- contain no growing collection of inline form-schema implementations.

Validation implementation modules must not import from `index.js`, because that
would create a circular dependency through the public facade. They import Zod,
sibling validator modules, and shared constants such as `VALIDATION_MESSAGE`
from `@/utils/constant` directly. Validation modules must be side-effect free.

The current module shape is:

```text
src/validation/
├── index.js               # Public provider/facade
└── common.validators.js   # Generic reusable validator factories
```

Future form schemas are added only with real forms, for example:

```text
src/validation/
├── authentication-login.schema.js
└── candidate-profile.schema.js
```

Each approved schema is imported and re-exported by `index.js`.

### Reusable validators

Reusable validator modules such as `common.validators.js` own factories that
are meaningful across multiple schemas.

Generic validators must:

- remain independent of one feature's workflow or lifecycle state;
- accept explicit messages/options when customization is needed;
- define normalization such as trimming only when that behavior is valid for every consumer of the helper; and
- avoid embedding feature endpoint names, roles, statuses, or backend mutation rules.

Generic factories are implementation modules. Application consumers should use
the exports provided by `@/validation` rather than importing those files
directly.

### Form and payload schemas

- Form and payload schemas live in focused files under `frontend/src/validation/`, not inline in `index.js` and not duplicated across components.
- One file may own one form schema or a small cohesive schema family. Unrelated forms must not be grouped merely to reduce file count.
- Schema filenames identify the owning scope and form or payload, such as `authentication-login.schema.js`.
- Schema modules export named schemas and any tightly coupled schema-derived helpers required by that contract.
- Conditional fields, lifecycle-dependent requirements, role-aware form shape, and cross-field rules must trace to an approved product/API contract.
- Closed vocabularies must consume a canonical frontend constant aligned with the API contract rather than reproduce string arrays inside schemas.
- Dynamic catalogs must come from their canonical API/state owner; validators must not hard-code dynamic backend data as static options.
- A schema must not import React components, pages, routes, the configured store, API clients, or Socket.IO.
- `index.js` imports and re-exports each approved schema so consumers use one application-wide validation provider.

### React Hook Form integration

- Forms should use React Hook Form with `zodResolver` when a Zod schema owns the form shape.
- Form components import both the schema and `zodResolver` from `@/validation`.
- A schema's object paths must align with the field names registered through React Hook Form.
- Static schemas live in their `src/validation/*.schema.js` modules, so they are not recreated on every render.
- Schema input/output transformations must be intentional: React Hook Form field values are the schema input, while the resolver output is the value passed to the submit handler.
- Form `defaultValues` must be compatible with the schema input shape. Defaults remain with the form or an explicitly exported form contract; they must not be hidden in unrelated generic validators.
- Form components own field registration, accessible error presentation, submit state, and focus behavior.
- Reusable field presentation may move to feature/common components, while the schema remains owned by its focused validation module.
- Submit handlers receive schema-validated values and pass explicit payloads to feature/API boundaries. They must not pass DOM events or entire form-library objects into API modules.

Schema module example:

```js
// src/validation/example-form.schema.js
import { z } from 'zod'

import { validators } from './common.validators'

const exampleFormSchema = z.object({
  email: validators.email(),
  displayName: validators.requiredText(),
})

export { exampleFormSchema }
```

Public provider example:

```js
// src/validation/index.js
import { exampleFormSchema } from './example-form.schema'

export { exampleFormSchema }
```

Form consumer example:

```jsx
import { useForm } from 'react-hook-form'

import { exampleFormSchema, zodResolver } from '@/validation'

function ExampleForm() {
  const form = useForm({
    resolver: zodResolver(exampleFormSchema),
  })

  // Render fields and submit through the owning feature.
}
```

### Normalization and transformation

- Trimming, case normalization, numeric conversion, and empty-value conversion must be explicit and consistent with the API contract.
- Validation must not silently discard unsupported keys or coerce invalid business input into an apparently valid value.
- UI display formatting must remain separate from request payload normalization when the representations differ.
- Dates and times must not be converted using an assumed timezone when the product/API contract defines another semantic.
- Defaults must represent approved behavior. A convenient UI default must not create a business default absent from the product specification.

### Server and asynchronous validation

- Uniqueness, current authorization, session validity, concurrent state, inventory/catalog membership, and other server-owned facts remain server validation.
- The frontend may perform an approved asynchronous check for user experience, but the submit response remains authoritative and must still be handled.
- Backend field errors should be mapped to form fields by the owning feature when the API contract provides a stable field mapping.
- Non-field errors remain visible as form- or screen-level errors; they must not be swallowed because local validation passed.
- `ApiError.status`, `code`, and `details` are transport information. Feature code decides how an approved error contract appears in its UI.
- Client schemas must not treat stale cached data or realtime events as proof that a protected transition will succeed.

### Response validation

- Runtime response validation is introduced only when an approved client contract requires it; it is not added mechanically to every request.
- When response parsing exists, its schema follows the same focused-module/provider pattern under `src/validation/`; the API module owns invoking transport-shape parsing, while feature services own workflow interpretation.
- Response validation must fail visibly through the canonical error path rather than silently fabricate missing values.
- A frontend response schema must mirror the API contract and must not become a competing backend data model.

### Validation authority

- Backend validation is authoritative for authentication, authorization, business invariants, concurrency, and persistence.
- Frontend validation and route guards must never be described as security controls.
- Password policy, account lifecycle, roles, application status transitions, salary rules, catalogs, and other business constraints must not be guessed from common practice; they require approved product/API authority.
- If product requirements, API behavior, and an existing frontend schema conflict, stop and report the conflict before changing client behavior.

## Styling and themes

`frontend/src/styles/` owns application-global CSS, theme tokens, and global
styling rules.

- Tailwind CSS must follow the installed major version.
- The current Tailwind CSS v4 setup uses `@tailwindcss/vite`, CSS imports, CSS variables, and `@theme inline`.
- A Tailwind v3-style configuration or PostCSS setup must not be added unless a concrete requirement and installed version require it.
- Global styles define application-wide tokens and base rules. Feature/component-specific styling remains with the component through Tailwind classes or an explicitly approved local style owner.
- Theme tokens should be reused instead of duplicating raw colors across components.
- `components/ui/` variants use the established `cn()` and class-variance-authority approach when variant composition is needed.

## Configuration

### Vite and aliases

- `frontend/vite.config.js` owns Vite plugins and runtime alias configuration.
- `frontend/jsconfig.json` mirrors aliases for editor and static tooling.
- `@` maps to `frontend/src` and should be used for cross-area imports.
- Relative imports are appropriate inside one local module boundary, such as sibling files in `apis/client/` or `routes/`.
- Alias definitions must not drift between Vite, jsconfig, and shadcn/ui configuration.

### Environment configuration

- Vite environment files belong at the frontend project root as `frontend/.env*`, not under `frontend/src/`.
- Only public browser configuration uses the `VITE_*` prefix.
- Secrets must never be stored in frontend environment variables because Vite embeds them in client assets.
- `VITE_API_BASE_URL` configures the shared HTTP client through `API_CONFIG.BASE_URL` (fallback `/api`).
- `VITE_SOCKET_URL` configures the shared realtime client through `SOCKET_CONFIG.URL` (fallback: the current browser origin).
- `src/utils/constant.js` is the only module that reads `import.meta.env`. Other modules consume the derived constants.
- Environment defaults must be explicit and safe for the intended development setup.

### shadcn/ui

- `frontend/components.json` owns shadcn/ui style, CSS, icon-library, and alias conventions.
- Generated/adapted components are repository-owned source after addition and must follow the same layer and business-logic boundaries as handwritten primitives.
- shadcn/ui aliases must remain aligned with the Vite/jsconfig aliases.

## Error handling

- `src/apis/client/api-error.js` owns the normalized API error type and Axios-error translation. It reads the backend error body `{ error: { message, details } }` (falling back to a top-level body) and exposes `message`, `status`, `code`, `details`, `requestId` (from the `X-Request-Id` response header, `HTTP_HEADER.REQUEST_ID`), and the original Axios error as `cause`.
- `src/apis/client/index.js` owns development API-error logging. When `RUNTIME_ENV.IS_DEVELOPMENT` is true, every failed request except a cancellation is logged once to the browser console as `[API] METHOD url -> status: message`, followed by status, code, `requestId`, details, params, the backend development stack, and the Axios cause. Request bodies are never logged. Production builds do not log.
- The `requestId` shown in the browser console matches the scope of the backend terminal log lines for the same request; use it to correlate the two.
- Components, hooks, and API modules must not add their own `console.error` for API failures that the client already logged; they only decide presentation, such as `toast.error(error.message)`.
- API modules must reject through that shared error contract rather than invent resource-specific global error classes for the same transport concern.
- Feature code owns translating approved error codes/details into feature presentation.
- Pages and components must not parse arbitrary Axios internals when `ApiError` already exposes the normalized fields.
- Unexpected client errors must remain distinguishable from expected validation/business responses.
- Error boundaries, when introduced, belong in `components/common/` only if they provide application-level rendering/recovery. They must not suppress feature errors or replace explicit loading/error states.

## Imports and dependency boundaries

Additional rules:

- `components/ui/` must not import features, pages, routes, store slices, APIs, or socket modules.
- `components/common/` must not import feature services or slices unless explicit application-level composition is approved; display data and callbacks should normally be passed in.
- Layouts may import common/UI components, but must not import feature services or API modules.
- Pages may import features and shared presentation, but feature modules must not import pages.
- Routes may import guards, layouts, and pages; features must not import route composition.
- API modules may import the shared client and transport helpers; they must not import React UI, routes, or store composition.
- Feature modules may import approved shared infrastructure and presentation modules, but must not import another feature's internals. Cross-feature collaboration requires a stable public interface or a higher-level owner.
- Store composition may import feature reducers. Feature slices must not import the configured store.
- Circular dependencies are forbidden.

## Verification

- Frontend changes must run the applicable repository scripts from `frontend/`.
- `yarn verify:agent` is the common frontend gate. It runs `yarn lint` (the lint gate) and then `yarn build` (the production compilation gate).
- When a frontend test harness or deterministic architecture checks are introduced, they are added to `verify:agent` rather than documented as a separate final gate.
- Passing lint/build proves syntax, configured lint rules, module resolution, and production bundling; it does not prove business behavior.
- Feature behavior, validation edge cases, route guards, reducers, and error mapping should receive focused automated tests when a frontend test harness is introduced.
- No frontend test result may be claimed unless the stated command was actually run successfully.
- Backend verification does not verify frontend behavior, and frontend build success does not verify backend contracts.

## Source-of-truth discipline

Before adding a client, route group, layout, page, feature service, slice,
shared component, primitive, helper, validator, constant, or error type:

1. Read the approved product/API contract for the behavior.
2. Check [`frontend-source-of-truth.md`](frontend-source-of-truth.md) and search for an existing canonical frontend owner.
3. Reuse or extend that owner within its responsibility.
4. Keep feature-specific code with the feature until real reuse justifies promotion.
5. Do not establish a parallel HTTP client, Socket.IO client, router, Redux store, validation contract, or component system.
6. Obtain explicit approval before introducing a new architectural layer or changing ownership.

## Current compliance note

The current frontend demonstrates the intended top-level separation among
routing, layouts, pages, shared components, UI primitives, HTTP, realtime,
Redux composition, generic validation, library helpers, and global styling.

It is still a foundation rather than an implemented business client:

- `features/authentication/` is an explicitly requested empty scaffold;
- route guards exist but are not connected to an auth-state owner;
- no resource `*.api.js` module or feature realtime handler exists;
- the Redux store has no feature reducer; and
- `src/utils/` currently contains only `constant.js`; no shared helper module exists yet.

These facts must not be interpreted as missing behavior to invent without an
approved feature specification.
