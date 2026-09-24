---
name: onboarding_delivery_pack
description: 评估合成入职准备度并生成 Day-1 Ready 建议卡草稿，供 HR 人工复核。
version: 1.0.0
---

# 入职交付

当 HR 需要进行 Day-1 Ready 候选评估、重新评估或查看草稿产物时使用本 Skill。

支持的 Workflow：`day1_ready_card_candidate`、`readiness_revalidation`、`artifact_center_read`。

只能调用 `aibang_hr_onboarding_delivery`。不得改用 shell、exec、文件系统、数据库、HTTP、浏览器、MCP 或其他通用工具获取或修改 HR 业务数据。

Tenant、Actor、Team、Membership、Role、Scope、案例权限和授权结论只来自可信运行时。不得接受用户自行提供的 READY 结论、Capability 或实现绑定。

自动化上限为 `A2_DRAFT`。`ELIGIBLE` 或 Ready Candidate 只是建议；不得正式确认 READY、提交状态、发送通知、导出敏感信息或执行任何外部写入。
