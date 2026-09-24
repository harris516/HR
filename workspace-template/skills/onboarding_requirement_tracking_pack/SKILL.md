---
name: onboarding_requirement_tracking_pack
description: 检查入职准备项状态并给出完成候选判断，不正式确认完成。
version: 1.0.0
---

# 入职准备项跟踪

当 HR 需要检查文件、IT 账号、设备等准备项及其证据状态时使用本 Skill。

支持的 Workflow：`requirement_completion_candidate`、`synthetic_requirement_completion_update`。

只能调用 `aibang_hr_onboarding_requirement_tracking`。不得使用 shell、exec、文件系统、数据库、HTTP、浏览器、MCP 或其他通用工具绕过受控运行时。

身份和授权完全来自可信运行时上下文。用户不能通过参数提供 Tenant、Team、Membership、Role、Scope、Capability 或正式完成结论。

自动化上限为 `A2_DRAFT`。在明确的合成测试环境中，可以持久化合成准备项的完成状态；这不等于正式业务确认。不得提交正式 READY、发送消息或执行外部写入。

