# Step 1 Tenant Isolation and Team Collaboration Implementation Report

Status: implementation and local verification complete on `step1-tenant-team-isolation`; not merged to `main`.

## Baseline and scope

- Base commit: `9b8407b6d044cb3e5f3442dd05e7c78faf6d4f2c`.
- Handoff commit at implementation start: `a18540481b7772e6fbfcb702cd1b6c2ac123bff5`.
- Final commit: `SELF` — the commit containing this report; its authoritative SHA is the post-commit `git rev-parse HEAD` value recorded in the delivery response.
- Baseline: 14 test files and 214 passing tests.
- Final local result: 14 test files and 217 passing tests.
- This work uses fictional identities and disposable synthetic SQLite only.
- No live OpenClaw configuration, live SQLite, real employee data, route, or production setting was changed.

## Gate evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| 1C-1 Context + trusted mapping | PASS | Context v2, HR1/HR2/other-Team/non-member mapping tests |
| 1C-2 Team-scoped synthetic Case | PASS | Explicit object scope, creator provenance, same-Team cross-Tenant read |
| 1C-3 Audit Team scope | PASS | Navigation, Gateway, execution, Skill and Case audit assertions |
| 1C-4 Security negative matrix | PASS | Private isolation, cross-Team, missing/forged membership, forged write scope, non-disclosure |
| 1C-5 Full regression | PASS | Typecheck, 14 files/217 tests, validators, build and all applicable smoke tests |
| 1C-6 Evidence | PASS | This report records scope, files, tests, boundaries and open notes |

### 1C-1 Context and trusted mapping

- `RequestContext` now requires `activeTeamId` and `teamMembershipRef`.
- `contextVersion` is `2` because the new required fields are a breaking contract change.
- The Feishu test context resolves Tenant, Team DataSpace, Actor, Team, membership, roles, and scope grants from a host-supplied trusted-principal mapping.
- Fictional HR1 and HR2 have different Tenant/Actor identities and the same Team; HR3 belongs to another Team; the non-member identity is rejected.
- Unknown, malformed, and incomplete principal mappings fail closed.
- The OpenClaw test plugin accepts only mapped senders and does not accept identity or authority fields in model tool arguments.

### 1C-2 Explicit Case scope

- Synthetic offers and Cases now distinguish `TENANT_PRIVATE` from `TEAM_SHARED`.
- Team Cases carry `teamId`, use an explicit Team business DataSpace, and record `createdByTenantId` and `createdByActorId`.
- Private Cases retain Tenant + DataSpace + Actor enforcement.
- Team Cases require an exact trusted mapping match for Tenant, Team DataSpace, Actor, Team, membership, roles, and scope grants.
- Read and write scopes are distinct. A read-only team member cannot forge the write scope.
- HR1 can create and update a Team Case; HR2 can read its current three-Requirement state and create an auditable readiness evaluation without becoming the creator.

### 1C-3 Audit Team scope

- Navigation audit now retains Tenant, DataSpace, Actor, active Team, and membership.
- Capability Gateway, Capability Execution, and Skill audit carry active Team and membership while retaining Actor provenance.
- Case audit records the caller Tenant/DataSpace/Actor plus active Team, membership, object scope, and object Team.
- Authorized Case audit is shared through the same Case authorization check; denied callers receive no event count or existence signal.

### 1C-4 Security negative matrix

Verified properties include:

- HR1 and HR2 have distinct Tenant, Actor, and Session identity.
- Same-Tenant/DataSpace different Actor remains denied for a private Case.
- Different Tenant/Actor plus valid same-Team authorization can read a `TEAM_SHARED` Case.
- Other Team, missing membership, forged membership, and forged write scope are denied.
- Denials use a non-disclosing not-found-or-not-accessible result.
- Capability idempotency now includes Team and membership in addition to Tenant/DataSpace/Actor.
- Same-Team callers do not share idempotency outcomes or caller identity.
- Reusing a navigation request ID under a different context is rejected as a conflict.
- Audit unavailability continues to fail closed.

No baseline isolation test was deleted or replaced.

### 1C-5 Regression results

The following completed successfully:

