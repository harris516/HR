# Base Agent Scaffold Implementation Profile

## 冻结决策

| 项目 | 决策 |
|---|---|
| Agent ID | `aibang-hr-onboarding-agent` |
| Display Name | `hr-onboarding` |
| OpenClaw | npm 安装，固定 `2026.9.4` |
| Node.js | `24.21.0` |
| Language | TypeScript |
| Package Manager | pnpm |
| Validation | Zod |
| Test | Vitest |
| Server OS | Ubuntu Linux x86_64 |
| Deployment Stage | Shared Gateway / isolated Agent / test only |
| Repository | `https://github.com/harris516/HR` |
| Server Repository Path | `/home/xb/.openclaw/workspace-aibang-hr-onboarding/HR` |
| Agent Workspace | `/home/xb/.openclaw/workspace-aibang-hr-onboarding` |
| Agent Dir | `/home/xb/.openclaw/agents/aibang-hr-onboarding-agent/agent` |
| Feishu Binding | 暂时解除 |

## 隔离规则

- 不与其他 Agent 共用 workspace 或 agentDir；
- 当前共享 Gateway 只属于同一受信任运营边界，不构成客户租户隔离；
- 进入真实客户 Pilot 前迁移到独立 Gateway、容器或虚拟机；
- 仓库不得提交 Secret、Token、真实员工数据或 Session 数据库；
- `workspace-template` 需经人工差异检查后才能同步到 Agent Workspace 根目录。

## Scaffold Gate

基础骨架只有在以下检查全部通过后才可装载：

1. 类型检查通过；
2. Runtime Config 测试通过；
3. Agent ID 与 Display Name 匹配；
4. Automation Ceiling 为 `A2_DRAFT`；
5. Channel 和 Connector Binding 为空；
6. 所有真实数据与外部副作用 Feature Flag 为 false；
7. OpenClaw 和 Node.js 版本与冻结值一致；
8. Workspace 模板不包含 Secret 或真实人员信息。

通过本 Gate 只表示 Base Agent Scaffold 可装载，不表示 Agent Engineering、Pilot 或 Production Ready。
