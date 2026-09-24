# CODEX_HANDOFF_STEP2_5.md

## 0. Mission

Implement **Step 2.5｜Unified Synthetic Business State Loop** for aibang-hr-onboarding-agent.

Continue on the existing branch: step2-mvp-skills-runtime-integration.

**Do not create a new Step 2.5 branch.**

Stable Step 2 checkpoint: 7089608bc091c026f88113eb79c02fdc55219987.

Step 2 already delivered 6 OpenClaw Skills, 12 workflows, 18 read/analyze/draft Capabilities, RequestContext v2, controlled high-level tools, Skill Orchestrator -> Capability Gateway -> Executor, audit/idempotency, and restricted Tool Policy. Local baseline: 17 test files / 256 tests PASS.

Step 2.5 adds persistent synthetic CREATE/UPDATE so development can exercise a complete fictional onboarding lifecycle.

## 1. Core boundary

**Synthetic write != Formal business commit.**

Synthetic mutation is allowed only when all guards hold:
- environment = test;
- synthetic = true;
- trusted principal resolved from accountId + senderId;
- authorized Tenant/Team scope;
- realCustomerData = false;
- externalSideEffect = false;
- explicit synthetic mutation activation profile.

Real/formal/production mutation remains DENY.

Do not enable real employee data, formal READY, outbound messages, external writes, exports, waiver/exception commits, professional review decisions, Growth Write, or Production.

## 2. Problem to solve

Current truth is split:

- Step 1: persistent Team-scoped SQLite SyntheticCaseStore;
- Step 2: per-run in-memory SyntheticCapabilityStore clone.

Step 2.5 must establish one persistent synthetic business truth for the objects needed by the P0 Hero Flow.

At minimum unify:
- OnboardingCase;
- accepted-Offer/candidate facts needed by P0;
- DOCUMENTS;
- IT_ACCOUNT;
- DEVICE;
- versions/freshness/source fields needed by readiness;
- mutation audit.

If risk/evidence/responsibility/artifact fixtures remain separate, document that honestly. Do not claim full unification unless it exists.

## 3. Store architecture

Inspect before editing:
- src/mvp/synthetic-case-store.ts
- src/capabilities/implementations/synthetic-store.ts
- adapters using SyntheticCapabilityStore
- src/skills/step2-runtime.ts
- readiness/Ready-card dependencies

Prefer a stable store/repository port, conceptually:

~~~text
SyntheticBusinessStorePort
  - Case read/list
  - Requirement read/list
  - create synthetic Case
  - initialize P0 Requirements
  - update synthetic Requirement
  - version/freshness/source access
  - append/read audit
~~~

Use SQLite as the persistent substrate unless current repository evidence supports a better existing abstraction.

Do not implement mutable canonical truth with per-invocation structuredClone(syntheticCapabilityStore).

State created in one tool turn must survive later tool calls and new runtime instances.

## 4. Preserve Step 1 security

Do not regress:
- TEAM_SHARED Case scope;
- Team membership authorization;
- Tenant/DataSpace/Actor boundaries;
- creator provenance;
- Case/Requirement versions;
- non-disclosure;
- audit;
- synthetic-only storage guards.

Schema changes must be additive/testable. Unit tests use disposable DBs, never a developer's live Step 1 DB.

## 5. Synthetic mutation scope

Implement only the minimum P0 mutation loop:

1. create synthetic onboarding Case from accepted Offer;
2. initialize DOCUMENTS / IT_ACCOUNT / DEVICE;
3. update one of those three Requirement states;
4. task-state mutation only if genuinely required by the current architecture.

Do not activate unrelated reserved mutations.

The base/default Capability Registry must remain closed. Do not globally change reserved formal actions to executable.

Create an explicit test-only synthetic mutation contract/activation path. Whatever design is chosen must prove production/default runtime cannot reach it.

## 6. Extend existing Skills, not top-level Skill count

Do not create new top-level Skills.

### onboarding_case_intake_pack

Add a bounded synthetic create workflow.

Primary natural-language scenario:

> 刚给 Mark 发了一个 Offer，他已经接受。

Model-visible business input may include candidateDisplayName, accepted Offer status, optional plannedStartAt, optional currently supported role/department/location clues, and language.

Source should be controlled as a synthetic HR manual statement.

