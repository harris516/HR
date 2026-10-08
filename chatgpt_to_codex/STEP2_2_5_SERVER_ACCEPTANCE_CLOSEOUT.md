# Step 2 / Step 2.5 Server Acceptance Closeout

| 项目 | 冻结值 |
| --- | --- |
| Document Status | `SERVER_ACCEPTANCE_CLOSEOUT_CANDIDATE` |
| Baseline Commit | `e762b9e2c3bac2fbe87a577c5eafe067a0a5e4a0` |
| Baseline Commit Message | `Fix Mark ready card delivery routing` |
| Plugin | `aibang-hr-onboarding-test@0.2.10` |
| Final Regression | `19 test files / 345 tests PASS` |
| Hero Flow | `A-F END-TO-END PASS` |
| Server Evidence Freeze | `step2-2_5-acceptance-20261008T091514` |

> 本文档是服务器验收收口候选件，不是生产就绪声明。最终 `FROZEN` 状态须由 Phase 3 人工验收确认。

## 1. Closeout Decision

Step 2 / Step 2.5 的 Synthetic MVP 工程实现、自动化回归与真实服务器 Mark Hero Flow A-F 已完成验收。基于仓库基线与本次任务明确提供的服务器冻结事实，本阶段结论为：

`MARK HERO FLOW A-F = END-TO-END PASS`

允许结束 Step 2 / Step 2.5 的继续开发与修复活动，并以本文档记录的工程基线、安全边界、证据索引和不可回归条件作为 Step 3 的入口约束。

本结论仅覆盖 Synthetic MVP。它不表示真实员工数据、生产连接器、自动 Formal READY、对外通知或企业级生产运维已经就绪。

## 2. Accepted Scope

本次验收接受以下范围：

- 通过飞书自然语言完成合成入职案例的受控创建、三个 P0 准备项更新、持久状态读取和准备卡草稿生成；
- 业务请求经过任务导航、指定 Skill、受控 Runtime Tool、授权校验和持久化实现，不依赖通用工具直接访问业务数据；
- 可信主体、租户、数据空间、团队、成员身份和角色范围参与访问控制；
- SQLite 保存 Synthetic MVP 的业务真值、版本、审计与幂等信息；
- 后续独立会话可以从持久存储重新解析并读取 Case，而不是把聊天记录当作业务真值；
- 准备度评估只生成候选建议和待复核草稿，不自动确认 Formal READY，不发送对外消息。

当前 P0 Requirement 仅包括：

- `DOCUMENTS`
- `IT_ACCOUNT`
- `DEVICE`

## 3. Frozen Engineering Baseline

### 3.1 Git 基线

- Branch：`main`
- Commit：`e762b9e2c3bac2fbe87a577c5eafe067a0a5e4a0`
- Commit message：`Fix Mark ready card delivery routing`
- 本 Closeout 编写前已核对：本地 `HEAD` 与 `origin/main` 均指向该 Commit，工作区无未提交改动。

该 Commit 是 Step 2 / Step 2.5 Server Acceptance 的最终代码基线。后续阶段不得在没有新变更审批和回归证据的情况下改变此处列出的 Runtime、Skill、Tool、数据和治理契约。

### 3.2 冻结对象

本次 Closeout 不修改并冻结以下既有实现：

- Runtime implementation
- Skill implementation 与 Routing contract
- SQLite schema
- Tool schema 与 Capability
- Plugin Runtime 与 Gateway
- Tenant / Team isolation
- Audit 与 Mutation Gateway
- Ready Card logic

## 4. Runtime / Skill / Tool Baseline

### 4.1 Plugin 与 Tool Surface

Plugin：`aibang-hr-onboarding-test`

Version：`0.2.10`

最终 Tool Surface 固定为 7 个：

1. `aibang_hr_onboarding_task_navigation`
2. `aibang_hr_onboarding_case_intake`
3. `aibang_hr_onboarding_requirement_tracking`
4. `aibang_hr_onboarding_status_control`
5. `aibang_hr_onboarding_coordination`
6. `aibang_hr_onboarding_delivery`
7. `aibang_hr_onboarding_test_ready_card`

