# Task Navigation v0.3 Implementation

## 状态

```text
design_source: 11_TASK_NAVIGATION_AND_WORKFLOW.md v0.3 reviewed
n1_contracts: implemented
n2_context_tenant_gate: implemented
n3_intent_router: implemented
n4_subject_resolution_stub: implemented
n5_deterministic_route_engine: implemented
n6_lifecycle_audit: implemented
n7_test_harness: verified
n7_openclaw_tool_binding: intentionally_pending_12
real_customer_data: disabled
external_side_effects: disabled
```

## Slice映射

| Slice | 实现 |
|---|---|
| N1 | `src/contracts/navigation.ts`：封闭Intent、Action、Subject、Status、Route与Envelope类型 |
| N2 | `src/navigation/context-gate.ts`：合成Context、Expiry、Session、Tenant/DataSpace与Integrity Gate |
| N3 | `src/navigation/intent-router.ts`：P0、受控、禁止、Out-of-scope与Unknown规则路由 |
| N4 | `src/navigation/subject-resolution.ts`：Tenant/DataSpace范围内的零、一、多、拒绝和跨边界结果 |
| N5 | `authorization.ts`、`route-engine.ts`与`navigation-engine.ts`：显式Grant、Default Deny、复合请求和Mock Capability |
| N6 | `lifecycle.ts`与`audit/navigation-audit.ts`：封闭状态转换和所有出口Audit |
| N7 | `smoke-navigation.ts`：配置加载和完整合成READ链路；OpenClaw Tool Binding等待12 |

## 已验证命令

```bash
pnpm typecheck
pnpm test
pnpm validate:config
pnpm smoke:navigation
```

本地验收结果：2个Test File、24项测试通过；Smoke Test产生`READ / all_completed`，Capability调用1次，外部副作用为`false`。

## 安全边界

- 只接受`synthetic: true`且Environment为design/test的Request Context；
- Context无效时不把用户声明的Tenant/DataSpace记录为可信边界；
- 强标识符只命中其他DataSpace时Hard Block；姓名等弱线索不会搜索或暴露其他Tenant候选；
- 正式READY、Requirement Commit、外部发送、敏感导出和雇佣决定不可执行；
- Audit不可用时Capability调用计数保持0；
- Mock结果始终标记`formalStateChanged: false`和`externalSideEffect: false`；
- 当前没有Channel、Connector或OpenClaw Tool Binding。

## 下一Gate

1. 将本版本同步到云服务器仓库；
2. 在服务器执行四项验证命令；
3. 执行10—11 Runtime Cross-check；
4. 进入12 Skill Pack，冻结正式Capability ID、Version、Input/Output Schema和Tool Binding规则；
5. 12批准前不把导航模块暴露给Agent作为可调用Tool。
