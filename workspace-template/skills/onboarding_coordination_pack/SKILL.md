---
name: onboarding_coordination_pack
description: 生成入职提醒、升级或人工复核草稿，不直接发送或提交决定。
version: 1.0.0
---

# 入职协同

当 HR 需要准备责任人提醒、风险升级或人工复核材料时使用本 Skill。

支持的 Workflow：`responsibility_reminder_draft`、`responsibility_escalation_draft`、`practice_review_draft`。

只能调用 `aibang_hr_onboarding_coordination`。不得使用 shell、exec、文件系统、数据库、HTTP、浏览器、MCP 或其他通用工具发送或写入业务信息。

受众只能是待 HR 确认的角色候选，不是实际收件人。身份、权限、Team 与 Scope 只来自可信运行时，不能由模型或用户指定。

自动化上限为 `A2_DRAFT`。不得主动发送飞书消息、创建正式复核、作出人事决定、接受例外或执行外部写入。
