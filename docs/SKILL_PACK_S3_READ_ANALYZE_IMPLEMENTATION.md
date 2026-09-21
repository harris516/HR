# Skill Pack S3 Read / Analyze Adapter Implementation

## Status

`S3_LOCAL_IMPLEMENTED / SYNTHETIC_TEST_HARNESS_ONLY / DEFAULT_RUNTIME_DISABLED / SERVER_NOT_VERIFIED`

S3 implements the 13 reviewed A0 Read and A1 Analyze adapters against a synthetic, tenant-scoped source store:

- Intake handoff read and completeness candidate evaluation;
- Case collection and case-status read;
- Requirement status and completion-candidate evaluation;
- Risk collection and source/evidence inspection;
- Responsibility workbox read;
- Readiness evaluation and revalidation;
- Artifact collection and redacted audit timeline read.

## Execution boundary

The adapters are registered only in `SyntheticReadAnalyzeImplementationRegistry`. The registry can be exposed to the Gateway only through the explicit `allowSyntheticTestRuntimeOverrides=true` path, and the executor additionally requires `allowSyntheticTestExecution=true`.

The reviewed S1 registry and default runtime remain unchanged:

```text
reviewed_capability_status = PLANNED_TEST_STUB
default_enabled_business_capabilities = 0
default_implementation_bindings = 0
openclaw_tool_bindings = 0
connector_bindings = 0
```

## Result controls

Every execution:

1. requires a matching `ALLOW_TO_IMPLEMENTATION` Gateway result;
2. revalidates Request Context and exact implementation binding;
3. parses the strict input schema again;
4. records implementation start before invocation;
5. validates adapter output against the reviewed output schema;
6. publishes no payload on FAILED or WAITING results;
7. records completion or failure without storing input/output bodies;
8. emits `externalSideEffect=false` and no execution receipt.

Readiness input contains only Case Ref, expected version and approved trigger references. The adapter builds the authoritative requirement/risk snapshot from the synthetic store; callers cannot choose rules or evidence. Requirement completion remains a candidate and returns `formalStatusChanged=false`. Readiness returns a new evaluation without changing formal readiness.

## Collection controls

Case, risk, responsibility, artifact and audit collections consume the S2 predicate/projection/cursor admission. Adapters recheck Tenant, DataSpace and Actor visibility per item before projection. The hero fixture contains both a same-tenant unauthorized Case and a cross-tenant Case; neither appears in output or counts.

## Validation

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm validate:config
corepack pnpm validate:capabilities
corepack pnpm smoke:gateway
corepack pnpm smoke:adapters
corepack pnpm smoke:navigation
```

Local results:

```text
test_files = 5 passed
tests = 125 passed
s3_tests = 19 passed
s3_hero_fixtures = 13 passed
synthetic_implementation_count = 13
test_harness_execution = SUCCESS
default_runtime_decision = DENY
default_runtime_reason = CAPABILITY_NOT_EXECUTABLE
external_side_effect = false
```

## Next slice

S4 may implement the five synthetic Draft adapters. It must preserve `DRAFT`, `NOT_SENT`, `formalStateChanged=false` and `externalSideEffect=false`, and must not register any OpenClaw Tool, Connector, channel or outbound-message capability.

