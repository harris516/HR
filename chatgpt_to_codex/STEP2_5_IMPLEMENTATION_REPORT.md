# Step 2.5 Implementation Report

## Delivery identity

- Branch: `step2-mvp-skills-runtime-integration`
- Stable Step 2 checkpoint: `7089608bc091c026f88113eb79c02fdc55219987`
- Step 2.5 handoff commit: `f47e835`
- `main` organization commit merged: `02f023c`
- Merge checkpoint before implementation: `38412ea`
- Final commit: the commit containing this report; its immutable SHA is recorded in the Git Closeout result because a commit cannot embed its own SHA without changing that SHA
- Server OpenClaw Runtime modified: no
- Step 3 started: no

## Result

Step 2.5 establishes one persistent SQLite business truth for the P0 synthetic onboarding loop:

`accepted Offer -> TEAM_SHARED OnboardingCase -> DOCUMENTS / IT_ACCOUNT / DEVICE -> status/readiness -> Ready-card draft`

State survives later tool calls and new runtime instances. A completed three-item case can produce only `READY_CANDIDATE`; `formalReadinessStatus` remains `null`, confirmation remains `not_confirmed`, and no outbound message or external write occurs.

## Mark Turn A Runtime Routing Hotfix

### Server acceptance failure

The real Feishu Mark Hero Flow Turn A request explicitly stated synthetic test data, an identifiable candidate, an accepted Offer, and a request to create an onboarding Case. The deployed model first called Task Navigation but then selected `onboarding_case_intake_pack -> case_intake_candidate`. It asked for `plannedStartAt`, `handoffRef`, and `expectedSourceVersion` and correctly failed closed without creating a Case.

- Expected Workflow: `synthetic_case_create_from_accepted_offer`
- Actual Workflow: `case_intake_candidate`
- Failure class: `LLM_WORKFLOW_ROUTING_MISMATCH`
- Root cause: the packaged Task Navigation and Case Intake instructions listed both Workflows but did not define their mutually exclusive selection conditions; the Task Navigation tool returned no concrete Workflow recommendation.

### Routing contract correction

- `onboarding_task_navigation_pack` now requires the four-part conjunction Synthetic context + resolved candidate + explicitly accepted Offer + explicit Case-create intent before recommending Synthetic Create. Missing `plannedStartAt` remains Unknown / null and is not a blocker.
- `onboarding_case_intake_pack` now distinguishes Synthetic Create from Existing Handoff Intake Review. `handoffRef` and `expectedSourceVersion` belong only to the latter.
- Task Navigation now returns a structured, non-executing `navigationDecision` containing the recommended Skill, Workflow, safe business inputs, or missing conditions for clarification.
- The Case Intake tool description mirrors the distinction without replacing the Skill routing contract.
- `offerAccepted: true` is now explicit and required at Tool/runtime ingress. An ambiguous Offer state cannot inherit an accepted default.

### Routing and missing-field acceptance

Fifteen new tests cover:

- the observed Mark wording;
- Lisa accepted-Offer wording;
- Chinese “已接受录用” with an unknown start date;
- English “Offer is accepted / Create an onboarding case” wording;
- explicit Handoff completeness review;
- an existing Offer Handoff Intake-draft request;
- the ambiguous “Mark 的 Offer 处理一下” clarification path;
- acceptance without `plannedStartAt`, `handoffRef`, or `expectedSourceVersion`;
- rejection when candidate identity or explicit accepted-Offer assertion is missing;
- rejection of `offerAccepted=false` and non-Synthetic requests;
- static alignment of both Skill files, Tool descriptions, and the required Tool schema.

Full regression after this Hotfix: **19 test files / 311 tests PASS**.

### Unchanged deterministic core and security boundary

