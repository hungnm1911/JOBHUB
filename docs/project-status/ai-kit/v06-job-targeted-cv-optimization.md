# AI-V06 Job-Targeted CV Optimization Project Status

## Current project state

The optimization prompt now prefers Vietnamese replacement career content,
with English only when the target Job explicitly requires it.

The AI-V06 [Product Specification](../../product/ai-kit/versions/v06-job-targeted-cv-optimization.md)
and [Data Contract](../../data/ai-kit/versions/v06-job-targeted-cv-optimization.md)
are **APPROVED** by direct Product Owner decision, including fallback decision
M1. Slice 00 aligns their canonical documentation and authority references.
Slice 01 implements and verifies the F03 Optimization Result output contract.
Slice 02 implements and verifies the AI Kit's single-provider F03 optimization
inference, compact Job/CV context, and V04 advisory feedback handling for
BR-AI-06/07. Slice 03 implements and verifies F03 provider fallback in
Codex → Gemini → Groq order for BR-AI-07/09, accepting only completed,
contract-valid results. Slice 04 implements the Generated Source CV baseline
part of F02/BR-AI-04. Slice 05 implements the Uploaded Source CV baseline
part of F02/BR-AI-05 from an existing READY AI-V02 profile, verified with
focused Backend checks. Slice 06 implements and verifies the internal F01/F03
authorized Job/CV handoff and AI Kit optimization call for BR-AI-01/02/08.
Its H1 acceptance fix binds normalization and baseline to the same authorized
request-local CV source snapshot for Generated and Uploaded inputs.
Slice 07 implements the F03 merge and one-write Generated Draft creation through
the Backend V7 CandidateCV owner. Slice 08 connects the Candidate HTTP action
to that workflow and returns the new Draft detail for V7 read/edit/Preview.
The Backend/AI Kit phase is closed with AI-V06 Final Acceptance **`ACCEPTED`**
by the Product Owner on 2026-10-26, with the known LLM quality and verification
limits in the [acceptance evaluation](../../evaluation/ai-kit/ai-v06-final-acceptance-evaluation.md).
This is business acceptance, not an official full-gate PASS. Frontend
integration remains **NOT STARTED**.

## Deferred / not started

- Amended flow: R1 Backend Preview API (`POST /candidate/jobs/:jobId/optimize-cv/preview`, no persistence) is implemented. R2 Proposal signing (HMAC-SHA256, 60-minute TTL, identity and Source revision bound, stateless) is implemented in the Preview response. R3 Backend Commit (`POST /candidate/jobs/:jobId/optimize-cv/commit`: signature, TTL, identity, current Job/Source authorization, Source revision 409, V7 `GENERATED/DRAFT` create from the signed `proposedContent`, no AI call) is implemented. Frontend F1–F3 are implemented (see below); legacy Backend `/optimize-cv` was removed in F4-B (see below).

- Frontend F1 (Preview/Commit API module and `useCvOptimizationProposal` hook, stale-Proposal reset) is implemented. F2 `OptimizationDiffModal` (react-diff-viewer-continued 4.4.0, seven readable sections, split/unified, review-only) and its `diffSections.js` formatter are implemented. F3 integrates both into `CandidateCvOptimizeWorkspace` (Optimize = Preview + Diff; Save Draft = Commit of the untouched signed Proposal; 400/403/404/409 and unknown 5xx/network Commit handling). F4-A migrated `JobCvEvaluationDialog` to Preview → Diff → Commit (reusing the F1 hook and F2/F3 review modal; no Draft before Save) and removed the legacy frontend API function/hook, so no frontend path calls legacy `/optimize-cv`. F4-B removed the Backend legacy `POST /optimize-cv` route, controller handler and `createOptimizedCandidateCvDraftForJob` (now 404); only Commit creates the `GENERATED/DRAFT`. Preview, Proposal signing, Commit and the shared authorization/baseline/merge/V7 owners are unchanged; merge and persistence regression tests were ported to Preview → Commit rather than deleted.

