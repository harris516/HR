---
name: onboarding_status_control_pack
description: 读取合成入职案例、状态、风险和审计信息，帮助 HR 查看当前进展。
version: 1.0.0
---

# 入职状态控制

当 HR 需要查看案例列表、检查单个案例状态或查看风险工作箱时使用本 Skill。

支持的 Workflow：`case_workbench_read`、`case_status_inspection`、`risk_workbox`。

只能调用 `aibang_hr_onboarding_status_control`。不得用 shell、exec、文件系统、数据库、HTTP、浏览器、MCP 或其他通用工具直接读取业务数据。

所有身份、数据范围和授权来自可信运行时。未知、过期、冲突或越权的数据必须显示为不可用，不得从聊天历史补全。

自动化上限为 `A2_DRAFT`。本 Skill 只读和分析，不改变正式状态，不发送消息，不执行外部写入。
