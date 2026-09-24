# CODEX_HANDOFF_STEP2.md

## 0. Mission

Implement **Step 2｜MVP Skills Runtime Integration** for `aibang-hr-onboarding-agent`.

Base: `main@d0c63508e40fffae98aff26d70fdeb6d3f5cd47d`.
Step 1 is accepted: 14 test files / 220 tests PASS and the real `hr-bot-01` synthetic Hero Flow passed on OpenClaw 2026.9.4.

Step 2 must move the existing six Skill Packs from repo-local synthetic smoke execution into an **OpenClaw-discoverable, agent-restricted, auditable Skill runtime path**.

Still synthetic-only / pre-staging. Do not enable real systems, real employee data, formal READY, outbound messaging, external writes, Growth Write, or Production.

## 1. Frozen P0 boundary

Allowed:
- identify onboarding requests;
- read fictional synthetic onboarding data;
- check `DOCUMENTS`, `IT_ACCOUNT`, `DEVICE`;
- analyze missing/conflict/freshness;
- produce Day-1 Ready recommendation;
- create draft artifacts;
- human-review guidance + audit.

Automation ceiling: `A2_DRAFT`.

Reserved/formal capabilities must remain unavailable, especially READY confirm, requirement completion commit, review decision commit, waiver/exception commit, notification send, artifact export and any external write.

## 2. Frozen identity/security model

- one HR = one Tenant;
- multiple HR Tenants may share the same Agent and Team;
- trusted identity comes from unique `(accountId, senderId)`;
- Session/personal memory remain private;
- Team-scoped business truth may be shared only through explicit Team authorization;
- Tenant/DataSpace/Actor/Team/membership/audit/idempotency/non-disclosure protections from Step 1 must not regress.

The model must never provide or override Tenant, DataSpace, Actor, Team, membership, roles, scope grants, authorization decisions, implementation bindings, or arbitrary Capability IDs.

## 3. Current problem

The repo already contains:
- 6 Skill definitions;
- 12 workflows;
- 18 planned read/analyze/draft Capability contracts;
- Capability Gateway;
- synthetic implementations + executor;
- Synthetic Skill Orchestrator;
- audit + idempotency;
- Skill smoke tests.

But live execution is still mainly:

```text
Feishu -> Agent -> synthetic Ready-card test tool -> Case Store
```

Target:

```text
Feishu
 -> Agent
 -> OpenClaw Skill
 -> controlled Skill runtime tool
 -> trusted RequestContext v2
 -> Skill workflow
 -> Capability Gateway
 -> approved implementation
 -> result/artifact + independent audit
```

No generic shell/HTTP/DB/filesystem fallback for HR business execution.

## 4. OpenClaw 2026.9.4 constraints

Implement using these verified runtime rules:
- native Skills are directories containing `SKILL.md`;
- workspace Skills load from `<workspace>/skills`;
- agent Skill allowlists restrict visibility;
- Skill allowlists are not authorization boundaries;
- Tool policy is the hard runtime boundary;
- `tools.profile: full` is too broad for the final HR posture;
- optional plugin tools should be explicitly allowlisted;
- tool factories may bind trusted `toolContext` and fail closed.

Step 2 therefore requires **both Skill allowlisting and Tool lockdown**.

## 5. Six canonical Skills

1. `onboarding_task_navigation_pack`
2. `onboarding_case_intake_pack`
3. `onboarding_requirement_tracking_pack`
4. `onboarding_status_control_pack`
5. `onboarding_coordination_pack`
6. `onboarding_delivery_pack`

Keep current workflow IDs and current 18 planned Capability IDs unless a concrete compatibility issue is found.

### Critical mismatch

Step 1 made RequestContext require `contextVersion: "2"`, `activeTeamId`, and `teamMembershipRef`, but `src/skills/registry.ts` still declares `requiredRequestContextVersion: "1"`.

Fix this first. Do not weaken RequestContext validation. Add tests proving stale v1 is rejected by the Step 2 runtime path.

## 6. Preserve default-closed contracts

Current Capability registry intentionally has:
- `PLANNED_TEST_STUB`;
- disabled feature flags;
- null implementation bindings;
- no physical/connector bindings.