Never accept arbitrary object JSON, SQL, Tenant/Team/Actor IDs, authorization decisions, Capability IDs, implementation bindings, or audit identity.

### onboarding_requirement_tracking_pack

Add bounded synthetic update workflow(s) for exactly:
- DOCUMENTS;
- IT_ACCOUNT;
- DEVICE.

Use strict existing status vocabulary where possible. Do not accept arbitrary Requirement kinds or patch objects.

## 7. Missing facts

Do not fabricate fields to satisfy a schema.

An accepted Offer may create a synthetic Case even when readiness-critical facts such as planned start date are unknown, provided the schema represents the missing fact explicitly.

Unknown facts must remain unknown. Readiness may be INDETERMINATE/NOT_READY until enough facts exist. If ambiguity matters, the Agent may ask a follow-up.

## 8. Case creation semantics

A synthetic create must derive authority from RequestContext v2 and conceptually persist:

~~~text
scopeType = TEAM_SHARED
teamId = context.activeTeamId
createdByTenantId = context.tenantId
createdByActorId = context.actorId
candidateDisplayName = Mark
offerStatus = ACCEPTED
synthetic = true
~~~

It must initialize:

~~~text
DOCUMENTS  -> pending
IT_ACCOUNT -> pending
DEVICE     -> pending
~~~

Return the generated caseRef for later turns.

## 9. Requirement update semantics

Every update must enforce:
- authorized Case;
- Requirement kind in the P0 allowlist;
- expected versions where applicable;
- optimistic/version-aware mutation;
- audit;
- idempotency/conflict handling;
- no cross-Team mutation;
- no Actor substitution.

Return previous state, new state, resulting version, audit ref and synthetic-only marker.

## 10. Gateway requirement

Synthetic mutations must still follow:

~~~text
OpenClaw Skill
 -> high-level Skill tool
 -> trusted RequestContext v2
 -> deterministic workflow compiler
 -> Capability Gateway / explicit synthetic mutation admission
 -> approved synthetic mutation implementation
 -> persistent store
 -> audit
~~~

Forbidden: Skill tool -> direct SQLite UPDATE.

Do not expose low-level mutation Capability IDs, SQL, DB handles or arbitrary patches to the model.

Prefer extending the existing high-level tools:
- aibang_hr_onboarding_case_intake
- aibang_hr_onboarding_requirement_tracking

## 11. Read-after-write is mandatory

Step 2.5 is not accepted merely because INSERT/UPDATE succeeds.

Existing Step 2 read/analyze/draft paths must consume the same persisted truth:

~~~text
CREATE Mark
 -> READ Mark

UPDATE DOCUMENTS
 -> requirement/status read shows new state

UPDATE IT_ACCOUNT / DEVICE
 -> status-control shows latest state

readiness.evaluate
 -> evaluates latest persisted Requirements

ready_card.draft
 -> reflects the same Mark Case
~~~

No reseed or manual second-store edit is allowed between steps.

## 12. Audit/idempotency/concurrency

Mutation audit must identify Tenant, Team, membership, Actor, Case/Requirement, previous/new state and version, synthetic profile/environment, request/correlation IDs, timestamp, mutation source/reason, and dedupe result where relevant.

Audit failure must fail closed.

Tests must cover:
- duplicate create suppression;
- conflicting same-key create;
- stale Requirement version;
- HR1/HR2 caller identity remains distinct;
- authorized same-Team continuation;
- unauthorized other-Team denial.

## 13. Formal actions remain prohibited

Do not enable:
- formal ready.confirm;
- notification.send;
- external write;
- artifact export;
- waiver commit;
- exception accept;
- review decision commit;
- frozen-action release;
- real Connector/MCP write;
- real employee/customer data;
- production memory/Growth Write.

READY_CANDIDATE may exist. Formal READY remains unconfirmed.

## 14. Mark Hero Flow

### A. Create

HR: “刚给 Mark 发了一个 Offer，他已经接受。”

Expected:
- onboarding_case_intake_pack;
- synthetic create workflow;
- persistent Team-shared Mark Case;
- three P0 Requirements initialized;
- caseRef returned;
- audit present.

### B. Documents

HR: “Mark 的入职文件已经收齐。”

Expected: DOCUMENTS -> completed, persisted + audited.

### C. IT

HR: “Mark 的 IT 账号已经开好了。”

Expected: IT_ACCOUNT -> completed, persisted + audited.

