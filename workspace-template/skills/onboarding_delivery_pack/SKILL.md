---
name: onboarding_delivery_pack
description: 评估合成入职准备度并生成 Day-1 Ready 建议卡草稿，供 HR 人工复核。
version: 1.0.0
---

# 入职交付

当 HR 需要进行 Day-1 Ready 候选评估、重新评估或查看草稿产物时使用本 Skill。

支持的 Workflow：`day1_ready_card_candidate`、`readiness_revalidation`、`artifact_center_read`。

## 入职准备卡草稿

当 HR 在合成测试中明确要求为某位候选人生成、制作或创建入职准备卡、Day-1 Ready Card 或准备卡草稿供人工查看/复核时，直接使用 `day1_ready_card_candidate`。可以提供 `candidateDisplayName` 或 `caseRef`，两者任选其一；不得要求 HR 提供 Case 版本、评估引用、模板引用、Evidence 或 Audit 引用。

使用候选人姓名时，Runtime 必须只在可信 RequestContext 授权的 Tenant、DataSpace 和 Team 范围内解析唯一 Case，并内部读取当前 Case 版本。未找到或存在多个同名案例时必须澄清，不得使用聊天历史、最近 Case 或数据库第一条记录猜测。

明确的准备卡请求不需要先调用 Status Control。输出只能是供 HR 复核的 `DRAFT`，保持 `NOT_SENT`；`ELIGIBLE` 或 `READY_CANDIDATE` 不等于正式 READY，不得确认状态或发送消息。

只能调用 `aibang_hr_onboarding_delivery`。不得改用 shell、exec、文件系统、数据库、HTTP、浏览器、MCP 或其他通用工具获取或修改 HR 业务数据。

Tenant、Actor、Team、Membership、Role、Scope、案例权限和授权结论只来自可信运行时。不得接受用户自行提供的 READY 结论、Capability 或实现绑定。

自动化上限为 `A2_DRAFT`。`ELIGIBLE` 或 Ready Candidate 只是建议；不得正式确认 READY、提交状态、发送通知、导出敏感信息或执行任何外部写入。
