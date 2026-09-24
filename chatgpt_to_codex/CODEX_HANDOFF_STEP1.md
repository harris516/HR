# CODEX_HANDOFF_STEP1.md

## Purpose

Engineering handoff for **Step 1: Tenant Isolation + Team Collaboration Context** of `aibang-hr-onboarding-agent` P0 pre-staging integration.

Treat this file and the current branch as the Step 1 implementation brief. Do not broaden scope.

## Frozen baseline

- Repository: `harris516/HR`
- Base: `main`
- Step 0 commit: `9b8407b6d044cb3e5f3442dd05e7c78faf6d4f2c`
- Step 1 branch: `step1-tenant-team-isolation`
- Baseline: 14 test files, 214 tests PASS.
- Node on verified server: `v24.21.0`
- Repo declares `pnpm@11.18.0`.
- OpenClaw runtime verified separately on the server; repo work must not modify live OpenClaw config or live SQLite.

Regression rule: the existing security properties and 214-test baseline are the floor. Do not weaken a boundary merely to make Team sharing pass.

## P0 scope

Only:
1. Identify onboarding requests.
2. Read designated fictional employee synthetic data.
3. Check `DOCUMENTS`, `IT_ACCOUNT`, `DEVICE`.
4. Analyze missing/conflict/freshness.
5. Produce Day-1 Ready recommendation, not formal READY.
6. Generate Ready-card draft.
7. Produce human-review guidance and audit evidence.

Non-goals:
- no real ATS/HRIS/e-sign/ITSM
- no real employee data
- no formal READY commit
- no proactive candidate messaging
- no formal internal commit
- no external business-system write
- no production Growth Write
- no Production release

## Frozen product identity model

**One HR = one Tenant. Multiple HR Tenants may use different trusted Feishu Bot/user entries while sharing the same Agent.**

Required semantics:

- Session/private conversation: isolated.
- Personal preferences/memory: Tenant/User private.
- Unreviewed personal Growth candidates: private.
- `OnboardingCase`, Requirements, Tasks, Exceptions, Case Artifacts and authorized Case Audit: Team business truth, shareable only through explicit Team authorization.
- Future reviewed Team experience may become Team Playbook, but Step 1 must not implement or enable Growth Write.

Core invariant:

**Agent capability shared; Tenant-private memory isolated; Team business truth shared only through explicit Team authorization.**

## Current code facts

1. `src/contracts/navigation.ts` has Tenant/DataSpace/Actor/Session/roles/grants but no Team model.
2. `src/mvp/feishu-test-context.ts` validates one trusted sender and hard-codes `tenant-demo-001`, `dataspace-demo-hr`, `hr-user-demo-001`.
3. `openclaw-test-tool/index.mjs` is test-only and currently gates on the HR agent, Feishu, `hr-bot-01`, and one allowed sender.
4. `src/mvp/synthetic-case-store.ts` is Actor-private: Case reads require case + tenant + dataSpace + actor.
5. Capability Gateway already has valuable Tenant/DataSpace/resource/Actor boundary checks. Preserve them.
6. Capability idempotency already includes Tenant/DataSpace/Actor. Preserve caller identity in idempotency.
7. Navigation duplicate detection fingerprints the full request. Preserve cross-context non-reuse.
8. Audit already records Tenant/DataSpace/Actor in several layers. Team scope should be added without losing Actor provenance.

## Step 1 target RequestContext

Add the minimum trusted Team context:

```ts
activeTeamId: string
teamMembershipRef: string
```

Do not add a redundant `userId` unless implementation proves it necessary; `actorType=user` + `actorId` is sufficient for P0.

Target concept:

```text
RequestContext
├── tenantId
├── dataSpaceId
├── actorId
├── sessionId
├── activeTeamId
├── teamMembershipRef
├── roles
├── scopeGrantRefs
├── authorityGrantRefs
├── purpose
└── integrityRef
```

Team identity/membership must come from trusted host/runtime identity. Chat text and model/tool arguments must never choose Tenant, Actor, Team, membership, or role.

## Trusted Principal Mapping

Replace the conceptual single-principal hard-code with a test-safe mapping abstraction. Use fictional identities only.

Minimum synthetic identities:

```text
HR1
tenantId          = tenant-hr-001
actorId           = hr-user-001
activeTeamId       = hr-onboarding-team-001
teamMembershipRef = membership-hr-001-team-001

HR2
tenantId          = tenant-hr-002
actorId           = hr-user-002
activeTeamId       = hr-onboarding-team-001
teamMembershipRef = membership-hr-002-team-001
```

Also create a non-member/other-team identity for negative tests.

Do not commit real Feishu IDs or secrets.

## Explicit object scope

Do not reinterpret all data as cross-Tenant. Introduce an explicit P0 scope distinction, conceptually:

```text
TENANT_PRIVATE
TEAM_SHARED
```

For `TENANT_PRIVATE`, retain appropriate Tenant/DataSpace/Actor isolation.

For `TEAM_SHARED`, access is allowed only when:
1. caller has trusted valid Team membership;
2. object Team equals caller's active authorized Team;
3. role/scope policy permits the operation;
4. no Tenant-private asset is exposed.

