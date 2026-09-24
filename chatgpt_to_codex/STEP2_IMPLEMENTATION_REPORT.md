# Step 2 MVP Skills Runtime Integration — Implementation Report

Status: **LOCAL IMPLEMENTATION COMPLETE / SERVER ROLLOUT NOT STARTED**  
Branch: `step2-mvp-skills-runtime-integration`  
Base Commit: `d0c63508e40fffae98aff26d70fdeb6d3f5cd47d`  
Implementation Starting HEAD: `5a48f2327612de6fd10944ed0a73980cec331d21`  
Final Commit: **the commit containing this report; resolve with `git rev-parse HEAD` after Git closeout**

## Scope delivered

Step 2 moves the six approved onboarding Skill Packs into a repo-managed OpenClaw packaging and controlled synthetic execution path:

```text
OpenClaw Skill
 -> one high-level optional Skill tool
 -> trusted RequestContext v2
 -> bounded workflow compiler
 -> Synthetic Skill Orchestrator
 -> Capability Gateway
 -> approved synthetic implementation
 -> Skill / Gateway / Execution audit evidence
```

The implementation remains synthetic-only and pre-staging. It does not enable real employee data, formal READY, requirement completion commits, review decisions, notifications, artifact export, external writes, Growth Write, production memory, or production deployment.

## 2C-1 Contract alignment — PASS

- All six Skill definitions now require `RequestContext.contextVersion = "2"`.
- Runtime configuration declares and validates `contracts.requestContext = "v2"`; stale `v1` is rejected.
- `STEP2-SYNTHETIC-SKILL-RUNTIME-V1` explicitly activates exactly six Skills, 12 workflows and 18 reviewed read/analyze/draft Capability IDs in `environment=test` with `syntheticOnly=true`.
- The base Capability Registry remains unchanged and closed: 18 `PLANNED_TEST_STUB`, zero enabled feature flags, zero implementation bindings, zero physical tool bindings and zero connector bindings.
- Formal state change, outbound message, external side effect, real customer data and generic fallback are fixed false in the activation/runtime result.

## 2C-2 Skill packaging — PASS

Six workspace Skill bundles were added:

- `workspace-template/skills/onboarding_task_navigation_pack/SKILL.md`
- `workspace-template/skills/onboarding_case_intake_pack/SKILL.md`
- `workspace-template/skills/onboarding_requirement_tracking_pack/SKILL.md`
- `workspace-template/skills/onboarding_status_control_pack/SKILL.md`
- `workspace-template/skills/onboarding_coordination_pack/SKILL.md`
- `workspace-template/skills/onboarding_delivery_pack/SKILL.md`

Each bundle uses its canonical underscore Skill ID, lists only its registered workflows, references exactly one controlled high-level tool and states the trusted-runtime, `A2_DRAFT`, no-fallback and no-formal-action boundaries. Packaging tests verify the exact six-directory set and registry consistency.

## 2C-3 Controlled runtime plugin — PASS (repo-local)

New optional high-level tools:

- `aibang_hr_onboarding_task_navigation`
- `aibang_hr_onboarding_case_intake`
- `aibang_hr_onboarding_requirement_tracking`
- `aibang_hr_onboarding_status_control`
- `aibang_hr_onboarding_coordination`
- `aibang_hr_onboarding_delivery`

The plugin admits only `aibang-hr-onboarding-agent` on Feishu when the trusted `(agentAccountId, requesterSenderId)` pair uniquely resolves. Tenant, DataSpace, Actor, Team, membership, roles and scope grants are created from trusted runtime configuration, never from model parameters. Tool schemas accept only minimal workflow-specific business inputs. They do not expose the 18 low-level Capability IDs.

The plugin still contains `aibang_hr_onboarding_test_ready_card` only as a deprecated compatibility path. The pre-cutover policy temporarily allows it; the target policy removes it from the Agent allowlist after the new Hero Flow succeeds. No second long-term Skill implementation was introduced.

Server-side plugin validation and actual OpenClaw tool registration remain rollout checks because this task did not modify the server runtime.

## 2C-4 Skill → Gateway → Executor — PASS (local synthetic runtime)

- `Step2SyntheticSkillRuntime` is the single composition root used by all six new plugin tools.
- Workflow-specific strict schemas reject unknown inputs and Capability injection.
- `Step2SkillRequestCompiler` deterministically derives Capability requests from the frozen Skill Registry.
- The plugin does not import the Gateway, Executor or individual adapters; it can enter business execution only through the Step 2 runtime.
- Each child Capability receives independent Gateway and execution audit events. Skill audit is separate.
- Audit unavailability at Skill, Gateway or Execution level fails closed with zero implementation calls.
- Existing Gateway/executor authorization, scope, schema/digest, review and idempotency controls remain in place.
- All 12 approved workflows execute in the synthetic runtime with zero generic tool fallback.

Primary Hero Flow evidence:

- Skill/workflow: `onboarding_delivery_pack/day1_ready_card_candidate`
- Capability requests: 2
- Implementation calls: 2
- Audit events: Skill 6, Gateway 4, Execution 4
- Result: `COMPLETED`, recommendation/draft only

Secondary path evidence:

- Skill/workflow: `onboarding_status_control_pack/case_status_inspection`
- Capability requests: 3
- Implementation calls: 3
- Audit events: Skill 8, Gateway 6, Execution 6
- Result: `COMPLETED`, read/analyze only

