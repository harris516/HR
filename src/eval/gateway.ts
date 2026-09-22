import { evalRequestV1Schema, type EvalReasonCode } from "../contracts/eval.js";
import { emptyEvalRegistry } from "./registry.js";

export type EvalDenial = Readonly<{
  status: "DENIED";
  reasonCode: EvalReasonCode;
  audit: Readonly<{ eventType: "EVAL_REQUEST_DENIED"; requestId: string | null; reasonCode: EvalReasonCode }>;
  evalRunCreated: false;
  capabilityCalled: false;
  externalSideEffect: false;
}>;

function deny(reasonCode: EvalReasonCode, requestId: string | null): EvalDenial {
  return Object.freeze({
    status: "DENIED", reasonCode,
    audit: Object.freeze({ eventType: "EVAL_REQUEST_DENIED", requestId, reasonCode }),
    evalRunCreated: false, capabilityCalled: false, externalSideEffect: false
  });
}

/** Pure, closed EVS1 boundary. It cannot invoke an evaluator, capability, connector or sender. */
export function denyEvalRequest(input: unknown): EvalDenial {
  const parsed = evalRequestV1Schema.safeParse(input);
  if (!parsed.success) {
    const version = input !== null && typeof input === "object" && "schemaVersion" in input
      ? input.schemaVersion : undefined;
    return deny(
      version !== "eval-request.v1" ? "EVAL_SCHEMA_VERSION_UNSUPPORTED" :
        input !== null && typeof input === "object" && "synthetic" in input && input.synthetic !== true
          ? "EVAL_REAL_DATA_NOT_ALLOWED" : "EVAL_REFERENCE_MISSING",
      null
    );
  }
  const request = parsed.data;
  if (!emptyEvalRegistry.suites.some((suite) => suite.suiteId === request.suiteId)) {
    return deny("EVAL_REFERENCE_MISSING", request.requestId);
  }
  return deny("EVAL_DATASET_NOT_APPROVED", request.requestId);
}