The Hotfix does not modify `SyntheticCaseStore`, SQLite schema/data, `SyntheticMutationGateway`, Capability Gateway, RequestContext v2, Tenant/DataSpace isolation, Team authorization, Principal mapping, Role/Scope enforcement, audit, idempotency, optimistic locking, formal reserved Capabilities, Tool Policy, real-customer-data policy, READY commit behavior, outbound messaging, or external-side-effect policy. It does not modify the server Runtime or start Turn B / Step 3.

## Mark Turn B/C/D Requirement Update Routing Hotfix

The server Turn B request “这是合成测试数据：Mark 的入职文件已经收齐。” was incorrectly treated as an unverified statement requiring `caseRef`, so no Requirement mutation occurred. The root cause was that Task Navigation had no explicit contract for routing a clear synthetic HR manual completion statement to Requirement Tracking.

The existing routing contract now recommends `onboarding_requirement_tracking_pack -> synthetic_requirement_completion_update` only when Synthetic context, a resolved candidate, exactly one P0 Requirement type, and an explicit completion statement are all present. It maps 入职文件 to `DOCUMENTS`, IT 账号 to `IT_ACCOUNT`, and 电脑/办公设备 to `DEVICE`. Business input contains only `candidateDisplayName` and `requirementKind`; scoped Case resolution and optimistic versions remain internal to Runtime/Store.

The statement remains `SYNTHETIC_HR_MANUAL_STATEMENT` with the trusted HR Actor and `evidenceValidationRef = null`; it is not HRIS, ITSM, external validation, formal READY, or a formal business commit. Uncertain language, missing candidate, unclear Requirement, or unclear completion returns `CLARIFY`.

Ten added routing cases cover Turn B/C/D positives, four ambiguous/uncertain negatives, missing candidate, Turn A regression, and Existing Handoff regression. Full regression: **19 test files / 321 tests PASS**. Store, Gateway, SQLite, Tenant/Team isolation, Principal mapping, Audit, Idempotency, optimistic locking, Capability Registry, and Tool Policy remain unchanged.

## Mark Turn E Status Query Hotfix

The first server Turn E failure, `CAPABILITY_OUTPUT_INVALID`, was already closed by omitting `plannedStartDateCandidate` when canonical `plannedStartAt` is null. The next real Feishu attempt failed closed because the model could not uniquely connect the explicit candidate name Mark to the existing scoped Case and required the HR to supply `caseRef`. The current failure class was `LLM_STATUS_QUERY_CASE_RESOLUTION_MISMATCH`.

The Hotfix adds an explicit read-only status-query routing contract for Synthetic context + identified candidate + status/progress question. Task Navigation recommends `onboarding_status_control_pack -> case_status_inspection` with only `candidateDisplayName`. Explicit completion statements remain routed to Requirement Tracking mutation; unclear intent or a missing candidate remains clarification-only.

`case_status_inspection` now accepts exactly one user-facing Case clue: `caseRef` or `candidateDisplayName`. The model can no longer supply `expectedCaseVersion` for this workflow. When a candidate name is used, Runtime reuses `SyntheticCaseStore.resolveCase()` under the trusted Tenant, DataSpace, Team, membership and Actor context. Only a unique scoped match continues; zero matches, multiple same-name matches and cross-Team/cross-Tenant matches fail closed without using conversation history, recency or the first database row.

The existing status workflow now invokes the existing `hr.onboarding.requirement.status.read` Capability in addition to Case status, evidence and audit reads. The persistent Hero-flow test creates Mark, completes `DOCUMENTS`, `IT_ACCOUNT` and `DEVICE`, then queries by candidate name and reads Case version 4 plus all three `completed` Requirement states. Suggested readiness remains a candidate-only interpretation, formal READY remains null, planned start remains Unknown, Case version does not change, and there is no outbound or external side effect.

