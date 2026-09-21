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
- Task Navigation Contract：`v0.3 reviewed`
- Task Navigation Runtime：N1—N7 server verified；10—11 Runtime Cross-check passed
- Skill Pack / Capability Contract：`v0.3 reviewed`
- Skill Pack Runtime：S1—S6 server verified；Stage 12 Runtime Cross-check passed
- Capability Registry：18 planned、0 enabled；12 reserved、0 registered
- Capability Gateway：S2 server verified；default all denied；0 implementation invoked
- Read / Analyze Adapters：S3 server verified；13 synthetic test implementations；default runtime disabled
- Draft Adapters：S4 server verified；5 synthetic test implementations；DRAFT / NOT_SENT only
- Skill Orchestrators：S5 server verified；6 synthetic Skill contracts；child Capability independent admission/audit
- Security Matrix：S6 server verified；NEG-001—NEG-012 plus version/schema/binding/idempotency isolation

## 目录

```text
config/                 安全启动配置
docs/                   工程决策与部署说明
fixtures/synthetic/     合成测试数据
src/contracts/          配置和运行时契约
src/capabilities/       Capability Registry、Profile、Schema与Reason Code
src/navigation/         Intent、Subject、Authorization、Route 与生命周期
src/audit/              合成导航审计接口和内存测试实现
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
pnpm test:security
pnpm validate:config
pnpm validate:capabilities
pnpm smoke:gateway
pnpm smoke:adapters
pnpm smoke:drafts
pnpm smoke:skills
pnpm smoke:navigation
```

当前导航实现支持合成环境中的P0 Intent分类、复合请求拆分、Tenant/DataSpace Gate、确定性Subject Resolution、显式Scope Grant预检、Read/Analyze/Draft Mock Capability、Default Deny、全出口Audit和幂等抑制。它不会连接真实业务系统，也不会产生外部副作用。

S1已经把12的18个业务Capability建立为严格的代码合同，但它们全部保持`PLANNED_TEST_STUB`：没有Implementation Binding、Feature Flag、OpenClaw Tool或Connector，因此当前可执行数量为0。现有`read_stub / analyze_stub / draft_stub`仍只属于11的Navigation Test Harness。

S2已经增加Capability Candidate Resolution与统一Gateway：对Registry、版本、环境、Tenant/DataSpace、Authorization、PHC、Review、Schema/Digest、Collection Cursor和Implementation/Tool/Connector Binding执行固定顺序的Default Deny检查。默认运行态仍拒绝全部18项业务Capability；S2本身不调用任何实现。

S3已经实现13个Read/Analyze Synthetic Adapter及严格执行器，覆盖Intake、Case、Requirement、Risk、Evidence、Responsibility、Readiness、Artifact和Audit。它们只在显式Test Harness中可注入；默认Runtime Config、正式Registry和OpenClaw均保持0个业务Capability启用。

S4已经实现5个Draft Synthetic Adapter。所有输出都经过`DraftArtifactResultV1`校验，并固定为`DRAFT / NOT_SENT / formalStateChanged=false / externalSideEffect=false`；PHC-3/4路径必须先满足Review Gate，且不存在正式决策或发送字段。

S5已经实现6个合成Skill Orchestrator合同与12条受控Workflow。每个Child Capability都使用独立Request、Gateway Admission、Authorization Decision和Audit；任一步骤拒绝、等待、Review或失败都会停止后续步骤，不继承前一步Allow，也不使用Generic Tool Fallback。Practice路径只生成Handoff Candidate，不创建正式Review或专业决定。

S6已经把NEG-001—NEG-012固化为可执行安全矩阵，覆盖Reserved Side Effect、Tenant/DataSpace与同租户Scope隔离、Cursor/Count/Field泄漏、Readiness注入、Version/Schema、Idempotency、Binding、Audit和Prompt/Tool Injection。所有负向路径保持零正式写入、零发送和零外部副作用。

## 云服务器位置

```text
Workspace: /home/xb/.openclaw/workspace-aibang-hr-onboarding
Repository: /home/xb/.openclaw/workspace-aibang-hr-onboarding/HR
Agent Dir: /home/xb/.openclaw/agents/aibang-hr-onboarding-agent/agent
```

`workspace-template` 是可审查的模板，不会自动覆盖服务器上的 Workspace。部署前必须先备份现有文件并人工核对差异。

## 当前不代表

完成本骨架和Task Navigation Test Harness不代表整体Agent Engineering Ready、Pilot Ready或Production Ready。导航模块尚未注册为OpenClaw Tool；真实员工数据、飞书绑定、业务系统Connector、正式状态提交和对外发送必须等待12—16及后续Gate。