其中 `aibang_hr_onboarding_test_ready_card` 是已弃用的 Step 1 compatibility / rollback tool。本阶段保留它，不把它恢复为新的主业务路径，也不删除它。

### 4.2 Skill Surface

Agent：`aibang-hr-onboarding-agent`

模型可见 Skill 固定为 6 个：

1. `onboarding_task_navigation_pack`
2. `onboarding_case_intake_pack`
3. `onboarding_requirement_tracking_pack`
4. `onboarding_status_control_pack`
5. `onboarding_coordination_pack`
6. `onboarding_delivery_pack`

Agent 使用 Skill allowlist。Workshop Skill、generic Skill 或其他无关 Skill 不属于当前正式基线。

### 4.3 Tool Policy

- `profile = minimal`
- 受控 HR Runtime Tools 通过 `alsoAllow` 开放；
- filesystem、runtime、web、messaging、exec、browser、http、db 等 generic tool groups / tools 已受限制；
- Elevated：`enabled = false`；
- Hero Flow 不依赖通用 shell、数据库、文件系统、HTTP 或浏览器直接访问业务数据；
- 业务数据必须经受控 Skill → Runtime Tool → Capability / Gateway → Implementation 路径处理。

## 5. Persistent Data Baseline

### 5.1 Synthetic Store

服务器 Synthetic SQLite：

`/home/xb/.openclaw/hr-onboarding-test-step1/synthetic.sqlite`

这是 Synthetic Test Runtime 数据库，不是生产员工数据库。Step 2.5 已实现：

- Synthetic Case Create
- Synthetic Requirement Update
- Persistent State
- Case Version 与 Requirement Version
- Audit 与 Idempotency
- Scoped Case Resolution 与 Candidate-name resolution
- optimistic concurrency / controlled mutation semantics
- Persistent Read

服务器验收冻结事实记录：`PRAGMA integrity_check = ok`。Closeout 阶段未重新 Seed、写入或修改该数据库。

### 5.2 Mark Hero Case

| 字段 | 冻结值 |
| --- | --- |
| Candidate | `Mark`（Synthetic） |
| Case | `case-synthetic-fa0d3d66-7801-47f4-b134-7c641bb6a522` |
| Case Version | `4` |
| Offer | `accepted` |
| plannedStartAt | `Unknown / null` |
| DOCUMENTS | `completed` |
| IT_ACCOUNT | `completed` |
| DEVICE | `completed` |
| markCases | `1` |
| requirements | `3` |
| auditEvents | `8` |
| SQLite integrity_check | `ok` |

以上为服务器验收冻结事实，不得在 Closeout 阶段改变。

## 6. Mark Hero Flow A-F Acceptance

### Turn A｜Create Case

飞书自然语言：

> 这是合成测试数据：刚给 Mark 发了一个 Offer，他已经接受。请为 Mark 创建入职案例。

执行路径：

`Task Navigation → onboarding_case_intake_pack → synthetic_case_create_from_accepted_offer → Persistent CREATE`

结果：Case Version = 1；`DOCUMENTS`、`IT_ACCOUNT`、`DEVICE` 均为 `not_started`；`plannedStartAt = Unknown`。

结论：`PASS`

### Turn B｜DOCUMENTS

飞书自然语言：

> 这是合成测试数据：Mark 的入职文件已经收齐。

执行路径：

`Task Navigation → onboarding_requirement_tracking_pack → synthetic_requirement_completion_update`

结果：`DOCUMENTS = completed`，Case Version = 2。

结论：`PASS`

### Turn C｜IT_ACCOUNT

飞书自然语言：

> 这是合成测试数据：Mark 的 IT 账号已经开好了。

执行路径：

`Task Navigation → onboarding_requirement_tracking_pack → synthetic_requirement_completion_update`

结果：`IT_ACCOUNT = completed`，Case Version = 3。

结论：`PASS`

### Turn D｜DEVICE

飞书自然语言：

> 这是合成测试数据：Mark 的电脑已经准备好了。

执行路径：

