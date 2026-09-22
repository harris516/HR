# EVS1 Eval Foundation — local implementation

Status: implemented and locally verified on 2026-09-22. This is **not** E0 execution or acceptance authorization.

## Included

- Strict V1 structural schemas for the eight objects in `19_TEST_EVAL_ACCEPTANCE_PLAN.md` §§13, 14, 16 and 19. Unknown fields, schema versions and enum values are rejected.
- Closed 21-code Eval Reason Registry from §23.
- Immutable, empty suite/case/dataset/profile/run/result/aggregate/decision registry. There is no registration API.
- A pure `denyEvalRequest` entry point. Every input returns `DENIED` with a low-sensitivity reason and local audit description. It creates no Eval Run and cannot call any business Capability, connector, channel, model or sender.
- Synthetic-only request boundary. Real-data requests are rejected.

## Intentionally not included

- No actual Eval Dataset, Eval Run, Acceptance Aggregate or Decision records.
- No reference resolution, content-digest recomputation, static manifest/config validator or E0 run. Those belong to EVS2 or later; structurally valid objects are **not** approved or executable.
- No evaluator, oracle, side-effect runner, OpenClaw tool binding, server deployment or routing change.
- The returned audit object is a local denial description, not proof of persisted audit infrastructure. Any future executable gateway must require durable audit and fail closed if unavailable.

## Verification

Run `corepack pnpm typecheck` and `corepack pnpm test` in the runtime repository. `tests/eval-foundation.test.ts` covers the strict structural boundary, closed reasons, empty registry and all-deny behavior. Existing runtime tests remain part of the regression run.