Do not implement Team sharing by simply deleting `actor_ref` checks.

## OnboardingCase semantics

Today `actor_ref` effectively means creator + sole owner. Split those meanings.

Target concept:

```text
OnboardingCase
├── caseRef
├── scopeType = TEAM_SHARED
├── teamId
├── createdByTenantId
├── createdByActorId
├── candidateRef
├── offerRef
└── ...
```

Creator provenance remains auditable but is not the sole authorization rule for Team-shared Cases.

### DataSpace caution

Do not silently redefine `dataSpaceId`. Existing code treats it as a strong isolation boundary. Team collaboration must be explicit through Team scope/membership, not through casual weakening of DataSpace validation. If a Team business DataSpace becomes necessary, document and test that decision before changing semantics.

## Audit requirements

Preserve Tenant/DataSpace/Actor. Add Team scope where appropriate.

A shared Case must still show which HR Actor performed each action. Sharing must never erase Actor provenance or leak hidden payloads.

## Required test matrix

### Trusted principal mapping
- HR1 trusted identity -> HR1 Tenant/Actor/Team membership.
- HR2 trusted identity -> HR2 Tenant/Actor/same Team membership.
- absent/malformed/unknown sender -> DENY.
- forged Tenant/Team/role in chat or tool payload -> ignored/denied.

### Private isolation
- HR1 and HR2 sessions are distinct.
- HR1 Tenant-private scope is inaccessible to HR2 and vice versa.
- Do not build personal Memory storage merely for this test; test the scope primitives.

### Team collaboration
- HR1 creates/provides creator provenance for a Team-shared synthetic Case.
- HR2 is a different Tenant/Actor but valid member of the same Team.
- HR2 can read the shared Case and authorized current Requirement state.
- audit identifies the actual Actor for each action.

### Team boundary
- different Team -> DENY.
- missing membership -> DENY.
- forged membership -> DENY.
- Team mismatch -> DENY.
- denial must not reveal whether the hidden Case exists.

### Existing security regression
An existing test equivalent to `same Tenant/DataSpace + different Actor -> DENY` must not simply be deleted. Refine into:
- different Actor + no authorized common Team -> DENY.
- different Tenant/Actor + valid same Team + TEAM_SHARED Case -> ALLOW.

### Idempotency/cache
- HR1 outcome must not be incorrectly replayed as HR2 outcome.
- shared Case does not imply shared caller identity.
- requestId conflicts must not leak cached responses across contexts.

## Minimal expected modification surface

Start with:
1. `src/contracts/navigation.ts`
2. `src/mvp/feishu-test-context.ts`
3. `src/mvp/synthetic-case-store.ts`
4. `src/audit/navigation-audit.ts`
5. `src/audit/capability-audit.ts`
6. `src/audit/capability-execution-audit.ts`
7. `src/audit/skill-audit.ts`
8. `tests/feishu-test-context.test.ts`
9. `tests/synthetic-case-store.test.ts`
10. `tests/security-negative.test.ts`

Modify additional Gateway/Skill/adapter/schema/fixture files only when typecheck/tests demonstrate the need. Avoid broad refactors.

## Implementation gates

### 1C-1 Context + trusted mapping
Implement Team context and fictional HR1/HR2 mapping. Add negative mapping tests. Run focused tests + typecheck.

### 1C-2 Team-scoped synthetic Case
Implement explicit Team-shared Case semantics and creator provenance. Do not mutate the live Step 0 SQLite. Use disposable tests/new synthetic data.

### 1C-3 Audit Team scope
Add Team context where needed while retaining Actor provenance.

### 1C-4 Security negative matrix
Cover cross-private, cross-Team, forged membership, non-disclosure.

### 1C-5 Full regression
Run typecheck, focused Step 1 tests, full suite, and applicable validators/smokes. Baseline is 214 PASS; final should be baseline plus new tests unless a baseline test is intentionally replaced by a more precise scope-aware test. Document every replacement.

### 1C-6 Evidence
Produce a Step 1 implementation report with files changed, schema/context changes, tests, final counts, proven security properties, unresolved notes, and confirmation that P0 non-goals remain disabled.

**Do not merge to main automatically.**

## Open Step 0 notes

- `pnpm@11.18.0` was declared but not in the interactive server PATH.
- Gateway service had proxy/PATH warnings; Step 0 intentionally did not remediate them.
- `validate:e0-static` requires explicit arguments; its automated tests passed.
- Step 0 only proved one synthetic Tenant; Step 1 adds explicit multi-Tenant/team tests.
- P0 Requirements remain exactly DOCUMENTS / IT_ACCOUNT / DEVICE.
- Current HR Agent tool profile on server was `full`; Step 2 must verify/restrict effective tool exposure. Do not solve that in Step 1.
- Some synthetic-tool documentation status wording was stale relative to server runtime; not a Step 1 blocker.

## Codex operating instruction

Before editing:
1. Read this file.
2. Inspect the listed implementation files and current tests.
3. Produce a concise implementation plan mapped to gates 1C-1 through 1C-6.
4. Identify any conflict between this brief and current code before changing semantics.

Then implement incrementally with tests after each gate.

Do not invent real credentials, real users, or production configuration.