Do not turn the base contract registry into a globally enabled registry.

Preferred design:

```text
base contract registry -> CLOSED

explicit Step2 synthetic activation profile
 -> six approved Skills
 -> 18 safe read/analyze/draft implementations
 -> environment=test only
 -> trusted principal only
```

Exact overlay/composition shape is up to Codex, but default-closed behavior must remain explicit and tested.

## 7. OpenClaw Skill packaging

Create repo-managed Skill bundles intended for the HR workspace:

```text
workspace-template/skills/
  onboarding_task_navigation_pack/SKILL.md
  onboarding_case_intake_pack/SKILL.md
  onboarding_requirement_tracking_pack/SKILL.md
  onboarding_status_control_pack/SKILL.md
  onboarding_coordination_pack/SKILL.md
  onboarding_delivery_pack/SKILL.md
```

Each `SKILL.md` must:
- have valid OpenClaw frontmatter;
- use the canonical Skill ID as `name`;
- explain when to use the Skill and supported workflows;
- call only its controlled runtime tool;
- forbid shell/DB/filesystem/HTTP fallback;
- state identity/authority comes only from trusted runtime context;
- state `A2_DRAFT` ceiling;
- state READY confirm/send/formal commit/external write are unavailable;
- contain no real IDs, secrets, employee data or customer config.

Skills are instructions/discovery surfaces, not authority.

## 8. Controlled runtime plugin

The legacy `aibang_hr_onboarding_test_ready_card` must not remain the primary business runtime after Step 2.

Preferred: one tool plugin with one stable **optional high-level tool per Skill**, e.g.:

- `aibang_hr_onboarding_task_navigation`
- `aibang_hr_onboarding_case_intake`
- `aibang_hr_onboarding_requirement_tracking`
- `aibang_hr_onboarding_status_control`
- `aibang_hr_onboarding_coordination`
- `aibang_hr_onboarding_delivery`

Do not expose 18 low-level Capability tools to the model.

Each factory must:
1. require the HR Agent and expected channel;
2. resolve trusted principal from `(agentAccountId, requesterSenderId)`;
3. build RequestContext v2 internally;
4. accept only minimal business-level parameters;
5. deterministically construct bounded Skill/Capability requests;
6. execute Skill Orchestrator -> Capability Gateway -> approved implementation;
7. return structured result + audit refs;
8. fail closed on ambiguity, invalid scope, expired context, audit failure, unavailable implementation, or non-approved workflow.

## 9. Runtime composition

Create one reusable synthetic runtime composition root, conceptually:

```text
principal resolver
+ RequestContext v2
+ Step2 activation profile
+ Skill registry
+ Capability Gateway
+ approved synthetic implementation registry
+ SyntheticCapabilityExecutor
+ SyntheticSkillOrchestrator
+ audit sinks
+ scoped synthetic stores
= Step2 Skill Runtime
```

Do not duplicate authorization logic in each tool.

If Step 1 SQLite Case truth and existing synthetic Capability stores are not unified, document that boundary honestly. Do not silently claim one canonical store if the code does not provide it.

## 10. Tool lockdown is part of Step 2

Step 0 recorded `aibang-hr-onboarding-agent.tools.profile = full`.

Step 2 must produce a reviewed runtime config template/patch where:
- HR Agent Skill allowlist = exactly the six HR Skills;
- HR Agent tool profile is restricted, not `full`;
- only approved HR runtime plugin tools are added;
- host exec is unavailable to HR business turns;
- generic fs write/edit, generic HTTP/web and direct DB tools are unavailable;
- no generic tool fallback exists.

Do not edit the live server config from Codex. Produce repo-side config/example + server validation instructions.

## 11. Legacy Ready-card migration

Do not delete the Step 1 tool before the new delivery Skill path is proven.

Migration:
1. retain legacy Ready-card tool temporarily for compatibility;
2. implement six-Skill runtime;
3. prove `onboarding_delivery_pack/day1_ready_card_candidate`;
4. mark legacy tool deprecated/not primary;
5. server rollout removes it from HR Agent allowlist only after the new Hero Flow passes.

Avoid two independent long-term business implementations.

## 12. Required tests

