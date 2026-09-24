# Step 2 Server Rollout — Review Instructions

Status: repository-side example only. Do not apply automatically and do not replace unrelated Agent or plugin configuration.

## Boundary

Step 2 remains synthetic-only and pre-staging. It does not authorize real employee data, formal READY, formal status commits, outbound messages, exports, Connector calls, external writes or Growth Write.

The repository examples contain only the `aibang-hr-onboarding-agent` fragment. On the server, merge that one Agent entry into the existing configuration; preserve every unrelated Agent, binding, plugin and channel entry. Before enabling the local plugin, add `aibang-hr-onboarding-test` to the existing `plugins.allow` list without removing the other trusted plugin IDs.

## Phase A — pre-cutover

Use `config/openclaw.step2-precutover.example.json` only after code review and build. It exposes the six new Skill runtime tools and temporarily retains `aibang_hr_onboarding_test_ready_card` for rollback compatibility.

1. Sync the reviewed commit and confirm a clean repository.
2. Build the plugin and validate its manifest against OpenClaw 2026.9.4.
3. Copy the six directories under `workspace-template/skills/` into the HR Agent workspace `skills/` directory.
4. Run OpenClaw Skill list/check for `aibang-hr-onboarding-agent`; confirm exactly six HR Skills are visible.
5. Inspect the effective per-Agent tool policy. It must use `minimal`, not `full`; elevated, exec, filesystem, web, generic messaging and generic DB access must be unavailable.
6. Merge the pre-cutover Agent fragment while preserving unrelated configuration.
7. Validate the full server configuration before restarting or reloading the Gateway.
8. Probe the existing `hr-bot-01` trusted principal and execute the delivery Hero Flow plus `case_status_inspection` using synthetic data only.

Any validation, Skill discovery, tool-policy or Hero Flow failure stops rollout. Do not weaken policy to make a test pass.

## Phase B — target posture

After both new flows pass and their Skill, Gateway and Execution audit references are present, replace only the HR Agent fragment with `config/openclaw.step2-target.example.json`. This removes the legacy Ready-card Tool from the Agent allowlist but does not delete plugin code yet.

Confirm after cutover:

- six Skills visible;
- six Step 2 tools callable;
- legacy Ready-card Tool unavailable to this Agent;
- generic tools unavailable;
- formal state unchanged;
- no outbound message or external side effect;
- other Agents and their bindings unchanged.

Rollback consists of restoring the reviewed pre-cutover Agent fragment. Do not modify Feishu credentials, live Step 1 SQLite or another Agent during rollback.
