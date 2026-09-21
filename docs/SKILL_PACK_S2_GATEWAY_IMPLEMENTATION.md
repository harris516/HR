# Skill Pack S2 Capability Gateway Implementation

## Status

`S2_SERVER_VERIFIED / DEFAULT_ALL_DENIED / RUNTIME_NOT_ENABLED`

S2 adds a deterministic Capability Gateway in front of any future capability implementation. It resolves a structured, versioned capability reference and evaluates the following gates in a fixed order:

1. Audit availability and ingress recording;
2. Gateway request and trusted Request Context validity;
3. Registry membership and exact contract version;
4. Runtime status, feature flag and environment;
5. Tenant, DataSpace, purpose and action boundaries;
6. authorization decision binding and result;
7. PHC, prohibition class and human-review requirement;
8. strict input schema and canonical payload digest;
9. collection predicate, field projection and cursor binding;
10. implementation, physical-tool and connector binding availability.

Every rejection returns a canonical reason code, records an audit event when audit is available, and keeps `implementationInvoked=false` and `externalSideEffect=false`.

## Default runtime boundary

The default resolver derives state exclusively from the reviewed S1 registry. Therefore all 18 capabilities remain:

```text
status = PLANNED_TEST_STUB
featureFlag.enabled = false
implementationBinding = null
```

The gateway rejects them with `CAPABILITY_NOT_EXECUTABLE`. The 12 reserved identifiers and unknown identifiers are rejected with `CAPABILITY_NOT_REGISTERED`. No generic-tool fallback exists.

## Test-only deep-path validation

The gateway accepts a runtime-state resolver only when the caller explicitly sets `allowSyntheticTestRuntimeOverrides=true`. This hook exists solely to reach and verify downstream rejection branches without changing the S1 registry or runtime configuration. The gateway itself never invokes an implementation; even a fully valid synthetic admission returns `implementationInvoked=false`.

## Collection boundary

Collection capabilities require an explicit predicate and field projection. When a page token is supplied, the cursor must remain bound to the same Tenant, DataSpace, actor, purpose, capability ID and version, grant version, query digest, expiry and integrity state. Any drift produces `COLLECTION_CURSOR_INVALID`.

## Validation

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm validate:config
corepack pnpm validate:capabilities
corepack pnpm smoke:gateway
corepack pnpm smoke:navigation
```

`smoke:gateway` must demonstrate that a valid synthetic request still stops at `CAPABILITY_NOT_EXECUTABLE` under the default runtime baseline, with no implementation call and no external side effect.

## Remaining boundary

S2 does not implement S3 Read/Analyze adapters, S4 Draft adapters, S5 Skill orchestration, S6 security completion, OpenClaw Tool registration, a Connector, real customer data access, formal state mutation or outbound messaging. Those remain separate approval and verification slices.
