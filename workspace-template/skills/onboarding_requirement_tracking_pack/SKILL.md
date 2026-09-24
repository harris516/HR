---
name: onboarding_requirement_tracking_pack
description: 检查入职准备项状态并给出完成候选判断，不正式确认完成。
version: 1.0.0
---

# 入职准备项跟踪

当 HR 需要检查文件、IT 账号、设备等准备项及其证据状态时使用本 Skill。

支持的 Workflow：`requirement_completion_candidate`。

只能调用 `aibang_hr_onboarding_requirement_tracking`。不得使用 shell、exec、文件系统、数据库、HTTP、浏览器、MCP 或其他通用工具绕过受控运行时。

身份和授权完全来自可信运行时上下文。用户不能通过参数提供 Tenant、Team、Membership、Role、Scope、Capability 或正式完成结论。

自动化上限为 `A2_DRAFT`。只能给出完成候选或缺失项分析；不得正式标记准备项完成，不得提交 READY，不得发送消息或执行外部写入。
