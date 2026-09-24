# 飞书受控合成案例测试工具

状态：Step 2.5 本地持久化合成业务闭环已实现；尚未在云服务器安装、启用或验证新版 OpenClaw Skill runtime。此工具不是正式业务发布。

## 能做什么

- 由受控测试 Feishu Bot 与测试发送者发问，经六个 OpenClaw Skill 对应的高层工具进入统一 Step 2 runtime；支持 14 条已批准工作流，包括 synthetic `OnboardingCase` 创建、准备项更新、查询、分析与草稿生成。同一个 `aibang-hr-onboarding-agent` 可承接多个独立 Bot。
- 工具只接受 OpenClaw 在运行时提供的 Agent ID、Feishu 渠道以及 `(agentAccountId, requesterSenderId)` 联合身份同时匹配的调用。该联合键必须在插件配置的 `trustedPrincipals` 中唯一命中；未知 Bot、未知发送者、Bot 与发送者错配或重复映射均拒绝。Tenant、Actor、Team、membership、角色和权限范围全部来自该可信配置。模型参数只有 `caseRef`，不能自行提供或覆盖这些身份字段。
- 六个 Step 2 高层工具和旧 Ready-card 兼容工具现在读取同一份仓库外 SQLite 核心业务真值。风险、责任和 Artifact 等尚未进入 P0 核心闭环的展示数据仍是只读合成补充数据，不得被当作案例主状态。
- `onboarding_case_intake_pack` 新增 `synthetic_case_create_from_accepted_offer`；`onboarding_requirement_tracking_pack` 新增 `synthetic_requirement_completion_update`。两者仅通过独立的 Step 2.5 合成 Mutation Gateway 开放，不会启用正式写 Capability，也不暴露任意数据库写入或 patch 接口。
- Step 2 工具不发送消息，不提交正式 `READY`，不调用真实 Connector；聊天回复仍由当前 OpenClaw/飞书路由发送。

## 当前验证

本地验收包含 `pnpm typecheck`、`pnpm build:mvp`、`pnpm test`、`pnpm smoke:step2` 与 `pnpm smoke:step2.5`；最终数量见 `chatgpt_to_codex/STEP2_5_IMPLEMENTATION_REPORT.md`。服务器上的插件注册、Skill 发现、Agent 白名单和飞书 Hero Flow 仍须在服务器版 OpenClaw 上重新校验后才能启用。

## 服务器安装前的检查与步骤

1. 只在服务器仓库 `/home/xb/.openclaw/workspace-aibang-hr-onboarding/HR` 已同步到包含本工具的提交后执行。先检查 `git status --short` 和 `git log -1 --oneline`，保留所有已有改动。
2. 运行 `corepack pnpm install --frozen-lockfile`、`corepack pnpm typecheck`、`corepack pnpm test`、`corepack pnpm build:mvp`。
3. 在仓库外创建合成测试目录，例如 `/home/xb/.openclaw/hr-onboarding-test`。用 `corepack pnpm seed:mvp /home/xb/.openclaw/hr-onboarding-test/synthetic.sqlite` 写入演示 Case，并保存输出的 `caseRef`。重复运行会返回同一 Case。
4. 插件位于 `openclaw-test-tool/`，需要安装其运行依赖 `typebox` 与 `zod`。入口使用 `defineToolPlugin` 静态元数据；先按 OpenClaw 本机版本执行 `openclaw plugins build --check --root /home/xb/.openclaw/workspace-aibang-hr-onboarding/HR/openclaw-test-tool --entry ./index.mjs`，再执行 `openclaw plugins validate --root /home/xb/.openclaw/workspace-aibang-hr-onboarding/HR/openclaw-test-tool --entry ./index.mjs`。若校验失败，先查看错误，不要改变共享 Gateway 或其他 Agent 的配置。
5. 插件配置必须明确设置 `trustedPrincipals`、`databasePath`（统一合成业务真值的仓库外绝对路径）、`repositoryRoot`（上述 HR 仓库绝对路径）。每个可信主体包含运行时 Feishu `accountId` 与 `open_id`、Tenant、Team DataSpace、Actor、active Team、membership、角色和 scope grants；`(accountId, open_id)` 必须唯一。合成 Mutation 还要求显式 `scope-mvp-synthetic-team-write`。真实 `accountId`、`open_id` 和 Secret 不写入 Git。安装前审阅其 `contracts.tools`：六个 Step 2 高层工具是目标路径，旧 `aibang_hr_onboarding_test_ready_card` 仅在 pre-cutover 回滚窗口临时保留。
6. 先读取当前 HR Agent 与全局工具策略，再按 `config/openclaw.step2-precutover.example.json` 合并本 Agent 的六 Skill 和工具策略，不覆盖其他 Agent 或已有插件许可。新 Hero Flow 与次流程验证通过后，按 `config/openclaw.step2-target.example.json` 移除旧 Ready-card 工具许可。启用后以插件运行态检查、Skill 检查和飞书测试消息核对。
7. 将 `workspace-template/AGENTS.md` 与 Agent 工作区的 `AGENTS.md` 做逐项差异检查后同步；该文件允许受控测试回复，但不允许主动外发或真实业务数据。

任何一步失败，停止后续启用。回退优先恢复 pre-cutover 工具白名单或禁用插件；保留合成 SQLite 供诊断，不触碰其他 Agent 的路由与配置。完整顺序见 `docs/STEP2_SERVER_ROLLOUT.md`。
