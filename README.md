# hr-onboarding

`hr-onboarding` 是面向入职 HR / HR Operations 的新员工入职交付智能体骨架。它围绕 `OnboardingCase` 工作，当前只允许在合成数据环境执行读取、分析和草稿任务。

## 当前工程基线

- Agent ID：`aibang-hr-onboarding-agent`
- Display Name：`hr-onboarding`
- OpenClaw：`2026.9.4`（固定版本，暂不自动升级）
- Node.js：`24.21.0`
- Package Manager：pnpm
- Runtime Mode：`test`
- Automation Ceiling：`A2_DRAFT`
- Channel / Connector：全部关闭
- Real Customer Data：禁止
- Formal Commit / External Side Effect：禁止

## 目录

```text
config/                 安全启动配置
docs/                   工程决策与部署说明
fixtures/synthetic/     合成测试数据
src/contracts/          配置和运行时契约
src/validation/         启动前确定性校验
src/cli/                本地校验入口
tests/                  安全边界测试
workspace-template/     OpenClaw Agent Workspace 模板
```

## 本地验证

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm validate:config
```

## 云服务器位置

```text
Workspace: /home/xb/.openclaw/workspace-aibang-hr-onboarding
Repository: /home/xb/.openclaw/workspace-aibang-hr-onboarding/HR
Agent Dir: /home/xb/.openclaw/agents/aibang-hr-onboarding-agent/agent
```

`workspace-template` 是可审查的模板，不会自动覆盖服务器上的 Workspace。部署前必须先备份现有文件并人工核对差异。

## 当前不代表

完成本骨架不代表 Agent Engineering Ready、Pilot Ready 或 Production Ready。真实员工数据、飞书绑定、业务系统 Connector、正式状态提交和对外发送必须等待后续设计与 Gate。
