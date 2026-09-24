---
name: onboarding_requirement_tracking_pack
description: 检查入职准备项状态，并在明确的合成测试中记录 HR 对文件、IT 账号或设备已完成的手工声明，不作正式业务确认。
version: 1.0.0
---

# 入职准备项跟踪

当 HR 需要检查文件、IT 账号、设备等准备项及其证据状态时使用本 Skill。

支持的 Workflow：`requirement_completion_candidate`、`synthetic_requirement_completion_update`。

只能调用 `aibang_hr_onboarding_requirement_tracking`。不得使用 shell、exec、文件系统、数据库、HTTP、浏览器、MCP 或其他通用工具绕过受控运行时。

身份和授权完全来自可信运行时上下文。用户不能通过参数提供 Tenant、Team、Membership、Role、Scope、Capability 或正式完成结论。

自动化上限为 `A2_DRAFT`。在明确的合成测试环境中，可以持久化合成准备项的完成状态；这不等于正式业务确认。不得提交正式 READY、发送消息或执行外部写入。

## Synthetic Requirement Update Routing

当请求明确为合成测试、候选人可识别，并且 HR 明确陈述以下一个准备项已经完成时，使用 `synthetic_requirement_completion_update`：

- 入职文件已收齐 → `DOCUMENTS`；
- IT 账号已开好 → `IT_ACCOUNT`；
- 电脑或办公设备已准备好 → `DEVICE`。

允许以 `candidateDisplayName` 作为 Case clue，不要求 HR 必须提供 `caseRef`。Runtime 必须在可信 RequestContext 授权的 Team / DataSpace 范围内解析唯一 Case，并在内部读取当前 Case 与 Requirement 版本。不得要求或接受模型提供版本号、`requirementRef`、Evidence 引用或系统验证引用。

HR 的明确完成陈述只能记录为 `SYNTHETIC_HR_MANUAL_STATEMENT`，Actor 来自可信 Runtime，`evidenceValidationRef` 保持 `null`；不得伪装成 HRIS、ITSM 或外部系统验证。这一合成 `completed` 不等于正式 READY 或正式业务提交。

找不到候选人、同 Team 同名 Case 不唯一、准备项类型不明确、完成状态不明确，或包含“可能”“看起来”“差不多”等不确定语义时，必须澄清，不得猜测或写入。
