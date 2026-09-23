# 飞书受控合成案例测试工具

状态：本地代码与核心测试完成；尚未在云服务器安装、启用或验证 OpenClaw 插件。此工具不是正式业务发布。

## 能做什么

- 由 `hr-bot-01` 的受控测试账号发问，读取一条 synthetic `OnboardingCase`，生成 Day-1 Ready 建议卡草稿；模型只负责解释工具返回的结构化结果。
- 工具只接受 OpenClaw 在运行时提供的 Agent ID、Feishu 渠道、`hr-bot-01` 账号和 `requesterSenderId` 同时匹配的调用；发送者必须存在于插件配置的 `trustedPrincipals` 映射中。Tenant、Actor、Team、membership、角色和权限范围全部来自该可信配置。模型参数只有 `caseRef`，不能自行提供或覆盖这些身份字段。
- SQLite 数据库必须位于仓库外。工具不发送消息，不提交正式 `READY`，不调用真实 Connector；聊天回复仍由当前 OpenClaw/飞书路由发送。

## 当前验证

`pnpm typecheck`、`pnpm build:mvp`、`pnpm test` 通过；Step 1 本地基线为 217 项测试通过。`seed:mvp` 已在新的本地临时数据库生成 Team-scoped Case，Case Version 为 4。变更后的多主体插件配置仍须在服务器版 OpenClaw 上重新校验后才能启用。

## 服务器安装前的检查与步骤

1. 只在服务器仓库 `/home/xb/.openclaw/workspace-aibang-hr-onboarding/HR` 已同步到包含本工具的提交后执行。先检查 `git status --short` 和 `git log -1 --oneline`，保留所有已有改动。
2. 运行 `corepack pnpm install --frozen-lockfile`、`corepack pnpm typecheck`、`corepack pnpm test`、`corepack pnpm build:mvp`。
3. 在仓库外创建合成测试目录，例如 `/home/xb/.openclaw/hr-onboarding-test`。用 `corepack pnpm seed:mvp /home/xb/.openclaw/hr-onboarding-test/synthetic.sqlite` 写入演示 Case，并保存输出的 `caseRef`。重复运行会返回同一 Case。
4. 插件位于 `openclaw-test-tool/`，需要安装其运行依赖 `typebox` 与 `zod`。入口使用 `defineToolPlugin` 静态元数据；先按 OpenClaw 本机版本执行 `openclaw plugins build --check --root /home/xb/.openclaw/workspace-aibang-hr-onboarding/HR/openclaw-test-tool --entry ./index.mjs`，再执行 `openclaw plugins validate --root /home/xb/.openclaw/workspace-aibang-hr-onboarding/HR/openclaw-test-tool --entry ./index.mjs`。若校验失败，先查看错误，不要改变共享 Gateway 或其他 Agent 的配置。
5. 插件配置必须明确设置 `trustedPrincipals`、`databasePath`（上述仓库外绝对路径）、`repositoryRoot`（上述 HR 仓库绝对路径）。每个可信主体包含运行时 Feishu `open_id`、Tenant、Team DataSpace、Actor、active Team、membership、角色和 scope grants；真实 `open_id` 不写入 Git。安装本地链接插件前，审阅其 `contracts.tools`，仅同意 `aibang_hr_onboarding_test_ready_card`。
6. 先读取 `openclaw config get agents.entries.aibang-hr-onboarding-agent.tools --json` 与全局工具策略，再只为这个 Agent 增加该单一工具的许可。不得改动其他 Agent 的工具策略。启用后以 `openclaw plugins inspect aibang-hr-onboarding-test --runtime --json` 与飞书测试消息核对。
7. 将 `workspace-template/AGENTS.md` 与 Agent 工作区的 `AGENTS.md` 做逐项差异检查后同步；该文件允许受控测试回复，但不允许主动外发或真实业务数据。

任何一步失败，停止后续启用。回退优先移除本 Agent 对该工具的许可、禁用插件；保留合成 SQLite 供诊断，不触碰其他 Agent 的路由与配置。