- Frontend workflow integration has not started. Slice 08 exposes the action through
  Candidate HTTP and reuses V7 Draft management and Preview.
- Live fallback on Gemini/Groq and the official V06 Backend/AI Kit full gates
  remain unverified. Representative live quality has the accepted limitations
  recorded in the acceptance evaluation.

## Final Acceptance evidence

The [AI-V06 Final Acceptance evaluation](../../evaluation/ai-kit/ai-v06-final-acceptance-evaluation.md)
maps F01–F04, BR-AI-01–10, §16.2 acceptance and §20 business completion to
Slices 01–08, focused verification, and the Generated/Uploaded V04 → V06 live
captures. The Product Owner accepted the quality backlog for the later LLM
Optimization phase. The ignored local captures remain the detailed evidence;
this leaf records the current state without copying CV content or credentials.

## Verification status

- 2026-11-24 Backend F4-C1 (rich text preservation, F03, BR-AI-03/06, Data §6.6/§6.7): focused `backend/test/candidate/ai-v06-c1-rich-text-preservation.test.js` (5 tests) and targeted ESLint passed with mocked AI Kit; no production code changed. Semantics recorded: HTML is preserved per top-level section — a section returned as `null` keeps its baseline HTML; a replaced section is plain-only (the AI receives and returns no HTML), including items whose text is identical, so a replacement Draft can lose formatting. This is current change semantics, not a data-loss defect, and the Source CV is unchanged and keeps its HTML. Preview `proposedContent` equals the committed Draft `generatedContent`. Per-item HTML retention would change the contract and is not implemented. No `npm run verify:agent`, build or live provider call was run per the requested scope.
- 2026-11-24 Backend F4-B (legacy `/optimize-cv` cleanup): focused Backend tests (11 files / 77 tests across `test/candidate/ai-v06*`, with the legacy route asserted 404 and merge/persistence coverage ported to Preview → Commit) and targeted ESLint passed with mocked AI Kit. No `npm run verify:agent`, build or live provider call was run per the requested scope.
- 2026-11-24 Frontend F3 (Workspace Preview → Diff → Save Draft): focused `test:cv-optimization-proposal` (F1 + F2 + 11 new Workspace integration tests) and targeted ESLint passed with a mocked API client. No `yarn verify:agent`, build, real-browser check or live provider call was run per the requested scope.

- 2026-11-24 Frontend F2 (Diff Modal + formatter): focused `test/candidate-cv-optimization-diff.test.js` (5 tests) and targeted ESLint passed. No `yarn verify:agent`, build, browser check or live provider call was run per the requested scope.

- 2026-11-24 Frontend F1 (Preview/Commit API + hook): focused `test:cv-optimization-proposal` (5 tests) and targeted ESLint passed. No frontend full gate (`yarn verify:agent`), build, browser check or live provider call was run per the requested scope.

- 2026-11-24 R4-L1 Preview → Commit round-trip coverage (Generated and Uploaded; unmodified Proposal → `201 GENERATED/DRAFT`, content/metadata match, no second AI call): focused test `ai-v06-r4-preview-commit-roundtrip.test.js` (3 tests) and targeted ESLint passed with mocked AI Kit. No production change, full gate or live provider call.

- 2026-11-24 R3-AC-01 fix (owned Source archived after Preview → 409; missing/foreign stays 404): focused Backend tests (73 across `ai-v06-*`) and targeted ESLint passed with mocked AI Kit. No full gate or live provider call was run per the requested scope.

- 2026-11-23 R3 Commit: focused Backend tests (71 across `ai-v06-*`, including 11 new R3 cases for success, tampering, expiry, ownership, Source conflict, content consistency and zero AI calls) and targeted ESLint passed with mocked AI Kit. No full gate or live provider call was run per the requested scope.

- 2026-11-23 R2-AC-01 fix (own signing secret; content-hash Source revision): focused Backend tests (60 across `ai-v06-*`) and targeted ESLint passed with mocked AI Kit. No full gate or live provider call was run per the requested scope.

