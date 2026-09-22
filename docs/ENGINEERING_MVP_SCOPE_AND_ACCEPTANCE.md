# hr-onboarding｜合成数据工程 MVP 场景与验收清单

状态：范围已由项目 Owner 确认；尚未实现或验收。确认日期：2026-09-22。

本文件只收紧当前工程迭代范围，不修改 `05_HIGH_VALUE_MVP_SCOPE.md` 的完整 Pilot MVP 定义。Owner 后续确认：允许已绑定的 `hr-bot-01` 与其本人受控测试账号进行 synthetic 数据测试；这不授予正式业务操作、真实数据或真实 Connector 权限。

## 1. 本轮目标

以一个合成租户中的一条 **Offer Accepted** 记录为起点，形成唯一 `OnboardingCase`，跟踪三类 Requirement，计算可解释的 Day-1 Ready **建议**，生成供入职 HR 人工复核的《Day-1 Ready 入职交付卡》草稿。

```text
合成 Offer Accepted
  → 唯一 Case
  → 资料 / IT 账号 / 设备三类 Requirement 与责任任务
  → 状态、证据、时效和异常检查
  → Ready 建议与原因
  → Ready 卡草稿
  → HR 人工复核交接
```

流程终点是“草稿可供 HR 复核”，**不是**正式 `READY`、正式 Confirmation 或对外发送。无论建议是否为 `ELIGIBLE`，Formal Readiness 均不得被本轮流程改变。

## 2. 数据与对象边界

- 仅使用明确标记为 synthetic 的测试数据；一个主测试租户和 DataSpace。越权测试可使用不匹配的租户／DataSpace 或 Actor，但不得读取其对象详情。
- 主路径仅需一条已接受 Offer；同一 Offer 重放时不得产生第二条 Case。Case 应有稳定引用和版本，后续步骤读取同一 Case 的最新受控状态。
- 三类 Requirement：资料、IT 账号、设备。每项至少具备适用性、状态、责任人、截止时间、完成条件、证据引用、来源／规则版本和数据时效。三类仅为**合成演示配置**，不是客户已确认的 Day-1 Critical 清单。
- 可以用受控合成输入代替 ATS、HRIS、ITSM 或飞书连接器。不得把静态样例中的“已完成”“证据有效”当作未经校验的通用事实。
- 卡片至少能展示 Case／Evaluation 版本、三项 Requirement 摘要、阻塞或未知原因、来源与证据引用、责任人下一步、建议状态，以及明确分开的 Formal／Confirmation 状态。输出固定为 `DRAFT / NOT_SENT`。

## 3. 必须通过的业务场景

| 场景 | 输入变化 | 可验收结果 |
|---|---|---|
| M1 正常路径 | 三项 Requirement 均有满足规则的当前状态和证据，且无阻塞或待审事项 | 生成 `ELIGIBLE` 的**建议**及 Ready 卡草稿；Formal／Confirmation 仍未设置；同一 Offer 重放不重复建 Case |
| M2 缺失路径 | 至少一项必需资料或完成证据缺失 | 不建议 Ready；卡片准确列出缺失项、原因、责任人与下一步，不伪造完成状态 |
| M3 时效／冲突路径 | 来源过期、时效未知或关键事实冲突 | 不把未知或冲突推断为 Ready；明确显示待复核／不可判定原因、受影响项及人工处理入口 |
| M4 越权路径 | Actor、Tenant、DataSpace 或 Scope 与目标 Case 不匹配 | 请求被拒绝；不返回目标 Case 的存在性、字段、计数或草稿；不发生后续业务调用 |

所有场景均须留下可关联的请求、决策和结果审计；审计不可用时停止后续业务步骤。失败或拒绝不产生正式状态变更、外部写入或消息发送。

## 4. 本轮不做

- 真实客户数据、客户规则确认和真实 Pilot；
- 正式 `READY` 提交、Confirmation、自动 Review 决策或豁免；
- 主动飞书提醒、向其他账号或真实员工发送消息、外部系统写入与真实 Connector；受控测试账号在 `hr-bot-01` 中发起的问答回复属于本轮测试入口；
- 六类 Pilot Requirement 的完整覆盖、多地区／多主体配置；
- 正式 E0/E1 Eval Run、Holdout／Oracle 审批和发布验收。现有评测草案保留，但不是本轮开发的前置门槛。

## 5. 工程完成判据

1. 一条受控入口能够连续处理 M1：输入合成 Offer，定位同一 Case，读取三项 Requirement，计算建议，生成可复核卡片草稿；不能仅由互不相连的单项 Smoke Test 代替。
2. M2—M4 的结果、原因和禁止副作用可由自动化端到端测试重复验证；同一 Offer／请求重放不重复创建业务对象。
3. 输出与审计能够追溯到 Case、输入快照、规则／来源版本；`Suggested`、`Formal`、`Confirmation` 明确分离。
4. 默认业务运行时仍关闭真实数据、主动外发和正式写入。OpenClaw 已开放 `hr-bot-01` 到本 Agent 的受控测试路由；合成读／分析／草稿工具必须独立按发送者白名单、测试存储与 Agent 工具策略开启，不得由路由开放推导为工具授权。

## 6. 下一步实施边界

当前已采用仓库外 SQLite 文件保存合成 Case，准备通过独立 OpenClaw 测试工具接入 Ready 卡草稿。人工复核仍在对话中完成，不产生正式状态。现有完整导航、Capability／Skill 链尚未接入此最小工具；不得把本轮验证视为完整架构验收。

依据：`05_HIGH_VALUE_MVP_SCOPE.md` 的 Hero Closure 与受限 Pilot 范围、`15_OUTPUT_SPECS_AND_TEMPLATES.md` 的 Ready 卡草稿边界，以及当前仓库中默认关闭的合成 Capability 实现。