Routing and resolution coverage includes the three required positive status phrasings, explicit DEVICE completion regression, DEVICE/file query non-mutation, missing-candidate clarification, unique match, not found, ambiguous same-name, cross-scope exclusion, and strict rejection of model-visible `expectedCaseVersion`. Final regression after Turn E: **19 test files / 334 tests PASS**. The plugin remains at seven tools; no Capability, Workflow, SQLite table, state machine or top-level Tool was added.

## Mark Turn F Delivery Routing Hotfix

The real server Delivery Runtime already passed: Status Control resolved Mark, and the existing Delivery Pack generated a Version-4 Day-1 Ready Card draft with `ELIGIBLE`, all three P0 Requirements completed, no blockers/unknowns/conflicts, formal READY unchanged, no send, and independent evaluation/draft/delivery audit evidence. The remaining failure was Task Navigation routing the explicit request “这是合成测试数据：请给我生成 Mark 的入职准备卡供我复核。” to Case Intake and asking for Offer information. Failure class: `LLM_DELIVERY_ROUTING_MISMATCH`.

The Hotfix adds a precise Ready Card intent contract: Synthetic context + identified candidate + explicit generate/make/create Ready Card request routes directly to `onboarding_delivery_pack -> day1_ready_card_candidate` with `candidateDisplayName`. Existing Status Query, Requirement completion, accepted-Offer Case Create and Handoff Review routes retain precedence for their own explicit semantics; a Ready Card request without a candidate returns clarification and cannot inherit conversation history.

`day1_ready_card_candidate` now accepts exactly one user-facing Case clue, `caseRef` or `candidateDisplayName`. Runtime reuses the Turn E scoped `SyntheticCaseStore.resolveCase()` path and supplies the resolved `caseRef` and current `caseVersion` to the existing Delivery workflow as trusted internal data. Model-visible `expectedCaseVersion`, evaluation/template/evidence/audit references remain rejected. No Readiness Evaluation, Ready Card Draft, Artifact, review or formal-state logic was redesigned.

Four positive natural-language cases cover the server wording, a simple Chinese request, Day-1 Ready Card wording and draft wording. Contrast tests preserve Turn A–E routing and missing-candidate clarification. The persistent Hero test creates Mark, completes all three Requirements, resolves by name, and proves Version 4 is used by Readiness Evaluation and Ready Card Draft; output remains `DRAFT / NOT_SENT`, formal READY stays null, and outbound/external side effects stay false. Final regression after Turn F: **19 test files / 345 tests PASS**. Tool Surface remains seven; no Capability, Workflow, Skill, Tool, table, router framework or state machine was added.

## Store and schema changes

- Added `SyntheticBusinessStorePort` for Case create/read/list/resolve and Requirement completion.
- Extended `SyntheticCaseStore` additively, preserving Step 1 APIs and migrations for existing SQLite files.
- Added candidate display/normalized name, accepted Offer status, nullable planned start, created/updated timestamps, and nullable Requirement deadlines.
- Added stable Requirement references, Case and Requirement optimistic versions, and readiness derived from the persisted three-item state.
- Added durable mutation idempotency with payload digest conflict detection.
- Extended audit with mutation ID, correlation, runtime profile, Requirement kind, previous/new state, and previous/new Requirement version.
- Audit is written in the same SQLite transaction as mutation; unavailable audit rolls back the mutation.
- Successful mutation results now expose real, independent Skill run, Mutation Gateway admission, and persistent execution audit references. Skill or Gateway audit unavailability stops before mutation; persistent execution audit unavailability rolls back the transaction.
- Optimistic Case/Requirement versions are resolved internally from the authorized persistent snapshot and are rechecked inside the write transaction. They are no longer model-visible inputs.
- Runtime generates opaque Offer, Candidate, evidence, and source references. Requirement completion provenance is explicitly `SYNTHETIC_HR_MANUAL_STATEMENT`, records the trusted Actor, and keeps `evidenceValidationRef` null so a manual statement is never represented as external-system validation.
- Core Case/Requirement/readiness adapters now receive a view projected from SQLite. Risk, responsibility, evidence presentation, and Artifact fixture content remains supplementary synthetic read-only data and is not claimed as canonical P0 truth.

