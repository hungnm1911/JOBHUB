# AI-V02 BR-AI-22 — Independent expected ledger

**Frozen before either synthetic PDF's LLM output was inspected (2026-10-23).**
This ledger comes only from the rendered source PDFs and the PDF.js text read.
Each row is one review unit, not a required JSON item or a numeric pass threshold.
Names, organizations, experience and outcomes in both files are fictional.

| Case | PDF fixture | SHA-256 | PDF.js text |
|---|---|---|---|
| S, standard | [`ai-v02-standard-developer-synthetic.pdf`](../../../ai-kit/test/fixtures/ai-v02-standard-developer-synthetic.pdf) | `bdd31ea07087de867059bae83095b279bc23480ed8da727d8aa2c2004b75df1c` | One page, 1,226 characters; section and sentence order preserved. |
| P, sparse/two-column | [`ai-v02-sparse-two-column-synthetic.pdf`](../../../ai-kit/test/fixtures/ai-v02-sparse-two-column-synthetic.pdf) | `57dab2006395b8ae6f9d6427ab74a46027aa9b69b3b81e99251bec93bcae8dfd` | One page, 933 characters; left and right column lines interleave. Words remain present, but nearby text can belong to different sections. |

The PDFs were rendered with PDF.js at 1.5× and inspected visually. The complete
PDF.js text and PNG renders are local ignored review artifacts under
`ai-kit/.smoke-output/`, named after each fixture. The PDFs themselves are
repository synthetic fixtures (currently untracked). Quoted evidence below is source text, not model
output. Neither name is a career claim.

## S — Standard Software Developer CV

| ID | Source claim and verbatim evidence (page 1) | Expected canonical group / review note |
|---|---|---|
| S01 | `Software Developer` | `careerPositioning`; title only, no inferred seniority. |
| S02 | `Builds web applications and internal tools with attention to reliability and usability.` | `professionalSummary`; self-description. |
| S03 | `Languages: TypeScript, JavaScript, SQL`; `Frameworks: React, Next.js, Node.js, Express`; `Data and testing: PostgreSQL, Redis, Jest` | `skills`; three listed skill lines, with their technologies intact. `Languages` here means programming languages, not human-language proficiency. |
| S04 | `Northstar Systems (fictional) | Software Developer | Jan 2022 - Mar 2025` | `workExperiences`; employer, role and stated period. |
| S05 | `Built a React/TypeScript onboarding UI for the internal operations team.` | `workExperiences` under S04; no external-customer claim. |
| S06 | `In an internal test of 40 users, median completion time fell from 12 to 8 minutes.` | `workExperiences` under S04; retain 40 users, median, 12→8 minutes and **internal test** context. Do not claim independently verified causality. |
| S07 | `Implemented a Node.js/PostgreSQL API used by 6 internal teams.` | `workExperiences` under S04; retain 6 and internal-team context. |
| S08 | `Cedarline Lab (fictional) | Junior Software Developer | Jul 2020 - Dec 2021` | Separate `workExperiences` item with role and period. |
| S09 | `Maintained an Express API and added Jest tests for account workflows.` | `workExperiences` under S08. |
| S10 | `Queueboard | Personal project | Apr - Jun 2024` | `projects`; retain personal-project label and period. |
| S11 | `Built a task board with Next.js and Redis; load tested at 500 concurrent sessions.` | `projects` under S10; preserve that 500 is a **load test**, not observed production traffic. |
| S12 | `Release Notes Helper | Team project | 2021` | Separate `projects` item; individual ownership of entire project is not stated. |
| S13 | `Created a TypeScript script that grouped pull request titles for weekly review.` | `projects` under S12. |
| S14 | `BSc Computer Science | Fictional Polytechnic | 2016 - 2020` | `educations`; degree, institution and period as printed. |
| S15 | `English - professional working proficiency (self-reported)` | `languages`; retain self-reported qualification, do not verify proficiency. |

No certification, license, contact detail, exact employment type, or formal
assessment score appears in S. Empty groups mean absent source evidence, not a
negative judgment. The three work metrics and project load-test number must not
be confused. Technology names in work/project lines need not be duplicated into
the explicit skills list to count as preserved.

## P — Sparse, two-column CV

| ID | Source claim and verbatim evidence (page 1) | Expected canonical group / review note |
|---|---|---|
| P01 | `Operations-focused product technologist` | `careerPositioning`; headline, not proof of a credential. |
| P02 | `Python; SQL; Figma` | `skills`; listed tools only. |
| P03 | `French - conversational` | `languages`; stated proficiency, self-reported. |
| P04 | `Harbor Studio (fictional)` / `Service Design, 2022` under `SHORT COURSE` | `educations` or `otherCareerClaims` if the schema cannot safely represent a short course; **not** an awarded degree or certification. |
| P05 | `Open to product operations` / `or technical support work.` | `careerPositioning` or `otherCareerClaims`; preference, not work history. |
| P06 | `2019-2020: service` / `design practice.` / `Organization not stated.` | `otherCareerClaims` or `unresolvedContent`; period and practice stated, employer/role unknown. Do not make up an employer or job. |
| P07 | `Willowline Tools (fictional)` / `Product Technologist | 2022-2024` | `workExperiences`; one stated employer/role/period. Preserve alongside P12. |
| P08 | `Helped a support team pilot a queue` / `handoff checklist.` | `workExperiences` under P07; participation, not sole authorship. |
| P09 | `A team note reports` / `median handoff time moved from 2 days` / `to 1 day during the pilot. Individual` / `contribution to that change is not stated.` | `workExperiences` under P07 or `otherCareerClaims`; retain team-note attribution, median 2→1 days, and the explicit non-attribution to this person. |
| P10 | `Shift Notes | 2021` | `projects`; project name and year. |
| P11 | `Prototype for shift updates using` / `Python and SQLite. Described as a team` / `effort; individual role not stated.` | `projects` under P10; technologies and team/unknown-role qualification. |
| P12 | `PORTFOLIO CAPTION` / `Willowline Tools, Product Technologist` / `2023-present (conflicts with work dates).` | A separate conflicting `workExperiences` claim or `unresolvedContent`; retain both 2022–2024 and 2023–present, without silently choosing one. |

P has no named degree, awarded certificate, exact employment type, named
employer for 2019–2020, or individual contribution to the reported team metric.
P04 and P06 are intentionally hard to classify. P07/P12 form an explicit
date conflict; neither period is a gold label for the actual employment dates.
The PDF.js interleaving of the two columns is recorded as a possible text-order
limitation. If a later LLM claim combines unrelated neighboring lines, the
review must distinguish whether the source text itself lost the relationship
or the model misinterpreted text that remained sufficiently recoverable.