`Task Navigation → onboarding_requirement_tracking_pack → synthetic_requirement_completion_update`

结果：`DEVICE = completed`，Case Version = 4；三个 Requirement 全部 completed；Suggested Readiness 为 Ready Candidate / candidate-only readiness；Formal READY 未确认。

结论：`PASS`

### Turn E｜Persistent Status Read

飞书自然语言：

> 这是合成测试数据：Mark 现在的入职准备状态怎么样？

执行路径：

`Task Navigation → onboarding_status_control_pack → case_status_inspection → candidateDisplayName = Mark → scoped Case Resolution → Persistent SQLite Read`

读取结果：Case Version = 4；`DOCUMENTS`、`IT_ACCOUNT`、`DEVICE` 均为 `completed`；Formal READY 未确认。

该 Turn 从 Persistent Store 重新读取业务状态，没有使用聊天历史代替 Persistent Business Truth。

结论：`PASS`

### Turn F｜Ready Card Delivery

飞书自然语言：

> 这是合成测试数据：请给我生成 Mark 的入职准备卡供我复核。

执行路径：

`Task Navigation → onboarding_delivery_pack → day1_ready_card_candidate → candidateDisplayName = Mark → scoped Case Resolution → Version 4 → Readiness Evaluation → Ready Card Draft`

结果：

- Artifact Status = `DRAFT`
- Evaluation = `ELIGIBLE`
- Formal READY = 未修改
- HR Review = Required / Pending
- Outbound Message = `NOT_SENT`
- External Side Effect = `false`

结论：`PASS`

### End-to-End 结论

`MARK HERO FLOW A-F = END-TO-END PASS`

A-F 不只是界面测试。它共同证明了：

`Natural Language → Task Navigation → Skill / Workflow Routing → Trusted RequestContext → Tenant / Team Scoped Resolution → Controlled Runtime Tool → Persistent CREATE / UPDATE → SQLite Business Truth → independent later READ → Readiness Evaluation → Draft Artifact → Human Review Boundary`

其中 Turn E 与 Turn F 从 Persistent Store 独立读取 Version 4 状态，证明：

`Conversation ≠ Business Truth`

聊天上下文可以帮助理解请求，但不能替代持久化业务真值。

## 7. Security and Governance Acceptance

### 7.1 Trusted Principal 与多租户边界

当前服务器验收 Principal：

| 字段 | 值 |
| --- | --- |
| accountId | `hr-bot-01` |
| tenantId | `tenant-hr-001` |
| dataSpaceId | `dataspace-team-hr-onboarding-001` |
| actorId | `hr-user-001` |
| activeTeamId | `hr-onboarding-team-001` |
| teamMembershipRef | `membership-hr-001-team-001` |
| role | `onboarding_hr_operations` |
| senderIdConfigured | `true` |

授权 Scope 至少包括：

- `scope-mvp-synthetic-team-read`
- `scope-mvp-synthetic-team-write`

本文档不记录或泄露真实 senderId。访问继续受 Tenant / DataSpace / Team / Membership / Actor 约束。Candidate-name resolution 只能在可信授权范围内进行，不得跨 Tenant / Team 猜测 Case。

一个 HR 可以对应一个 Tenant / Principal，多个 HR 可以使用同一 Agent；但 Case、conversation 和 operational state 必须保持 Tenant / Team scoped。不同 HR 不得直接共享其他 HR 的私有 Case 或聊天上下文。

后续可共享的经验必须先经过去个案化、去敏、审核，并通过 Growth / Shared Practice 形成通用经验。不得将另一名 HR 的 Case Memory 直接作为共享记忆。跨 HR Shared Learning / Growth Memory 不在 Step 2 / Step 2.5 交付范围内。

### 7.2 Human Review 与 Formal READY

三个 Requirement 全部 completed 不等于自动 Formal READY。

`ELIGIBLE` 或 `READY_CANDIDATE` 都只是建议状态。Formal READY 必须由获得授权的 HR Reviewer 决定。

当前 Agent 不得自动：

- confirm READY；
- commit formal READY；
- send onboarding notice；
- execute external business write。