## Synthetic mutation activation model

The normal Capability Registry remains unchanged and closed:

- planned read/analyze/draft Capabilities: 18
- executable by default: 0
- reserved formal Capabilities registered/enabled: 0

Two internal test-only mutation identifiers are handled by a separate `SyntheticMutationGateway`:

- `hr.onboarding.synthetic.case.create`
- `hr.onboarding.synthetic.requirement.update`

They are allowed only for exact Skill/workflow bindings under `STEP2.5-SYNTHETIC-MUTATION-V1`, test environment, synthetic context, trusted HR role, Team write grant, matching trusted invocation ID, and authorized Tenant/DataSpace/Team membership. They do not enable or alias formal `case.intake.create`, `requirement.complete`, READY, messaging, Connector, export, or production actions.

## Skills and workflows

No top-level Skill or OpenClaw tool was added.

- `onboarding_case_intake_pack`
  - existing: `case_intake_candidate`
  - added: `synthetic_case_create_from_accepted_offer`
- `onboarding_requirement_tracking_pack`
  - existing: `requirement_completion_candidate`
  - added: `synthetic_requirement_completion_update`

The plugin still exposes the same six controlled Step 2 business tools plus the deprecated compatibility tool. Runtime identity is resolved from trusted `(accountId, senderId)` mapping. Tenant, Actor, Team, membership, roles, scopes, mutation profile, capability identity, and SQLite path cannot be supplied by model business parameters.

The model-visible Case-create contract is limited to candidate display name, accepted-Offer semantics, optional planned start, and language. The Requirement-update contract is limited to an authorized Case clue, Requirement kind, and language. Strict schemas reject model-supplied optimistic versions, Offer/Candidate/source references, and evidence/validation references.

## Mark Hero Flow evidence

The local `smoke:step2.5` run used independent runtime instances for each turn:

1. accepted synthetic Offer created one Team-shared Case and three pending Requirements;
2. DOCUMENTS completed;
3. IT_ACCOUNT completed;
4. DEVICE completed;
5. status inspection read Case version 4 from SQLite;
6. readiness evaluation and Ready-card draft used the same persisted version.

Observed final evidence:

- Case version: 4
- Requirement count: 3
- Suggested readiness: `READY_CANDIDATE`
- Formal readiness: `null`
- Confirmation: `not_confirmed`
- Persistent audit events: 7
- Outbound message: false
- Real customer data processed: false

## Tests and verification

- TypeScript typecheck: PASS
- Build: PASS
- Full suite after the Mark Turn F Delivery Routing Hotfix: **19 test files / 345 tests PASS**
- Step 2 baseline: **17 test files / 256 tests PASS**
- Step 2.5 before the routing Hotfix: **18 test files / 296 tests PASS**
- Mark Turn A routing Hotfix final baseline: **19 test files / 311 tests PASS**
- Mark Turn B/C/D routing Hotfix final baseline: **19 test files / 321 tests PASS**
- Mark Turn E status-query Hotfix final baseline: **19 test files / 334 tests PASS**
- Mark Turn F delivery-routing Hotfix final baseline: **19 test files / 345 tests PASS**
- Step 2.5 focused state-loop tests: 47 PASS
- Runtime config validator: PASS
- Capability Registry validator: PASS; 18 planned, 0 executable, 17 reserved, 0 bindings
- Engineering baseline validator: PASS
- Navigation, Gateway, read/analyze adapter, draft adapter, Skill orchestrator, Step 2 Runtime and Step 2.5 Hero Flow smokes: PASS
- Plugin JavaScript syntax: PASS
- Plugin manifest JSON parse: PASS
- `git diff --check`: PASS
- Secret scan of the change: no real Feishu ID/Secret, customer configuration, production endpoint, token, password, or private key found

