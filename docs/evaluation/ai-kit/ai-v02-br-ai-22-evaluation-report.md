# AI-V02 BR-AI-22 — Three-PDF evaluation report

**Review date:** 2026-10-23. **Status:** Three-PDF new-prompt live evaluation
complete; AI-V02 Final Acceptance is `ACCEPTED` under the approved Product
Decision, with the sparse semantic quality result retained as `FAIL`.
The approved [Product Spec
§16.2](../../product/ai-kit/versions/v02-uploaded-cv-normalization.md) uses
three PDFs and manual evidence review without a mandatory accuracy percentage.
The [Evaluation Contract](ai-v02-br-ai-22-evaluation-contract.md) separates
System Correctness, Prompt & Extraction Quality, and Downstream Usability / UX
Tolerance. `PASS`/`LIMITATION`/`FAIL` below are review outcomes, not runtime
`READY`/`FAILED` states.

## Fixtures, independence and method

- Case 1 is the existing [Smoke #3 review](ai-v02-br-ai-22-smoke-3.md), a
  two-page PDF with SHA-256
  `920030d32ab5a62cbc7974da8374707adb7753c60760c45c74194bd2919cc6bd`.
  Its expected review was made after seeing the saved output, so it is not an
  independent gold ledger.
- Case 2 is the one-column [standard Software Developer PDF](../../../ai-kit/test/fixtures/ai-v02-standard-developer-synthetic.pdf), SHA-256
  `bdd31ea07087de867059bae83095b279bc23480ed8da727d8aa2c2004b75df1c`.
- Case 3 is the [sparse two-column PDF](../../../ai-kit/test/fixtures/ai-v02-sparse-two-column-synthetic.pdf), SHA-256
  `57dab2006395b8ae6f9d6427ab74a46027aa9b69b3b81e99251bec93bcae8dfd`.
  Both new PDFs and all their professional details are wholly synthetic, marked
  as evaluation fixtures, text-native, and reproducible with the standard-library
  [generator](../../../ai-kit/test/fixtures/generate-ai-v02-evaluation-pdfs.py).
- The [independent expected ledger](ai-v02-br-ai-22-expected-ledger.md) was
  written from rendered PDFs and PDF.js text **before** either new LLM output
  was inspected. It defines 15 review units for Case 2 and 12 for Case 3,
  without inventing absent qualifications. Both PDFs rendered legibly with
  PDF.js at 1.5× and were read through the canonical
  `extractPdfTextFromBuffer` owner: 1,226 and 933 characters respectively.
  The full PDF.js text and PNG renders are under ignored local
  `ai-kit/.smoke-output/` with fixture-based names.
- For the baseline, the existing Codex/CCPro configuration and unchanged
  extraction prompt were used. A provider-free preflight preceded **one live call for each new PDF**
  (two live calls total). No LLM grading, automatic retry, prompt change,
  provider configuration change, or Smoke #3 retest was performed in that baseline. Full local
  extraction/profile/diagnostic artifacts: `ai-kit/.smoke-output/run-6stxwF/`
  (Case 2) and `ai-kit/.smoke-output/run-IEfxb0/` (Case 3). These are ignored
  review artifacts, not runtime persistence/cache.

## Old-prompt baseline: System Correctness and downstream transport

| Case | Provider and processing evidence | Profile/read-view evidence |
|---|---|---|
| 2, standard | One SDK request, HTTP 200, Responses `completed`, JSON/schema/evidence-structure/composition PASS, runtime `READY`; 953 input + 967 output tokens. | `profile.pdfContent` deep-equals saved LLM extraction. `readCvCareerContent` exposes all 11 structured items with PDF evidence/provenance; Backend metadata remains in its separate synthetic-source group. |
| 3, sparse | One SDK request, HTTP 200, Responses `completed`, JSON/schema/evidence-structure/composition PASS, runtime `READY`; 890 input + 1,026 output tokens. Five diagnostic lexical excerpt warnings; no rejection. | `profile.pdfContent` deep-equals saved LLM extraction. Read view exposes all 12 structured items, including both work-date claims and two unresolved items, with PDF evidence/provenance. |

The smoke harness uses a synthetic `cvSource`; these calls do **not** verify
Backend ownership/authorization, current-file binding, or an end-to-end
consumer. The existing offline gates cover processing boundaries; Backend
source validation remains an acceptance consideration outside these live PDFs.

## Old-prompt baseline: Prompt & Extraction Quality case findings

Counts below use the frozen ledger's **review units**, not JSON item counts or
an accuracy percentage. “Correct” means the factual content and its important
qualification are present somewhere in extraction. Classification findings
are counted separately, so a preserved fact can still have a field-placement
issue. Numbers are diagnostic and do not create a threshold.

| Case | Correct factual units | Missing | Factually wrong | Unsupported new claims | Classification / UX findings | Review outcome |
|---|---:|---:|---:|---:|---:|---|
| 1, Smoke #3 | No independent unit count | 1 important test-score detail | 0 confirmed | 0 confirmed | 1 test-result-as-certification concern | `FAIL` for the TOEIC detail; runtime `READY` |
| 2, standard | 15/15 | 0 | 0 | 0 | 2 project-type values placed in `role` | `PASS`; runtime `READY` |
| 3, sparse | 12/12 | 0 | 0 | 0 | 1 team metric placed in `achievements` and duplicated in `unresolvedContent` | `LIMITATION`; runtime `READY` |

**Case 1 — Smoke #3.** The saved output retained most career content but lost
the stated TOEIC score from the structured claim value, even though the PDF
and PDF.js text contain it. It put the test name in `certifications[0].name`
without source evidence of an awarded certificate. This is an LLM
interpretation/coverage finding, not a PDF.js omission or composition loss.
Its 21 lexical warnings were manually traced to text-layer spacing and line
breaks. The existing [case report](ai-v02-br-ai-22-smoke-3.md) gives the
field-by-field evidence and its independence limitation.

**Case 2 — standard CV.** PDF.js preserved all visible source content in
section order. Extraction kept both roles and periods, three explicit skill
lines, two project descriptions, education and the self-reported language
proficiency. It kept the internal-test scope (`40 users`, median `12` to `8`
minutes), API use by `6 internal teams`, and a **load test** at `500 concurrent
sessions`, without converting the load test into production traffic. No source
qualification was invented. The two `projects[*].role` values are `Personal
project` and `Team project`: those are project types, not a person's role.
The source is present in each item's evidence, so this is a **low-impact LLM
classification / downstream labeling finding**, not a factual omission.
Consumers should avoid presenting these values as a job title or individual
contribution. `PASS` is limited to this PDF and one model run.

**Case 3 — sparse/two-column CV.** PDF.js retained the visible words but
interleaved left- and right-column lines (for example `TOOLS   RECENT WORK`
and `French - conversational   handoff checklist...`). This is a **PDF.js
reading-order limitation**, not evidence that the LLM omitted visible text.
All 12 source units remain in extraction: French proficiency, a short course
with `degree: null`, the unnamed earlier practice under `unresolvedContent`,
the team project with `role: null`, and two separate Willowline work periods
(`2022-2024` and `2023-present`). The model did not resolve the explicit
conflict or invent the missing organization/degree/individual project role.
Five lexical evidence warnings arise where excerpts join visually continuous
column text across PDF.js interleaving. Visual PDF review and the extracted
words support those excerpts; the warnings are diagnostic, not invalid output.

The team-note metric (`median handoff time moved from 2 days to 1 day`) and
the caveat `Individual contribution to that change is not stated` are retained
verbatim. However, both appear inside
`workExperiences[0].achievements[0]`, and the metric/caveat are repeated in
`unresolvedContent[1]`. A consumer that labels every `achievements` entry as
an individual accomplishment could misattribute a team outcome. This is a
**medium-impact LLM classification / downstream UX tolerance finding**.
The factual qualification is present, so the item is not counted as an
unsupported achievement claim; whether that field is tolerable for a future
consumer remains unresolved. Review outcome is `LIMITATION`, without changing
runtime `READY` or rejecting a valid sparse profile.

## Targeted prompt improvement and Smoke #3 retest (2026-10-23)

The prompt owner now asks for explicitly stated career-relevant quantitative
results to keep their name, value, and any stated unit or scale together in a
structured claim value, using `otherCareerClaims` when no specific group fits.
It also says that a test result alone does not establish an awarded
certification or stated proficiency. This is general guidance, not a TOEIC
special case, schema change, semantic validator, or runtime rejection rule.
Focused offline extraction/contract tests passed (3 files, 91 tests); the AI
Kit offline gate passed (lint; 21 files, 369 tests). These tests verify the
instruction reaches the existing Codex, Gemini and Groq request paths, and
that the runtime contract remains valid; they do not prove semantic quality.

The provider-free preflight reused the Case 1 PDF hash above (2,513 PDF.js
text characters), the same smoke-only synthetic `cvSource`, and existing
Codex/CCPro model configuration (`gpt-5.6-sol`). **One** live normalization
request followed, with no retry and no second LLM grader. It returned HTTP
200, Responses `completed`, JSON/schema/evidence-structure/composition PASS,
and runtime `READY`; usage was 1,832 input and 1,638 output tokens. The 21
lexical excerpt warnings remain diagnostic. The full ignored local artifacts
are in `ai-kit/.smoke-output/run-5OpAD7/`.

| Check | Old-prompt Smoke #3 baseline | New-prompt single retest |
|---|---|---|
| Source test result | PDF/PDF.js: `Toeic : 600`; no scale stated. | Same source PDF and PDF.js text. |
| Structured result | `certifications[0].name = "TOEIC"`; score only in evidence. | `otherCareerClaims[0].value = "TOEIC: 600"` with source evidence. The shared career read view exposes the same value and evidence. |
| Credential/proficiency | Test name was classified as certification; `languages = []`. | `certifications = []`, `languages = []`; no awarded credential, proficiency, or unstated scale inferred. |
| Other career content | Two positioning claims, one summary, five skills, one work item, two projects, one education item, four unresolved items. | Internship positioning remains; fourth-year study and self-description moved into summary. Five skills, the same work period/activities, two project periods/technologies, education period, and both website labels remain. Work activities moved from `achievements` to `description`; the source spelling `Font-end` is retained. |
| Remaining variation | Two separate ambiguous `Số Lượng: 1` entries, one near each project. | One unresolved `Số Lượng: 1` entry; its two occurrences and project association are no longer distinct. This is a low-impact coverage/provenance limitation for ambiguous source content, not an invented career fact. |

The retest `profile.pdfContent` equals the saved extraction, and the common
career read view carries the score claim. The targeted test-score omission and
certification classification are resolved **in this run**. Case 1's historical
baseline review remains `FAIL`; the new-prompt retest is `PASS` for the
targeted correction with the ambiguous-quantity limitation above. One run
does not establish stability.

## Final new-prompt live regression (2026-10-23)

The Product Owner authorized **at most two** further live provider invocations.
Exactly **two** were made: one for each existing synthetic PDF. Each run had
one captured HTTP fetch, SDK `maxRetries: 0`, and no fallback, retry, second
grader, prompt edit, schema edit, validator edit, pipeline edit, or new fixture.
Both used the current Codex/CCPro `gpt-5.6-sol` configuration, the same
smoke-only synthetic `cvSource`, and `responses.create` strict JSON Schema.
Provider-free preflights preceded the calls. These are manual evaluation
artifacts in ignored local storage, not runtime persistence or cache.

### Evidence inventory and integrity

| Case | Exact input evidence | Exact output and processing evidence |
|---|---|---|
| Standard | [PDF fixture](../../../ai-kit/test/fixtures/ai-v02-standard-developer-synthetic.pdf), SHA-256 `bdd31ea07087de867059bae83095b279bc23480ed8da727d8aa2c2004b75df1c`; `ai-kit/.smoke-output/regression-2026-10-23/standard/` contains `input-output-manifest.json`, `pdfjs-extracted-text.txt`, and `request-body.raw.json`. | Same case directory: `response-body.raw.json`, `console.jsonl`, `fetch-count.txt`, `http-status.txt`; `ai-kit/.smoke-output/run-WWMvno/` contains `llm-extraction.json`, `cv-match-profile.json`, and `diagnostic-summary.json`. |
| Sparse | [PDF fixture](../../../ai-kit/test/fixtures/ai-v02-sparse-two-column-synthetic.pdf), SHA-256 `57dab2006395b8ae6f9d6427ab74a46027aa9b69b3b81e99251bec93bcae8dfd`; `ai-kit/.smoke-output/regression-2026-10-23/sparse/` contains the corresponding manifest, PDF.js text, and exact request body. | Same case directory: raw response, console diagnostics, fetch count, HTTP status; `ai-kit/.smoke-output/run-NdL9oC/` contains full extraction, profile, and diagnostic summary. |

Each manifest contains the fixture and artifact hashes, the actual smoke
`cvSource` copied from its [definition](../../../ai-kit/scripts/smoke-uploaded-cv-codex.js),
model, invocation settings, and artifact paths. The captured request body
contains the exact PDF.js text, prompt, model, and schema sent to the provider;
it contains no headers or credentials. The raw response is the unmodified HTTP
body captured before the SDK parsed it. For each case, the captured request
input equals the saved PDF.js text (1,226/933 characters); the response's
assistant text parses to the saved extraction; and
`profile.pdfContent` deep-equals that extraction. The shared career read view
retains every item and its PDF evidence. Both runs returned HTTP 200, Responses
`completed`, JSON/schema/evidence-structure/composition PASS, and runtime
`READY`. Standard used 1,006 input / 955 output tokens; sparse used 943 / 1,121.
Sparse has ten diagnostic lexical excerpt warnings; they did not change
runtime status. The frozen [expected ledger](ai-v02-br-ai-22-expected-ledger.md)
and old-prompt `run-6stxwF/` and `run-IEfxb0/` artifacts were reused. Those
two historical baseline run folders contain only parsed extraction, profile,
and diagnostics. Their exact original request payloads and raw HTTP responses
were not saved; the separately saved PDF.js texts are not proof of the exact
historical request bytes. No baseline provider replay was made.

### Three-PDF new-prompt matrix

| Case | Runtime | Quality | Regression | Remaining findings |
|---|---|---|---|---|
| Smoke #3 | `READY` in the earlier one-call retest. | `PASS` for the targeted score/credential correction; no independent gold ledger. | TOEIC score now a sourced structured text claim; no inferred certification/proficiency. | Two ambiguous `Số Lượng: 1` occurrences collapsed to one unresolved item; 21 lexical warnings; original request/raw response artifacts missing. |
| Standard CV | `READY`; one request, HTTP 200. | `PASS`: 15/15 ledger units present, 0 missing, 0 factually wrong, 0 unsupported new claims. | New extraction is identical to the old-prompt baseline; career facts, metrics, contexts and periods remain. | Both `projects[*].role` values still hold project **types**, not individual roles (low impact labeling). |
| Sparse CV | `READY`; one request, HTTP 200. | `FAIL`: 12/12 factual ledger units appear somewhere, 0 missing, but one unsupported role and one wrong cross-section association. | Old baseline `LIMITATION` became a new-prompt quality regression; the conflicting dates survive, while the unnamed 2019–2020 practice is also promoted to work experience. | Team metric remains in `achievements`; a standalone claim drops its team-note qualification from the value; PDF.js column interleaving and ten lexical warnings complicate evidence. |

**Standard, verified.** The complete structured extraction deep-equals the
old-prompt baseline. It preserves both
jobs and dates; the internal 40-user median 12→8-minute test; the API used by
six internal teams; the 500-concurrent-session **load test**; both project
descriptions and periods; education; and self-reported English proficiency.
The project-type-in-`role` issue is unchanged. PDF.js kept section order, so
there is no identified PDF.js loss in this case.

**Sparse, verified.** The PDF render and frozen ledger show `2019-2020:
service design practice` under **EARLIER NOTE**, with no named employer or
role. The baseline kept it in `unresolvedContent[0]`. The new extraction also
creates `workExperiences[1]` with `position: "Service design practice"`; that
turns the activity description into an unsupported job role (medium impact,
LLM classification, BR-AI-17). Its `unresolvedContent[1]` combines the right
column's Willowline **PORTFOLIO CAPTION** with `Organization not stated` from
the separate left-column earlier note. This is a wrong source association
(medium impact, first present in the LLM extraction). PDF.js retained
the words but interleaved the two columns; the visual PDF resolves the section
boundary, but its direct causal contribution is unproven. The old baseline did
not make either association. Deterministic composition preserved the LLM output
without creating or changing the work role.

The new sparse extraction still keeps the stated short course with
`degree: null`, French proficiency, team project with `role: null`, both
Willowline work-date claims (`2022-2024` and `2023-present`) and their explicit
conflict, and the 2→1-day median team-note metric with the explicit lack of
individual attribution somewhere in the profile. It still places the team
metric under `workExperiences[0].achievements[1]`. It additionally emits
`otherCareerClaims[0]` with the metric but without the team-note attribution
in that claim's value, while `otherCareerClaims[1]` carries the caveat
separately. A consumer that displays a claim alone could over-attribute it.
This remains a downstream usability concern; no consumer exists to verify
actual UX behavior. The ten lexical warnings are diagnostic and do not explain
away the two semantic errors or turn `READY` into `FAILED`.

**Smoke #3 evidence audit, verified versus unavailable.** The original PDF is
present at `ai-kit/fixture/` with the documented SHA-256. The old-prompt
`run-IkK4DG/` and new-prompt `run-5OpAD7/` each contain full parsed extraction,
full profile, and technical diagnostic summary; the new-prompt diagnostic
records one request, HTTP 200, `completed`, and `READY`. The existing case
review reconstructed PDF.js text from that PDF and matched the diagnostic
length (2,513 characters), but the exact original PDF.js input text was **not
saved**. Neither historical run saved the exact prompt/request payload or raw
HTTP provider response. The smoke source definition identifies the synthetic
`cvSource`, but there is no per-run `cvSource` snapshot. These artifacts are
**unverified**, not reconstructed as if original, and no provider call was
made to fill them. The saved parsed output supports the targeted score finding;
it cannot prove the full historical wire input/response.

**Final Acceptance review.** The sparse errors are consistent
with a model misreading PDF.js column interleaving, but the relative causal
contribution of reading order versus prompt behavior cannot be proven from one
run. The observed unsupported role and false section association are verified
against the visual source, extracted text, baseline, and frozen ledger. One
run per case does not establish repeatability, broad-population quality, live
Backend authorization/current-file binding, or actual downstream UX tolerance.
The Product Owner has reviewed and accepted the recorded semantic and evidence
limitations, including the sparse unsupported work role and cross-column
association, the merged `Số Lượng: 1` entries, the 21 diagnostic lexical
warnings, and Smoke #3's missing historical wire artifacts. This acceptance
does not change the sparse quality review from `FAIL` or add a runtime gate.
The approved Product Decision is reflected in [BR-AI-17, §16.2 and
§20](../../product/ai-kit/versions/v02-uploaded-cv-normalization.md): the
unsupported work role remains a verified LLM semantic quality finding, with
case quality `FAIL`, but is no longer an absolute Final Acceptance blocker.
System-owned source, authorization, schema/evidence-structure, canonical
metadata/provenance, deterministic integrity and technical-failure gates still
must pass. The Product Owner accepted the documented semantic limitations
after reviewing their impact; no runtime status, schema or quality result was
rewritten. Live Backend E2E evidence is absent, but §16.2 does not separately
require that run; the Backend source/current-file path is verified offline.
Slice 4d's downstream consumer remains deferred until an approved consuming
capability exists.

| Final Acceptance check | Review result | Evidence and limit |
|---|---|---|
| PDF text extraction, one-pass structured LLM output, schema/evidence validation, deterministic composition, `READY`/`FAILED`, and technical failures | `PASS` — implemented and verified offline | [AI-V02 status leaf](../../project-status/ai-kit/v02-uploaded-cv-normalization.md), Slice 1–3 records and verification history; the three live PDF runs also reached `READY`. |
| Backend canonical `cvSource`, current PDF Buffer, same-file binding, internal invocation, ownership and source refusal | `PASS` — implemented and verified offline | [AI-V02 status leaf](../../project-status/ai-kit/v02-uploaded-cv-normalization.md), Slice 4a–4c records; live smoke used synthetic sources and did not exercise Backend. |
| BR-AI-17 prompt instruction and deterministic claim integrity | `PASS` — instruction and composition boundary verified offline | The [AI-V02 status leaf](../../project-status/ai-kit/v02-uploaded-cv-normalization.md) records focused prompt and composition verification; profile PDF content equals the saved extraction in the live evidence inventory. |
| Three-PDF benchmark, independent synthetic ledger, TOEIC retest, standard case | `PASS` — evaluation performed | [Ledger](ai-v02-br-ai-22-expected-ledger.md), [matrix above](#three-pdf-new-prompt-matrix), and saved evidence inventory. Standard quality is `PASS`; Smoke #3's targeted score/credential correction passed its one retest. |
| Sparse semantic quality | `ACCEPTED LIMITATION`; case quality `FAIL` remains | `workExperiences[1].position` asserts a role absent from the source. The prompt instructs grounded extraction, but schema-valid LLM interpretation can err; Product Owner accepted this documented limitation under [BR-AI-17 and §16.2](../../product/ai-kit/versions/v02-uploaded-cv-normalization.md). |
| Other recorded semantic and historical-evidence gaps | `ACCEPTED LIMITATION` | Cross-column association, quantity merge, lexical diagnostics and Smoke #3 wire artifact gaps remain documented above; historical raw artifacts were not recreated. |
| Canonical compatibility, lifecycle and scope boundary | `PASS` — reviewed against the existing offline implementation record | The [AI-V02 status leaf](../../project-status/ai-kit/v02-uploaded-cv-normalization.md) records the common career read view, no persisted profile or CV mutation, and no OCR, Matching Engine or unapproved caller. |
| Slice 4d consumer and live Backend E2E | `DEFERRED` consumer; E2E `UNVERIFIED` | [Product scope](../../product/ai-kit/versions/v02-uploaded-cv-normalization.md) defers CV–Job Matching; §16.2 does not separately mandate a live Backend E2E run. |

All mandatory system-owned correctness checks and the approved BR-AI-22
benchmark are accounted for in the evidence above. With Product Owner
acceptance of the documented semantic limitations, AI-V02 Final Acceptance is
`ACCEPTED`. This is a project acceptance verdict, not a new runtime state.

## Coverage, prompt options and acceptance

The benchmark observes §16.1 clear/simple text (Case 2), multipage and rich
career content (Case 1), two columns, sparse information, ambiguity, an
explicit conflict and difficult text order (Case 3). It does not establish
stability across repeated runs or broad document populations. Image-only/no
text, invalid AI output and invalid/unauthorized resources are failure/source
branches, not represented by successful PDF cases; existing offline fixtures
and tests are the applicable evidence. Live synthetic smoke does not verify
Backend authorization or current-file identity. No Matching Engine or UX
consumer has been implemented, so downstream tolerance is assessed from the
profile and shared career read view only.

Prompt improvement status:

1. Quantitative-result preservation and the test-result classification guard
   were implemented in the shared prompt and observed in the single Smoke #3
   retest above. `otherCareerClaims.value` remains a text claim, not a typed
   score field.
2. Distinguish project type from individual role and team-reported metrics
   from individual achievements. Preserve attribution/caveats in the field
   consumers read. Basis: Case 2 `projects[*].role` and Case 3
   `workExperiences[0].achievements[0]`/`unresolvedContent[1]`. A later prompt
   change would need focused offline regression and separate live evidence;
   no added semantic validator or rejection gate is proposed.

The final new-prompt matrix above supersedes the earlier request for synthetic
live regression. The standard case remains `PASS`; the sparse case still has two
verified semantic errors despite runtime `READY`. Product Owner review and
limitation acceptance are recorded above under the aligned BR-AI-17/§16.2/§20
contract.
A source explicitly awarding a credential was not evaluated live, so the
classification guard has only test-result evidence. The §16.2
quantitative-threshold decision is resolved by the approved Product Spec
alignment. AI-V02 Final Acceptance is `ACCEPTED` with those limitations.