Ready Card 只能保持：`DRAFT / 待 HR 确认 / 未发送`。

### 7.3 Synthetic HR Manual Statement

Turn B/C/D 使用 HR 明确的 Synthetic Manual Statement 更新测试状态。Synthetic HR Manual Statement 可以作为 Synthetic Mutation Source，但不得冒充：

- HRIS validation
- ITSM validation
- document system validation
- third-party evidence validation

如果 `evidenceValidationRef = null`，必须保持 null / Unknown，不得生成虚假 Evidence Validation。

### 7.4 安全结论

- 业务路径保持最小 Tool Policy 和受控 Runtime Tool；
- 不允许 generic tool 绕过 Gateway 或直接访问业务数据；
- 不允许真实客户数据回退到 Synthetic 流程；
- Formal READY 和外部业务副作用继续由人类授权边界控制；
- Persistent Truth、Audit、Idempotency 与 optimistic concurrency 均是下一阶段不可回归约束。

## 8. Evidence Package

服务器侧证据包：

`/home/xb/.openclaw/hr-onboarding-baseline/step2-2_5-acceptance-20261008T091514`

Freeze timestamp identifier：`step2-2_5-acceptance-20261008T091514`

已提供的库存信息：共 13 files，约 76K，包含：

1. `runtime-baseline.txt`
2. `git-status.txt`
3. `deployed-skills.txt`
4. `deployed-skills-sha256.txt`
5. `runtime-config-redacted.json`
6. `plugin-inspect.txt`
7. `skills-check.txt`
8. `agent-bindings.txt`
9. `channel-status.txt`
10. `gateway-status.txt`
11. `sqlite-schema.json`
12. `mark-persistent-truth.json`
13. `SHA256SUMS.txt`

Codex 本次未直接读取该服务器目录或上述文件内容。本文档中的服务器状态只使用本次任务明确提供的 Frozen Facts，不伪造单文件 SHA256，也不把服务器证据包复制进 Git Repo。

校验状态：

`SHA256 manifest generated; final verification evidence pending / not supplied to Codex`

在获得明确的 `sha256sum -c SHA256SUMS.txt` 全部 OK 执行证据前，不得将 SHA256 verification 标记为 PASS。

## 9. Automated Regression Baseline

| 阶段 | Test Files | Tests | 结果 |
| --- | ---: | ---: | --- |
| Step 2 baseline | 17 | 256 | PASS |
| Step 2.5 pre-Hotfix | 18 | 296 | PASS |
| Mark Turn A Routing Hotfix | 19 | 311 | PASS |
| Mark Turn B/C/D Routing Hotfix | 19 | 321 | PASS |
| Mark Turn E Status Query Hotfix | 19 | 334 | PASS |
| Mark Turn F Delivery Routing Hotfix | 19 | 345 | PASS |

最终冻结自动化回归基线：

`19 test files / 345 tests PASS`

该结果记录的是最终代码基线的自动化回归，不替代本文件第 6 节的真实服务器 A-F 验收证据。

## 10. Known Limitations / Deferred Scope

Step 2 / Step 2.5 只证明 Synthetic MVP，不代表以下事项已经完成：

- Real Employee Data production ready
- Production HRIS integration
- Production ATS integration
- Production ITSM integration
- Real document ingestion
- Image / PDF understanding production integration
- Formal READY automatic commit
- outbound notification automation
- enterprise multi-HR rollout completed
- all onboarding Requirement types completed
- production database selected
- full operational observability completed
- production disaster recovery completed

当前 P0 Requirement 仍只有 `DOCUMENTS`、`IT_ACCOUNT`、`DEVICE`。不得把本次 MVP 验收描述为完整生产系统验收。

### Runtime Known Notes

以下 OpenClaw 运行环境事项曾被观察到；现有 Repo 与本次提供的服务器证据没有证明它们已经解决，因此继续记录为：`Known / Non-blocking for Step 2/2.5 Acceptance`。

- heartbeat owner warning；
- Gateway service persisted proxy environment warning；
- Gateway service PATH 缺少 pnpm path warning。