### D. Device

HR: “Mark 的电脑已经准备好了。”

Expected: DEVICE -> completed, persisted + audited.

### E. Read

HR: “Mark 现在入职准备得怎么样？”

Expected: existing Step 2 status/read path reads the same persisted truth.

### F. Draft

HR: “给我生成 Mark 的入职准备卡供我复核。”

Expected:
- onboarding_delivery_pack/day1_ready_card_candidate;
- same persisted truth;
- READY_CANDIDATE only if facts/policies support it;
- formal READY unconfirmed;
- human review required;
- no send/external side effect.

## 15. Natural-language Case resolution

Do not use unsafe global display-name lookup.

Use authorized Team scope plus session/task context and caseRef when available. Candidate name is only a scoped clue.

If multiple authorized Mark Cases exist, ask for disambiguation. Never reveal Cases outside the authorized Team.

## 16. Required tests

Add tests for:
- persistent store unification;
- state survives new runtime instance;
- accepted-Offer Case create;
- P0 Requirement initialization;
- missing facts not fabricated;
- DOCUMENTS/IT_ACCOUNT/DEVICE updates;
- version increment + stale version denial;
- audit fail-closed;
- duplicate/conflicting create;
- same-Team continuation;
- other-Team denial;
- read-after-write through status/requirement Skills;
- readiness + Ready-card use persisted truth;
- synthetic=false denied;
- non-test environment denied;
- forged identity/scope denied;
- arbitrary Requirement/patch/Capability injection denied;
- formal reserved actions unavailable;
- generic fallback = 0;
- externalSideEffect/outbound/realCustomerData remain false.

Retain the Step 2 floor of 17 test files / 256 tests unless a baseline test is intentionally refined and documented.

## 17. E0 governance

Do not fabricate or overwrite the old E0 digest to make validation green.

Step 2.5 should document the final runtime/config inputs that need a new E0 v2 freeze after unified server Runtime acceptance.

## 18. Implementation gates

### 2.5C-1 Store contract
Design persistent business-store port; map Step 1 SQLite into it; preserve security/version semantics.

### 2.5C-2 Read-path unification
Existing Step 2 Case/Requirement/readiness paths use persistent truth for the Hero Flow; eliminate mutable per-run fixture truth from those paths.

### 2.5C-3 Synthetic mutation contracts
Explicit test-only activation; create Case + initialize Requirements; update P0 Requirement; default/formal registry remains closed.

### 2.5C-4 Skill/tool integration
Extend existing intake + requirement Skills/tools; deterministic compiler; Gateway enforced; no raw mutation exposure.

### 2.5C-5 Mark Hero Flow
CREATE -> UPDATE -> READ -> ANALYZE -> DRAFT against one persistent truth.

### 2.5C-6 Security/regression
Run typecheck, focused tests, full suite, build, applicable validators/smokes, plugin syntax/manifest checks, Skill packaging and Tool Policy checks.

### 2.5C-7 Evidence

Create:

chatgpt_to_codex/STEP2_5_IMPLEMENTATION_REPORT.md

Include base/final commit, schema/store changes, mutation activation model, Skills/workflows changed, tests/final counts, Mark Hero Flow evidence, security properties, unresolved server-only checks, and confirmation that formal/real writes remain disabled.

Do not merge automatically.

## 19. Server rollout boundary

Codex must not modify live openclaw.json, Gateway/systemd, real Feishu credentials, server SQLite, or other Agents.

After Step 2.5 code review, Step 2 + 2.5 will be deployed and Runtime-validated together.

## 20. Out of scope

Do not add image/PDF/Word/Excel intake yet.

Document/Image Intake is the next input-layer stage after the persistent CREATE/UPDATE loop is stable.

Do not start Step 3.

## 21. Codex operating instruction

Before editing:
1. read this Handoff and the Step 2 implementation report;
2. inspect both current synthetic stores and all adapters;
3. explain the proposed canonical-store design;
4. explain how the default/formal registry remains closed;
5. explain how synthetic mutation passes through Gateway rather than direct DB writes;
6. identify schema/migration risks;
7. map the Mark Hero Flow to exact Skills/workflows/store operations;
8. output a concise plan for 2.5C-1 through 2.5C-7.

Only after plan review should implementation begin.

Do not create a new branch. Do not modify live server runtime. Do not begin Step 3.