Add tests proving:
- trusted Bot/Sender admission and cross-pair denial;
- Context v1 rejected;
- only six approved Skills/workflows runnable;
- arbitrary Capability injection rejected;
- reserved/formal Capability invocation impossible;
- Gateway cannot be bypassed;
- generic fallback count remains zero;
- audit unavailable fails closed;
- Step 1 Team/private boundaries remain correct;
- caller idempotency remains isolated;
- no result can claim formal state changed, outbound sent, external side effect, or real customer data processed.

Packaging/policy tests must prove:
- exactly six `SKILL.md` bundles;
- Skill names match registry IDs;
- each Skill references only approved runtime tool(s);
- plugin manifest declares intended optional tools;
- example HR Agent config does not use `tools.profile: full`;
- example HR Agent config allowlists exactly six Skills + approved runtime tools.

## 13. Hero Flow acceptance

Primary Hero Flow:

```text
Feishu HR request
 -> onboarding_delivery_pack
 -> controlled delivery tool
 -> day1_ready_card_candidate
 -> readiness.evaluate
 -> Gateway ALLOW
 -> implementation
 -> ready_card.draft
 -> Gateway ALLOW
 -> implementation
 -> draft/result + Skill/Capability audit
 -> HR response
```

Output must remain recommendation-only, human-review-required, formal READY unconfirmed, no send, no external side effect.

Also prove at least one second Skill path, preferably:
- `onboarding_status_control_pack/case_status_inspection`, or
- `onboarding_requirement_tracking_pack/requirement_completion_candidate`.

Step 2 must not become merely a renamed Ready-card tool.

## 14. Implementation gates

### 2C-1 Contract alignment
- RequestContext v2 alignment;
- explicit synthetic activation model;
- default closed preserved.

### 2C-2 Skill packaging
- six valid `SKILL.md` bundles;
- registry/package consistency tests.

### 2C-3 Controlled runtime plugin
- bounded optional high-level Skill tools;
- trusted context only;
- no low-level Capability injection.

### 2C-4 Skill -> Gateway -> Executor
- approved workflows execute through Gateway;
- independent audit/idempotency preserved;
- no direct adapter bypass.

### 2C-5 Tool lockdown design
- restricted HR Agent Skill/tool config template;
- no `full` profile or generic business bypass.

### 2C-6 Regression/security
Run typecheck, focused Step 2 tests, full suite, build, applicable validators/smokes, plugin syntax/manifest checks and Skill packaging checks.

Step 1 floor: 14 files / 220 tests. Explain any changed/deleted baseline test.

### 2C-7 Evidence
Create `chatgpt_to_codex/STEP2_IMPLEMENTATION_REPORT.md` containing:
- base/final commit;
- files changed;
- six Skills packaged;
- runtime tool names;
- activation model;
- Gateway/executor path;
- tool lockdown design;
- final tests/counts;
- security properties;
- Hero Flow evidence available locally;
- unresolved server-only checks;
- P0 non-goals confirmation.

Do not merge to `main` automatically.

## 15. Server rollout boundary

Codex must not directly modify live:
- `~/.openclaw/openclaw.json`;
- Gateway/systemd;
- real Feishu credentials;
- live Step 1 SQLite;
- other Agents.

After code review/merge, server rollout will:
1. sync main;
2. build runtime/plugin;
3. sync six Skill bundles to HR workspace;
4. run `openclaw skills list/check --agent aibang-hr-onboarding-agent`;
5. inspect plugin runtime registration;
6. apply reviewed Skill/tool allowlist patch;
7. probe `hr-bot-01`;
8. run primary + secondary Hero Flows;
9. de-allow legacy Ready-card tool only after success.

## 16. Codex operating instruction

Before editing:
1. read this file;
2. inspect current Skill registry, Capability registry, orchestrator, executor, implementation registry, plugin and tests;
3. report conflicts with this handoff;
4. output a concise plan mapped to 2C-1..2C-7;
5. explicitly explain default-closed activation;
6. explicitly explain separation of Skill discovery from Tool authorization;
7. explicitly explain legacy Ready-card migration.

Then implement incrementally.

Do not invent real credentials, real users, real employee data, production configuration, or new P0 business scope.
