# Cloud Server Sync Runbook

目标位置：

```text
Workspace: /home/xb/.openclaw/workspace-aibang-hr-onboarding
Repository: /home/xb/.openclaw/workspace-aibang-hr-onboarding/HR
Agent Dir: /home/xb/.openclaw/agents/aibang-hr-onboarding-agent/agent
```

## 1. 更新代码与验证

在服务器仓库目录执行：

```bash
git status --short
git pull --ff-only
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm validate:config
```

如果 `git status --short` 存在未提交修改，停止同步并先确认修改归属。

## 2. Workspace 模板差异检查

不要直接覆盖 Workspace 根目录。先逐个比较：

```bash
cd /home/xb/.openclaw/workspace-aibang-hr-onboarding
diff -u IDENTITY.md HR/workspace-template/IDENTITY.md
diff -u AGENTS.md HR/workspace-template/AGENTS.md
diff -u SOUL.md HR/workspace-template/SOUL.md
diff -u USER.md HR/workspace-template/USER.md
```

文件不存在或差异符合预期时，再人工备份并同步。不得复制 `.env`、Secret、Token、Session 数据库或其他 Agent 文件。

## 3. 运行态验收

同步后检查：

```bash
openclaw agents list --bindings
```

验收条件：

- Agent ID 为 `aibang-hr-onboarding-agent`；
- Workspace 和 agentDir 与目标路径一致；
- Identity 显示为 `hr-onboarding`；
- 没有飞书或其他渠道绑定；
- 没有真实 Connector；
- 其他 Agent 的 ID、Workspace、agentDir 和绑定未变化。

未满足任何一项时停止，不进入 11 Task Navigation 的服务器装载。
