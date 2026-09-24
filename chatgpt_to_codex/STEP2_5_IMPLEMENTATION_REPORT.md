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

## Store and schema changes

- Added `SyntheticBusinessStorePort` for Case create/read/list/resolve and Requirement completion.
- Extended `SyntheticCaseStore` additively, preserving Step 1 APIs and migrations for existing SQLite files.
- Added candidate display/normalized name, accepted Offer status, nullable planned start, created/updated timestamps, and nullable Requirement deadlines.
- Added stable Requirement references, Case and Requirement optimistic versions, and readiness derived from the persisted three-item state.
- Added durable mutation idempotency with payload digest conflict detection.
- Extended audit with mutation ID, correlation, runtime profile, Requirement kind, previous/new state, and previous/new Requirement version.
- Audit is written in the same SQLite transaction as mutation; unavailable audit rolls back the mutation.
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
- Full suite: **18 test files / 281 tests PASS**
- Step 2 baseline retained: 17 files / 256 tests, with 25 new Step 2.5 tests
- Step 2.5 focused state-loop tests: 25 PASS
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
| 2.5C-6 Security/regression | PASS (local) | 18 files / 281 tests plus validators, smokes, build and plugin checks |
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
