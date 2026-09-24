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
- Capability Registry：18 planned、0 enabled；17 reserved、0 registered
- Capability Gateway：S2 server verified；default all denied；0 implementation invoked
- Read / Analyze Adapters：S3 server verified；13 synthetic test implementations；default runtime disabled
- Draft Adapters：S4 server verified；5 synthetic test implementations；DRAFT / NOT_SENT only
- Skill Orchestrators：S5 server verified；6 synthetic Skill contracts；child Capability independent admission/audit
- Step 2 Skill Runtime：6 个 OpenClaw Skill bundle、6 个高层受控工具、12 条工作流；仅显式 synthetic test activation profile 可执行
- Security Matrix：S6 server verified；NEG-001—NEG-012 plus version/schema/binding/idempotency isolation
- Agent Engineering Baseline：10—16 Manifest v1；3 Practice、7 P0 Output、12 Security Control和11 Formal Action均为严格禁用态

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
pnpm validate:baseline
# 仅在10—16源文档位于仓库父目录时执行内容Digest核验
pnpm verify:baseline-docs
pnpm smoke:gateway
pnpm smoke:adapters
pnpm smoke:drafts
pnpm smoke:skills
pnpm smoke:step2
pnpm smoke:navigation
```

当前导航实现支持合成环境中的P0 Intent分类、复合请求拆分、Tenant/DataSpace Gate、确定性Subject Resolution、显式Scope Grant预检、Read/Analyze/Draft Mock Capability、Default Deny、全出口Audit和幂等抑制。它不会连接真实业务系统，也不会产生外部副作用。

S1已经把12的18个业务Capability建立为严格的代码合同，但它们全部保持`PLANNED_TEST_STUB`：没有Implementation Binding、Feature Flag、OpenClaw Tool或Connector，因此当前可执行数量为0。现有`read_stub / analyze_stub / draft_stub`仍只属于11的Navigation Test Harness。

S2已经增加Capability Candidate Resolution与统一Gateway：对Registry、版本、环境、Tenant/DataSpace、Authorization、PHC、Review、Schema/Digest、Collection Cursor和Implementation/Tool/Connector Binding执行固定顺序的Default Deny检查。默认运行态仍拒绝全部18项业务Capability；S2本身不调用任何实现。

S3已经实现13个Read/Analyze Synthetic Adapter及严格执行器，覆盖Intake、Case、Requirement、Risk、Evidence、Responsibility、Readiness、Artifact和Audit。它们只在显式Test Harness中可注入；默认Runtime Config、正式Registry和OpenClaw均保持0个业务Capability启用。

S4已经实现5个Draft Synthetic Adapter。所有输出都经过`DraftArtifactResultV1`校验，并固定为`DRAFT / NOT_SENT / formalStateChanged=false / externalSideEffect=false`；PHC-3/4路径必须先满足Review Gate，且不存在正式决策或发送字段。

S5已经实现6个合成Skill Orchestrator合同与12条受控Workflow。每个Child Capability都使用独立Request、Gateway Admission、Authorization Decision和Audit；任一步骤拒绝、等待、Review或失败都会停止后续步骤，不继承前一步Allow，也不使用Generic Tool Fallback。Practice路径只生成Handoff Candidate，不创建正式Review或专业决定。

S6已经把NEG-001—NEG-012固化为可执行安全矩阵，覆盖Reserved Side Effect、Tenant/DataSpace与同租户Scope隔离、Cursor/Count/Field泄漏、Readiness注入、Version/Schema、Idempotency、Binding、Audit和Prompt/Tool Injection。所有负向路径保持零正式写入、零发送和零外部副作用。

Step 2 将六个 Skill 打包到 `workspace-template/skills/`，并通过六个可选高层工具进入统一的 synthetic runtime composition root。业务参数先由工作流专用 schema 收敛，再由运行时确定性构造 Capability 请求；模型不能提供身份、授权决定或任意 Capability ID。基础 Capability Registry 仍保持全关闭，只有显式测试激活配置可以把 18 个安全的读取、分析和草稿实现组合进测试运行时。目标 Agent 配置示例使用 `minimal` 工具策略并拒绝通用文件、运行时、网络、消息、浏览器、HTTP 和数据库回退。

## 云服务器位置

```text
Workspace: /home/xb/.openclaw/workspace-aibang-hr-onboarding
Repository: /home/xb/.openclaw/workspace-aibang-hr-onboarding/HR
Agent Dir: /home/xb/.openclaw/agents/aibang-hr-onboarding-agent/agent
```

`workspace-template` 是可审查的模板，不会自动覆盖服务器上的 Workspace。部署前必须先备份现有文件并人工核对差异。

## 当前不代表

Agent Engineering Baseline Ready只表示10—16合同、Manifest和默认拒绝测试可作为后续设计及逐项授权合成工程的输入，不代表业务Capability Runtime、Customer Activation、Pilot、Staging或Production Ready。导航模块尚未注册为OpenClaw Tool；真实员工数据、飞书绑定、业务系统Connector、正式状态提交和对外发送仍全部关闭。