`validate:e0-static` requires an externally pinned manifest digest and documents root. Those approvals do not exist in this task, so no fake arguments or digest were created. Its automated contract tests pass. A new E0 v2 freeze is required only after server Runtime acceptance.

## Security negative coverage

Tests cover:

- test/synthetic-only execution;
- exact trusted Principal and Team membership;
- missing write scope;
- cross-Team/DataSpace hiding;
- forged Team denial;
- duplicate create and changed-payload conflict;
- idempotent create/update replay;
- stale Case and Requirement version denial;
- audit unavailable rollback;
- independent Skill/Gateway/persistent execution audit evidence and fail-closed behavior for each unavailable audit layer;
- strict rejection of model-supplied optimistic versions, system evidence/validation/source references, and Offer/Candidate references;
- runtime-resolved current versions plus concurrent stale-transaction rejection;
- explicit trusted-Actor HR manual-statement provenance with no external-validation claim;
- same-Team continuation by a second authorized HR;
- scoped unique-name resolution, ambiguity clarification, and no cross-scope name leakage;
- persistent read-after-write through the status Skill;
- default Capability Registry remains closed;
- no formal READY, outbound message, external side effect, real customer data, or generic fallback.

## Gate result

| Gate | Result | Evidence |
|---|---|---|
| 2.5C-1 Store contract | PASS | Port, additive SQLite migration, versions, idempotency, transactional audit |
| 2.5C-2 Read-path unification | PASS | Core Case/Requirement/readiness view projected from persistent SQLite |
| 2.5C-3 Synthetic mutation contracts | PASS | Separate test-only mutation Gateway; formal registry unchanged/closed |
| 2.5C-4 Skill/tool integration | PASS | Existing intake/tracking Skills and tool names extended; no raw write interface |
| 2.5C-5 Mark Hero Flow | PASS (local) | Six-turn smoke completes on one persistent truth |
| 2.5C-6 Security/regression | PASS (local) | Final Turn F Delivery Routing Hotfix baseline: 19 files / 345 tests; Turn E Hotfix: 19 / 334; Turn B/C/D Hotfix: 19 / 321; Turn A Hotfix: 19 / 311; Step 2 baseline: 17 / 256; Step 2.5 pre-Hotfix baseline: 18 / 296; validators, smokes, build and plugin checks PASS |
| 2.5C-7 Evidence | PASS | This report and reproducible test/smoke commands |

## Files changed

- `src/mvp/synthetic-business-store.ts`
- `src/mvp/synthetic-case-store.ts`
- `src/mvp/synthetic-mutation-gateway.ts`
- `src/mvp/synthetic-ready-card.ts`
- `src/capabilities/implementations/synthetic-store.ts`
- `src/contracts/skill-orchestration.ts`
- `src/skills/registry.ts`
- `src/skills/runtime-inputs.ts`
- `src/skills/step2-runtime.ts`
- `src/mvp/feishu-test-context.ts`
- `openclaw-test-tool/index.mjs`
- `openclaw-test-tool/openclaw.plugin.json`
- two existing Skill `SKILL.md` files
- `src/cli/smoke-step2-5-hero-flow.ts`
- `tests/step2-5-synthetic-state-loop.test.ts`
- `tests/step2-skill-runtime.test.ts`
- `docs/FEISHU_SYNTHETIC_TEST_TOOL.md`
- `package.json`

## Unresolved server-only checks

- OpenClaw plugin build/validation against the installed server CLI.
- Server workspace Skill discovery and Agent-specific tool allowlist.
- Migration against a backed-up copy of the existing server synthetic SQLite.
- Feishu six-turn Hero Flow using the controlled test sender.
- E0 v2 snapshot/digest freeze after the exact server Runtime/config is accepted.

These checks require separate server rollout authorization. No live Runtime, Gateway, systemd, Feishu credential, server database, route, or other Agent was changed here.