- 2026-11-23 R2 Proposal signing: focused Backend tests (55 across `ai-v06-*`, including R2 signing/tamper/identity/TTL cases) and targeted ESLint passed with mocked AI Kit. No full gate or live provider call was run per the requested scope.

- 2026-11-23 R1 Preview: focused Backend tests (15 across R1, Slice 07, Slice 08) and targeted ESLint passed with mocked AI Kit. No full gate or live provider call was run per the requested scope.

- 2026-11-22 language prompt guidance: focused AI Kit prompt suites passed
  (5 files, 152 tests). No full gate or live provider call was run per the
  user's test-suite-only instruction.

- Slice 00 documentation references, consistency, and whitespace were checked
  on 2026-10-26. This verifies documentation alignment only.
- Slice 01 focused contract tests (5 cases) and targeted ESLint passed on
  2026-10-26. The official AI Kit gate and live provider calls were skipped
  under the slice's requested verification scope.
- Slice 02 focused optimization and output-contract tests (16 cases) and
  targeted ESLint passed on 2026-10-26. The official AI Kit gate and live
  provider calls were skipped under the slice's requested verification scope.
- Slice 03 focused optimization, output-contract, and fallback tests (49 cases)
  and targeted ESLint passed on 2026-10-26. The official AI Kit gate and live
  provider calls were skipped under the slice's requested verification scope.
- Slice 04 Generated baseline focused Backend tests (3 cases), targeted ESLint,
  and Backend architecture verification passed on 2026-10-26. The official
  Backend gate and live provider calls were skipped under the slice's requested
  verification scope.
- Slice 05 Uploaded baseline and Slice 04 regression focused Backend tests (7
  cases), targeted ESLint, and Backend architecture verification passed on
  2026-10-26. The official Backend gate and live provider calls were skipped
  under the slice's requested verification scope.
- Slice 06 focused Backend orchestration and baseline regression tests (17
  cases), focused AI Kit optimization and contract tests (33 cases), targeted
  ESLint for both areas, and Backend architecture verification passed on
  2026-10-26. The official Backend and AI Kit gates and live provider calls
  were skipped under the slice's requested verification scope.
- Slice 06 H1 source-consistency fix: 88 focused Backend tests, targeted ESLint,
  and Backend architecture verification passed on 2026-10-26. The official
  Backend gate, live provider calls, and full AI-V06 acceptance were not run.
- Slice 07 acceptance follow-up: 34 focused Backend tests passed on 2026-10-26,
  including Generated and Uploaded action-to-persistence cases and propagation
  of a simulated CandidateCV create failure without an empty Draft. Targeted
  ESLint, Backend architecture verification, and diff whitespace check passed.
  The official Backend gate, live provider calls, and full AI-V06 acceptance
  were not run under the requested focused offline scope.
- Slice 08: five focused Backend HTTP tests passed on 2026-10-26, covering
  persisted Draft creation and V7 read/Preview, Uploaded advisory context,
  input and authorization rejection, mismatched V04 identity, and
  inference/persistence failures. Targeted ESLint and Backend architecture
  verification passed. The official Backend gate, live provider calls, and full
  AI-V06 acceptance were not run under the requested focused offline scope.
  The focused HTTP suite passed again on 2026-10-26 with V06-created Draft →
  Preview → V7 edit → Preview coverage, including updated PDF content, DRAFT
  lifecycle, and unchanged Source CV. Targeted ESLint and diff whitespace check
  passed for this follow-up; the official Backend gate was not run.
- Final Acceptance evidence review on 2026-10-26 used the existing Generated
  V04/V06 and Uploaded V04/V06 live captures, plus the slice checks above.
  Generated and Uploaded V06 each returned HTTP 201 and produced a distinct
  persisted Generated Draft with unchanged Source CV and HTTP 200 Preview.
  Codex live success was observed; live fallback and official full gates were
  not run or inferred from that success. This documentation closure ran only
  targeted document checks and `git diff --check`.
