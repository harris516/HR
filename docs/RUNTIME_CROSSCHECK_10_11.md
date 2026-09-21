# 10—11 Runtime Cross-check

## 结论

```text
crosscheck_scope: 10_IDENTITY_RUNTIME_PACK v0.3 + 11_TASK_NAVIGATION v0.3
local_crosscheck_result: PASSED
local_typecheck: PASSED
local_tests: 35/35 PASSED
local_config_validation: PASSED
local_navigation_smoke: PASSED
server_revalidation: PENDING
openclaw_tool_binding: INTENTIONALLY_PENDING_12
agent_engineering_ready: NOT_YET
```

## 对照结果

| 检查项 | 结果 | 实现证据 |
|---|---|---|
| Agent ID / Display Name / Domain / A2 | PASS | Runtime Config固定字面值并保留A2上限 |
| Request Context字段 | PASS | 必填字段、`clientContext`、`riskSignals`、Expiry、Session和Integrity均Schema化 |
| Test-only环境 | PASS | 只接受design/test、`synthetic: true`、`test_harness`和test认证 |
| Tenant + DataSpace | PASS | Context、Task、Grant、Subject、Audit和Capability输入一致校验 |
| Subject Resolution结果 | PASS | resolved、not_found、multiple、identity_conflict、access_denied、mapping_unknown、stale_mapping、context_mismatch |
| selectedCaseRef | PASS | Actor、Tenant、DataSpace、Purpose、Session、TTL和Case Version重新校验 |
| Authorization结果 | PASS | allow、deny、step_up、review、context_refresh、indeterminate全部可达且Fail Closed |
| Capability边界 | PASS | 仅read/analyze/draft Stub；ID和Version显式传递；未注册即拒绝 |
| Navigation生命周期 | PASS | 封闭转换；失败Attempt不可原地复活 |
| 全出口Audit | PASS | Ingress、Context、Subject、Authorization、Transition、Route和Final均记录；Audit不可用时调用数为0 |
| Session / Memory | PASS | 只消费受控引用，不保存正式业务真值或永久Authority |
| 复合请求 | PASS | Child Task独立授权；正式READY拒绝不污染安全READ |
| Channel / Connector | PASS | Runtime配置保持空绑定；非`test_harness`入口拒绝 |
| External Side Effect | PASS | Smoke与Draft结果均为false；无发送、Commit、Export或Connector |
| OpenClaw Tool Binding | DEFERRED SAFE | 等待12批准正式Capability Contract，不作为当前失败项 |

## Cross-check中修复的问题

1. 补齐Request Context的`clientContext`和`riskSignals`；
2. 补齐Subject Resolution的Conflict/Mapping状态；
3. 实现`selectedCaseRef`的全边界与版本复核；
4. 让`context_refresh_required`与显式`indeterminate`成为可执行授权结果；
5. Authorization Precheck显式接收Capability Version、Resource、Sensitivity、Expected Version和Risk；
6. 空Channel Binding下只允许合成`test_harness`；
7. 增加弱姓名线索的跨租户不干扰测试和强标识跨DataSpace Hard Block测试。

## Server Closure条件

服务器拉取本次Cross-check修复提交后必须再次通过：

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm validate:config
corepack pnpm smoke:navigation
```

通过后可标记`runtime_crosscheck_10_11_passed`并进入12；这仍不代表整体Agent Engineering Ready或允许真实数据、飞书、Connector、正式Commit与外部副作用。