- `corepack pnpm typecheck`
- Step 1 focused tests — 6 files, 128 tests passed
- `corepack pnpm test` — 14 files, 217 tests passed
- `corepack pnpm build:mvp`
- `corepack pnpm validate:config`
- `corepack pnpm validate:capabilities`
- `corepack pnpm validate:baseline`
- `corepack pnpm smoke:navigation`
- `corepack pnpm smoke:gateway`
- `corepack pnpm smoke:adapters`
- `corepack pnpm smoke:drafts`
- `corepack pnpm smoke:skills`
- Node syntax check for `openclaw-test-tool/index.mjs`
- JSON parse check for `openclaw-test-tool/openclaw.plugin.json`
- Team-scoped seed against a new disposable local SQLite database

The local Corepack invocation printed a non-fatal registry metadata fetch warning while using the already installed `pnpm@11.18.0`; all commands themselves exited successfully.

## Data changes

The new disposable synthetic database schema adds:

- Case `scope_type`.
- Team identifier for `TEAM_SHARED` Cases.
- Private Tenant/Actor ownership fields for `TENANT_PRIVATE` Cases.
- Separate creator Tenant and Actor provenance.
- Team-aware business-key uniqueness.
- Team, membership, object scope, and object Team on Case audit events.

The implementation does not migrate or open the live Step 0 SQLite database. A Step 1 test database must be newly seeded.

## Files changed

Primary implementation files:

- `src/contracts/navigation.ts`
- `src/mvp/feishu-test-context.ts`
- `src/mvp/synthetic-case-store.ts`
- `src/audit/navigation-audit.ts`
- `src/audit/capability-audit.ts`
- `src/audit/capability-execution-audit.ts`
- `src/audit/skill-audit.ts`
- `src/capabilities/gateway.ts`
- `src/capabilities/implementations/executor.ts`
- `src/capabilities/implementations/idempotency-key.ts`
- `src/navigation/navigation-engine.ts`
- `src/skills/orchestrator.ts`
- `src/cli/seed-mvp-synthetic.ts`
- `openclaw-test-tool/index.mjs`
- `openclaw-test-tool/openclaw.plugin.json`

Context/fixture propagation and supporting documentation:

- `config/e1-case-handoff.draft.json`
- `docs/FEISHU_SYNTHETIC_TEST_TOOL.md`
- `src/cli/smoke-capability-gateway.ts`
- `src/cli/smoke-draft-adapters.ts`
- `src/cli/smoke-navigation.ts`
- `src/cli/smoke-read-analyze-adapters.ts`
- `src/cli/smoke-skill-orchestrators.ts`

Tests changed:

- `tests/capability-gateway.test.ts`
- `tests/e1-primitive-harness.test.ts`
- `tests/feishu-test-context.test.ts`
- `tests/navigation-engine.test.ts`
- `tests/security-negative.test.ts`
- `tests/skill-orchestrators.test.ts`
- `tests/synthetic-case-store.test.ts`
- `tests/synthetic-draft-adapters.test.ts`
- `tests/synthetic-read-analyze-adapters.test.ts`

This root report is the only new delivery file. No baseline test was deleted or replaced.

## Diff and sensitive-data review

- `git diff --check` passed.
- No real employee record, real customer configuration, production configuration, server address, private key, GitHub token, Feishu App Secret, or real Feishu `open_id` was found in the Step 1 diff.
- All committed sender identifiers are visibly fictional synthetic values such as `ou_hr1synthetic`.
- The diff is limited to RequestContext v2 propagation, trusted principal mapping, Team-scoped synthetic Case storage, audit/idempotency propagation, tests, test-tool configuration schema, and Step 1 documentation.

## Deliberately retained boundaries and unresolved notes

- Capability Gateway resource admission remains strict Tenant/DataSpace scope. It was not weakened to make Team sharing pass.
- The current P0 OpenClaw synthetic Ready-card tool accesses the scoped Case Store directly, so Team authorization is enforced by trusted principal mapping plus Store authorization.
- If a later step routes Team-shared Case resources through Capability Gateway, it must introduce an explicit scope-aware Gateway resource contract; it must not repurpose or remove the current cross-Tenant hard block.
- The OpenClaw CLI is not installed in this Windows workspace, so repository-local checks could not execute `openclaw plugins validate`. Server validation remains required before enabling the changed plugin configuration.
- The plugin configuration shape changed from one `allowedSenderId` to `trustedPrincipals`. No live plugin configuration was migrated in this step.

## P0 non-goal confirmation

The implementation does not enable formal READY, proactive messaging, real Connector calls, external business-system writes, Growth Write, real employee data, staging release, or production release. Default registered business capabilities remain non-executable outside the explicit synthetic harness.