本 Closeout 不修改 Gateway service，也不顺手处理上述运行环境事项。

## 11. Invariants for Next Stage

Step 3 不得破坏以下不可回归条件：

1. Tenant / DataSpace isolation
2. Team-scoped Case Resolution
3. Trusted Principal
4. RequestContext v2
5. minimal Tool Policy
6. 6-Skill controlled surface
7. controlled Runtime Tool path
8. Persistent Business Truth
9. auditability
10. idempotency
11. optimistic concurrency
12. Human Review boundary
13. Formal READY human-owned
14. no generic tool bypass
15. no real-customer-data fallback
16. no conversation-as-business-truth
17. no cross-Tenant Case

除非后续阶段通过明确设计评审、风险评审和回归验收，否则不得放宽这些条件。Compatibility tool 的保留不构成扩大正式业务 Tool Surface 的依据。

## 12. Step 3 Entry Conditions

进入 Step 3 前必须满足：

1. 人工 Reviewer 确认本文档与服务器验收记录一致；
2. 人工确认是否将文档状态从 `SERVER_ACCEPTANCE_CLOSEOUT_CANDIDATE` 提升为 `FROZEN`；
3. 保持代码基线 `e762b9e2c3bac2fbe87a577c5eafe067a0a5e4a0`、Plugin `0.2.10`、6-Skill Surface、7-Tool Surface 与 `19 / 345` 回归证据可追溯；
4. 保留服务器 Evidence Package 路径与 inventory；若 SHA256 完整性要作为正式 Gate，须补充 `sha256sum -c SHA256SUMS.txt` 全部 OK 的明确执行证据；
5. Step 3 的范围、数据类型、连接器、权限、迁移、回滚与验收标准单独获批；
6. Step 3 变更必须证明不会破坏第 11 节的 17 项不可回归条件；
7. 在获得明确授权和实施计划前，不修改服务器 Runtime、SQLite、Feishu credential、Gateway service 或其他 Agent。

## 13. Final Closeout Checklist

| 检查项 | 状态 | 说明 |
| --- | --- | --- |
| 指定 Git baseline 已核对 | PASS | `main` 与 `origin/main` 均为 `e762b9e...` |
| Plugin / Tool Surface 已核对 | PASS | `0.2.10`，7 Tools |
| Skill Surface 已核对 | PASS | 6 个 HR Onboarding Skills |
| 最终自动化回归已记录 | PASS | `19 files / 345 tests PASS` |
| Mark Hero Flow A-F 已记录 | PASS | `END-TO-END PASS` |
| Persistent Truth 与 Version 4 已记录 | PASS | 使用提供的服务器冻结事实 |
| Tenant / Team / Principal 边界已记录 | PASS | 未记录真实 senderId |
| Human Review / Formal READY 边界已记录 | PASS | READY 继续由授权 HR 决定 |
| Synthetic Manual Statement 边界已记录 | PASS | 不冒充外部系统验证 |
| Deferred Scope 已记录 | PASS | 未把 Synthetic MVP 表述为生产完成 |
| Step 3 invariants 已记录 | PASS | 17 项不可回归条件 |
| Evidence Package inventory 已记录 | PASS | 只记录路径、标识、库存与提供的事实 |
| Codex 直接读取服务器 Evidence Package | NOT PERFORMED | 不声称已读取 |
| SHA256 final verification | PENDING | Manifest 已生成；最终验证证据未提供给 Codex |
| Gateway / Runtime / SQLite 修改 | NOT PERFORMED | Closeout 阶段未修改 |
| 功能、测试或 Routing 新增 | NOT PERFORMED | 本阶段只新增 Closeout 文档 |
| 最终人工 `FROZEN` 审批 | PENDING | 留给 Phase 3 人工验收 |

Closeout candidate 结论：Step 2 / Step 2.5 的 Synthetic MVP 工程与服务器 Hero Flow 已具备正式收口所需的记录；等待人工 Reviewer 完成证据确认与最终 `FROZEN` 决策后，方可进入获批的 Step 3 工作。
