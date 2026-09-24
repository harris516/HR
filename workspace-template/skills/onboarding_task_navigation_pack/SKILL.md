---
name: onboarding_task_navigation_pack
description: 识别入职请求并生成受控的下一步导航建议，包括合成案例创建、已有 Handoff 审查与合成准备项完成更新，不执行正式业务动作。
version: 1.0.0
---

# 入职任务导航

当 HR 需要识别请求类型、澄清缺失信息或确定下一步流程时使用本 Skill。

支持的 Workflow：`navigation_route_handoff`。

只能调用 `aibang_hr_onboarding_task_navigation`。不得改用 shell、exec、文件系统、数据库、HTTP、浏览器、MCP 或其他通用工具执行 HR 业务。

Tenant、DataSpace、Actor、Team、Membership、Role、Scope 和授权结论只能来自可信运行时上下文，不能从用户文字推断或覆盖。

自动化上限为 `A2_DRAFT`。正式 READY、正式提交、发送消息、导出及任何外部写入均不可用。信息不足、身份不明或审计不可用时停止并向 HR 说明需要补充或人工处理。

## 入职案例路由契约

当请求同时明确满足以下四项时，导航到 `onboarding_case_intake_pack` 的 `synthetic_case_create_from_accepted_offer`：

1. 当前是 Synthetic / 合成测试；
2. 候选人可识别；
3. Offer 已明确接受；
4. HR 明确要求创建或建立入职案例。

这一路由只需要候选人显示名和 `offerAccepted=true`。`plannedStartAt` 可选；未提供或明确未定时保持 Unknown / `null`，不得伪造日期，也不得因此阻止创建。该路由不需要 `handoffRef` 或 `expectedSourceVersion`。

只有请求明确要读取或检查已有 Handoff / 交接、检查 Intake 完整性，或基于已有 Handoff 生成 Intake Draft 时，才导航到 `case_intake_candidate`。缺少已有 Handoff 引用时可以要求补充引用，但不得把“Offer 已接受并创建 Case”误判为 Handoff 审查。

若 Synthetic、候选人、Offer 已接受、明确创建四项中任何一项不明确，例如“Mark 的 Offer 处理一下”，必须澄清，不得推断接受状态或创建意图。

## 准备项完成路由契约

当请求同时明确满足以下四项时，导航到 `onboarding_requirement_tracking_pack` 的 `synthetic_requirement_completion_update`：

1. 当前是 Synthetic / 合成测试；
2. 候选人可识别；
3. 准备项明确为 `DOCUMENTS`、`IT_ACCOUNT` 或 `DEVICE`；
4. HR 明确陈述该准备项已经完成。

业务输入只需要 `candidateDisplayName` 和 `requirementKind`。不要求 HR 提供 `caseRef`、版本号、`requirementRef` 或 Evidence 引用；Runtime 继续在授权 Team / DataSpace 内解析唯一 Case 和当前版本。

“文件怎么样了”“电脑可能准备好了”“IT 账号处理一下”“看起来差不多了”等查询、可能性或模糊表达不得路由为 Mutation。候选人、准备项类型或完成状态不明确时必须澄清，不得使用上一次会话、最近 Case 或数据库第一条记录补全。
