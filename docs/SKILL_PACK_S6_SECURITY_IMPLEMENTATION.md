# S6 Security and Negative Test Implementation

## Result

S6 is implemented and server-validated. The reviewed NEG-001 through NEG-012 matrix is executable against the Gateway, synthetic adapters, executor and Skill orchestrator. The suite adds twenty-two S6 tests and keeps every default business Capability disabled.

## Covered controls

| Matrix item | Validated behavior |
|---|---|
| NEG-001 | All 18 planned capabilities remain default-denied; all 12 reserved Commit/Send/Export IDs remain unregistered. |
| NEG-002 | Cross-Tenant and Cross-DataSpace resource references hard-block before implementation. |
| NEG-003 | Same-Tenant out-of-scope and cross-Tenant collection records, counts and unknown fields are not disclosed. |
| NEG-004 | Actor, Grant, Purpose and Query cursor drift returns `COLLECTION_CURSOR_INVALID`. |
| NEG-005 | Caller-selected readiness Evidence or Rule fields fail strict input validation. |
| NEG-006 | Same idempotency key and payload is duplicate-suppressed; a different payload returns `IDEMPOTENCY_KEY_CONFLICT`. |
| NEG-007 | Missing/unhealthy implementation, missing physical tool and missing connector bindings fail closed without fallback. |
| NEG-008 | Gateway, execution and Skill audit boundaries fail closed. |
| NEG-009 | Unknown output fields return `CAPABILITY_OUTPUT_INVALID` and publish no payload. |
| NEG-010 | Prompt or tool-selection injection fails schema/Gateway checks and keeps `unsafeToolFallbackCount=0`. |
| NEG-011 | PHC-4 decision injection is rejected; a valid Review Request remains a facts-only unsent Draft. |
| NEG-012 | Stale source or missing source policy returns `WAITING/INDETERMINATE` and never publishes `ELIGIBLE`. |

Additional checks cover unknown Capability major versions, strict-schema drift and idempotency isolation by Tenant, DataSpace, Actor, Purpose, Grant, role/scope, resource and collection admission.

## Idempotency boundary

The synthetic executor now maintains a test-only result cache. Its key includes:

```text
Tenant + DataSpace + Actor + Purpose + Grant Version
+ Role / Scope / Authority digest
+ Capability ID / Version + Idempotency Profile
+ Resource digest + Collection Admission digest
+ Explicit deduplication key or Capability Request ID
```

An exact duplicate returns the already validated output with a new result/audit envelope and `implementationInvoked=false`. A reused key with a different payload fails before adapter invocation. This cache is not a production persistence design and creates no OpenClaw or external binding.

## Source safety boundary

Critical intake reads stop on unavailable or non-fresh source state. Readiness evaluation stops with `SOURCE_STALE` or `SOURCE_POLICY_MISSING` when the authoritative source boundary cannot be proven. It cannot convert stale, missing or caller-injected evidence into `ELIGIBLE`.

## Local validation

```text
typecheck: passed
test_files: 8 passed
tests: 172 passed
s6_security_tests: 22 passed
negative_matrix_controls: 12/12 passed
planned_capabilities: 18
default_enabled_capabilities: 0
reserved_side_effect_ids: 12
cross_tenant_result_count: 0
cross_data_space_result_count: 0
unauthorized_resource_result_count: 0
unauthorized_field_result_count: 0
unauthorized_count_disclosure: false
unsafe_tool_fallback_count: 0
formal_state_changed: false
outbound_message_sent: false
external_side_effect: false
```

## Current boundary and next stage

S1-S6 passed unified server validation at commit `b367a8d`, and the stage-12 Runtime Cross-check passed. No Capability status, feature flag or binding was enabled.

S6 completes the approved S1-S6 Capability engineering implementation. The project proceeds to stage 13. Runtime packaging is a separate downstream activity, not another Capability engineering slice; Tool, Connector and Channel bindings remain disabled and any later activation still requires the remaining 12–16 gates plus separate approval.
