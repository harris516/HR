import type { CapabilityGatewayRequest } from "../../contracts/capability-gateway.js";
import type { CapabilityEntry, ResultStatus } from "../../contracts/capability.js";
import type { RequestContext } from "../../contracts/navigation.js";
import type { SyntheticCapabilityStore } from "./synthetic-store.js";

export type AdapterReasonCode =
  | "SOURCE_UNAVAILABLE"
  | "SOURCE_POLICY_MISSING"
  | "SOURCE_STALE"
  | "OBJECT_VERSION_CONFLICT"
  | "IDEMPOTENCY_KEY_CONFLICT"
  | "CAPABILITY_INPUT_INVALID";

export interface SyntheticAdapterContext {
  request: CapabilityGatewayRequest;
  requestContext: RequestContext;
  capability: CapabilityEntry;
  input: Record<string, unknown>;
  store: SyntheticCapabilityStore;
  now: Date;
  idFactory: () => string;
}

export interface SyntheticAdapterResult {
  resultStatus: Extract<ResultStatus, "SUCCESS" | "INDETERMINATE" | "WAITING" | "FAILED">;
  outputPayload: unknown;
  reasonCodes: AdapterReasonCode[];
  sourceReferences: string[];
  freshnessResults: Array<"fresh" | "stale" | "unavailable" | "unknown" | "not_applicable">;
  policyVersionRefs: string[];
  objectVersionRefs: string[];
  inputSnapshotRef?: string;
}

export type SyntheticCapabilityAdapter = (
  context: SyntheticAdapterContext
) => SyntheticAdapterResult;

export class SyntheticAdapterError extends Error {
  constructor(
    readonly resultStatus: Extract<ResultStatus, "INDETERMINATE" | "WAITING" | "FAILED">,
    readonly reasonCode: AdapterReasonCode
  ) {
    super(reasonCode);
    this.name = "SyntheticAdapterError";
  }
}