Both paths report no formal state change, no outbound message, no external side effect, no real customer data and no unsafe fallback.

## Data-store boundary

The Step 1 Team-scoped SQLite Case store and the existing synthetic Capability Store are **not yet one canonical store**. The deprecated Ready-card compatibility tool uses the Step 1 SQLite store. The six Step 2 tools use a principal-scoped clone of the existing in-memory synthetic Capability Store. This is intentional for the current synthetic integration gate and must be resolved before staging can claim one persistent business truth source.

## 2C-5 Tool lockdown design — PASS

Two repo-side policy fragments were added without touching live OpenClaw configuration:

- `config/openclaw.step2-precutover.example.json`: exactly six Skills, six Step 2 tools plus deprecated rollback tool.
- `config/openclaw.step2-target.example.json`: exactly six Skills and six Step 2 tools; deprecated tool removed.

Both use `tools.profile = minimal`, disable elevated tools and deny generic filesystem, runtime, web, messaging, exec, browser, HTTP and database access. Skill visibility is treated as discovery only; Tool policy remains the authorization boundary. Rollout and rollback steps are documented in `docs/STEP2_SERVER_ROLLOUT.md`.

## 2C-6 Regression and security — PASS (local applicable checks)

Final local test result:

- Test files: **17 passed**
- Tests: **256 passed**
- Step 1 floor retained: **14 files / 220 tests**
- Added: **3 files / 36 tests**
- Deleted or weakened baseline tests: **none**

Additional results:

- TypeScript typecheck: PASS
- MVP build: PASS
- Runtime config validator: PASS
- Capability Registry validator: PASS
- Engineering baseline validator: PASS
- Navigation smoke: PASS
- Capability Gateway default-deny smoke: PASS
- Read/analyze adapter smoke: PASS
- Draft adapter smoke: PASS
- Original Skill orchestrator smoke: PASS
- Step 2 Skill runtime Hero + secondary smoke: PASS
- Plugin entry syntax check: PASS
- Plugin manifest and policy JSON parse: PASS
- `git diff --check`: PASS
- Changed-file security scan: no real employee data, real Feishu ID/Secret, private key, customer endpoint or production configuration found.

The E0 static candidate validator is not counted as an applicable Step 2 PASS. Its frozen manifest pins the pre-Step-2 `config/runtime.test.json`; it correctly reports `FILE_DIGEST_MISMATCH` after RequestContext moved from v1 to v2. A new E0 snapshot and independent digest approval are separate governance work and were not fabricated in this implementation.

Security coverage includes trusted Bot/Sender admission and cross-pair denial, forged identity rejection, v1 context rejection, exact Skill/workflow activation, Capability injection rejection, reserved/formal action unavailability, Gateway-only plugin routing, audit fail-closed behavior, Team/private boundary regression, tenant/actor idempotency isolation and fixed no-side-effect assertions.

## 2C-7 Evidence — PASS

This report, focused tests, full regression output, smoke output, policy examples and rollout guide provide the local implementation evidence. The implementation is committed and pushed only during the explicitly authorized Git closeout; use `git rev-parse HEAD` to resolve the immutable commit containing this report.

## Files changed or added

Runtime/contracts:

- `src/contracts/runtime-config.ts`
- `src/skills/registry.ts`
- `src/skills/runtime-inputs.ts`
- `src/skills/runtime-request-compiler.ts`
- `src/skills/step2-activation-profile.ts`
- `src/skills/step2-runtime.ts`
- `src/cli/smoke-step2-skill-runtime.ts`
- `config/runtime.test.json`
- `package.json`

OpenClaw packaging/policy:

- `workspace-template/skills/*/SKILL.md` (six bundles)
- `workspace-template/AGENTS.md`
- `openclaw-test-tool/index.mjs`
- `openclaw-test-tool/openclaw.plugin.json`
- `openclaw-test-tool/package.json`
- `config/openclaw.step2-precutover.example.json`
- `config/openclaw.step2-target.example.json`

Tests:

- `tests/runtime-config.test.ts`
- `tests/step2-skill-runtime.test.ts`
- `tests/openclaw-skill-packaging.test.ts`
- `tests/openclaw-tool-policy.test.ts`

Documentation:

- `README.md`
- `docs/FEISHU_SYNTHETIC_TEST_TOOL.md`
- `docs/STEP2_SERVER_ROLLOUT.md`
- `chatgpt_to_codex/STEP2_IMPLEMENTATION_REPORT.md`

## Unresolved server-only checks

- Build/install the plugin on OpenClaw 2026.9.4 and run its native plugin validator.
- Copy the six Skill bundles to the HR Agent workspace and verify Skill discovery/check output.
- Merge (not replace) the reviewed per-Agent policy while preserving other Agents and plugin permissions.
- Verify actual runtime tool registration and trusted principal binding.
- Run the primary and secondary flows through the controlled Feishu test route.
- Remove the deprecated Ready-card tool from the HR Agent allowlist only after both new paths pass.
- Decide and implement the persistent canonical store before staging acceptance.
- Re-freeze E0 inputs only through the separately approved eval-governance process.

## P0 non-goals

Still closed: real customer/employee data, real Connector/MCP execution, formal READY, completion commit, waiver/exception commit, review decision commit, outbound notification, artifact export, external write, Growth Write, production memory, staging deployment, production release and Step 3 work.

