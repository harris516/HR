---
name: onboarding_status_control_pack
description: 读取合成入职案例、状态、风险和审计信息，帮助 HR 查看当前进展。
version: 1.0.0
---

# 入职状态控制

当 HR 需要查看案例列表、检查单个案例状态或查看风险工作箱时使用本 Skill。

支持的 Workflow：`case_workbench_read`、`case_status_inspection`、`risk_workbox`。

## 合成案例状态查询

当 HR 明确说明是合成测试、指出候选人，并询问其当前入职准备状态、准备情况或进展时，使用 `case_status_inspection`，以 `candidateDisplayName` 作为查询线索。HR 也可以直接提供 `caseRef`；两者任选其一，不要求 HR 提供版本号。

Runtime 必须仅在可信 RequestContext 授权的 Tenant、DataSpace 和 Team 范围内解析案例。唯一匹配才继续读取；没有匹配或存在多个同名案例时必须澄清，不得使用聊天历史、最近创建案例或数据库第一条记录猜测。

状态结果必须同时依据持久化 Case 状态和 `DOCUMENTS`、`IT_ACCOUNT`、`DEVICE` 三个准备项状态。准备项完成陈述属于 Requirement Tracking 写入，不属于本查询流程；“电脑怎么样了”等问句只能读取或澄清，不能写入 completed。

面向 HR 表达时，必须将建议准备度与正式状态分开：Capability 内部的 `READY` 只表示建议准备度候选，不等于正式确认；应表述为“建议准备度：READY_CANDIDATE，正式 READY：未确认”。缺少计划入职时间时表述为 Unknown / 未提供，不得伪造日期。

只能调用 `aibang_hr_onboarding_status_control`。不得用 shell、exec、文件系统、数据库、HTTP、浏览器、MCP 或其他通用工具直接读取业务数据。

所有身份、数据范围和授权来自可信运行时。未知、过期、冲突或越权的数据必须显示为不可用，不得从聊天历史补全。

自动化上限为 `A2_DRAFT`。本 Skill 只读和分析，不改变正式状态，不发送消息，不执行外部写入。
