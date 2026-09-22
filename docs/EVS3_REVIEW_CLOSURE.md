# EVS3 Local Review Closure — E1 Primitive Harness

Date: 2026-09-22. Scope: local synthetic harness and primitive code only. This is a Codex technical review requested by the project owner, **not** an independent Eval Owner approval or an E1 Eval Run.

## Decision

**LOCAL_REVIEW_CLOSED / FORMAL_E1_BLOCKED.** The 12-family local catalog has 36 synthetic vectors, each repeated three times. All vectors return their expected structured result; the catalog reports `missingFamilies=[]` and `missingBoundaryClasses=[]`. The harness deliberately returns `BLOCKED`, never an E1 PASS, Eval Run or Acceptance Decision.

## Findings closed in this review

| ID | Finding | Closure |
|---|---|---|
| EVS3-R01 | An omitted Evidence prerequisite could be treated like a non-false value and pass. | Required flags must be explicitly `true`; conflict must be explicitly `false`. Added missing-field vector. |
| EVS3-R02 | An unknown runtime PHC prohibition value had no explicit rejection. | Closed enum check added; `SYSTEM_HARD_BLOCK` takes precedence. Added unknown-value vector. |
| EVS3-R03 | A vector could rewrite its own expected result during execution. | All expected results are cloned before any execution; mutation or output drift fails. Uncloneable expected results reject the catalog before execution. |
| EVS3-R04 | Missing contamination scan could throw instead of returning a structured block. | Missing named scan results now return `EVAL_CONTAMINATION_UNRESOLVED`; added vector. |
| EVS3-R05 | The plan still described the historical 14-vector, six-family gap. | Current local status and this review are recorded in document 19; the historical note is retained as history. |

## Reviewed boundaries

- Existing runtime functions are used for Tenant/Scope, Subject, Authorization, Prohibition routing, Digest, Idempotency and State Transition. The remaining five families use EVS3-only reference predicates; they are not bound to Gateway, OpenClaw, customer systems or the live Agent.
- Freshness requires a supplied policy threshold. Evidence and Ready are candidate judgments only; neither commits formal status. PHC-4 blocks Agent action, and System Hard Block has priority. Authority inputs represent already-verified facts and confer no actual Grant. Restricted fields are omitted from generic projection. Contamination FAIL/INDETERMINATE and missing scans block.
- The inline expected values are local test expectations, **not independently approved Oracle snapshots**. Booleans that stand in for validated Authority, Evidence, Privacy or scanner results are not proof that those upstream checks occurred.
- No approved Suite/Dataset, frozen Subject Under Test, independent Oracle, externally pinned manifest or authorized Eval Run exists. E0 and E1 remain not executed. EVS4 is a separate future slice.

## Verification

`corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm verify:baseline-docs` and `git diff --check` pass locally. The test suite contains 199 passing tests, including harness regression tests. No real customer data, external side effect, server synchronization, Agent routing change or tool binding occurred.

## Exit criteria for formal E1

Freeze and review a synthetic Subject, independently pinned E0 manifest, approved E1 Suite/Dataset, contamination PASS evidence and independently reviewed Oracle/expected results; then execute an authorized Eval Run with immutable case results and audit. Until then, formal E1 status remains **BLOCKED**.
