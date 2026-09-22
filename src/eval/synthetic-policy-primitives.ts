/** EVS3-only deterministic policy primitives. These do not authorize production actions. */

export type PrimitiveGate<T> =
  | { status: "BLOCKED"; reason: string }
  | { status: "PASS"; result: T };

export function assessSyntheticFreshness(input: {
  observedAt: string | null;
  sourceVersion: string | null;
  sourceAvailable: boolean;
  maxAgeMs: number | null;
  now: string;
}): PrimitiveGate<"FRESH" | "STALE"> {
  if (input.maxAgeMs === null || !Number.isFinite(input.maxAgeMs) || input.maxAgeMs < 0)
    return { status: "BLOCKED", reason: "FRESHNESS_POLICY_UNCONFIGURED" };
  if (!input.sourceAvailable || !input.observedAt || !input.sourceVersion)
    return { status: "BLOCKED", reason: "SOURCE_FRESHNESS_UNKNOWN" };
  const observed = Date.parse(input.observedAt);
  const now = Date.parse(input.now);
  if (!Number.isFinite(observed) || !Number.isFinite(now) || observed > now)
    return { status: "BLOCKED", reason: "SOURCE_FRESHNESS_UNKNOWN" };
  return { status: "PASS", result: now - observed <= input.maxAgeMs ? "FRESH" : "STALE" };
}

export function assessSyntheticEvidence(input: {
  propositionBound: boolean;
  sourcePolicyActive: boolean;
  provenanceComplete: boolean;
  fresh: boolean;
  qualityValid: boolean;
  identityResolved: boolean;
  blockingConflict: boolean;
  validatorAuthorized: boolean;
  purposePermitted: boolean;
  versionAndAuditReady: boolean;
}): PrimitiveGate<"EVIDENCE_CANDIDATE_VALID"> {
  if (input.blockingConflict === true) return { status: "BLOCKED", reason: "EVIDENCE_CONFLICT" };
  const required = ["propositionBound", "sourcePolicyActive", "provenanceComplete", "fresh",
    "qualityValid", "identityResolved", "validatorAuthorized", "purposePermitted",
    "versionAndAuditReady"] as const;
  if (input.blockingConflict !== false || required.some((key) => input[key] !== true))
    return { status: "BLOCKED", reason: "EVIDENCE_PRECONDITION_MISSING" };
  return { status: "PASS", result: "EVIDENCE_CANDIDATE_VALID" };
}

export function assessSyntheticReadyCandidate(input: {
  ruleVersion: string | null;
  sourceFreshness: "FRESH" | "STALE" | "UNKNOWN";
  evidenceValid: boolean;
  identityResolved: boolean;
  openConflict: boolean;
  blockingRequirements: number;
  blockingRisks: number;
}): PrimitiveGate<"ELIGIBLE_CANDIDATE" | "NOT_ELIGIBLE"> {
  if (!input.ruleVersion || input.sourceFreshness !== "FRESH" || !input.evidenceValid ||
      !input.identityResolved || input.openConflict ||
      !Number.isInteger(input.blockingRequirements) || input.blockingRequirements < 0 ||
      !Number.isInteger(input.blockingRisks) || input.blockingRisks < 0)
    return { status: "BLOCKED", reason: "READY_INPUT_INDETERMINATE" };
  return { status: "PASS", result: input.blockingRequirements || input.blockingRisks
    ? "NOT_ELIGIBLE" : "ELIGIBLE_CANDIDATE" };
}

const revalidationTriggers = new Set([
  "OBSERVATION_VERSION_CHANGED", "SOURCE_CORRECTED", "EVIDENCE_INVALIDATED",
  "SOURCE_FRESHNESS_CHANGED", "CONFLICT_REOPENED", "IDENTITY_CHANGED",
  "POLICY_VERSION_CHANGED", "MANUAL_EVIDENCE_REPLACED", "CRITICAL_FIELD_CHANGED",
  "CONNECTOR_INCONSISTENCY", "AUTHORITY_REVOKED"
]);
export function assessSyntheticRevalidation(trigger: string): PrimitiveGate<"RECALCULATE_REQUIRED"> {
  return revalidationTriggers.has(trigger)
    ? { status: "PASS", result: "RECALCULATE_REQUIRED" }
    : { status: "BLOCKED", reason: "REVALIDATION_TRIGGER_UNKNOWN" };
}

export type SyntheticPhc = "PHC_0" | "PHC_1" | "PHC_2" | "PHC_3" | "PHC_4";
const phcOrder: readonly SyntheticPhc[] = ["PHC_0", "PHC_1", "PHC_2", "PHC_3", "PHC_4"];
export function resolveSyntheticProfessionalClass(input: {
  ruleVersion: string | null;
  applicableClasses: readonly string[];
  prohibition: "NONE" | "AGENT_PROHIBITED" | "SYSTEM_HARD_BLOCK";
}): PrimitiveGate<{ effectivePHC: SyntheticPhc; reviewRequired: boolean; agentActionBlocked: boolean }> {
  if (input.prohibition === "SYSTEM_HARD_BLOCK")
    return { status: "BLOCKED", reason: "SYSTEM_HARD_BLOCK" };
  if (input.prohibition !== "NONE" && input.prohibition !== "AGENT_PROHIBITED")
    return { status: "BLOCKED", reason: "PHC_CLASSIFICATION_UNCERTAIN" };
  if (!input.ruleVersion || !Array.isArray(input.applicableClasses) || input.applicableClasses.length === 0 ||
      input.applicableClasses.some((value) => !phcOrder.includes(value as SyntheticPhc)))
    return { status: "BLOCKED", reason: "PHC_CLASSIFICATION_UNCERTAIN" };
  const effectivePHC = phcOrder[Math.max(...input.applicableClasses.map((value) =>
    phcOrder.indexOf(value as SyntheticPhc)))]!;
  return { status: "PASS", result: {
    effectivePHC, reviewRequired: effectivePHC === "PHC_3" || effectivePHC === "PHC_4",
    agentActionBlocked: effectivePHC === "PHC_4" || input.prohibition !== "NONE"
  } };
}

export function checkSyntheticHumanAuthority(input: {
  grantConfigured: boolean;
  grantActive: boolean;
  revisionMatched: boolean;
  tenantMatched: boolean;
  dataSpaceMatched: boolean;
  decisionMatched: boolean;
  resourceMatched: boolean;
  purposeMatched: boolean;
  withinEffectivePeriod: boolean;
  assurancePolicyConfigured: boolean;
  assuranceSatisfied: boolean;
  sodPolicyConfigured: boolean;
  relationshipFactsComplete: boolean;
  requesterRef: string;
  reviewerRef: string;
}): PrimitiveGate<"SYNTHETIC_GATE_CONDITIONS_MET"> {
  if (!input.grantConfigured || !input.assurancePolicyConfigured || !input.sodPolicyConfigured)
    return { status: "BLOCKED", reason: "AUTHORITY_POLICY_UNCONFIGURED" };
  if (!input.grantActive || !input.revisionMatched || !input.tenantMatched ||
      !input.dataSpaceMatched || !input.decisionMatched || !input.resourceMatched ||
      !input.purposeMatched || !input.withinEffectivePeriod)
    return { status: "BLOCKED", reason: "AUTHORITY_GRANT_MISMATCH" };
  if (!input.assuranceSatisfied)
    return { status: "BLOCKED", reason: "ASSURANCE_STEP_UP_REQUIRED" };
  if (!input.relationshipFactsComplete || !input.requesterRef || !input.reviewerRef)
    return { status: "BLOCKED", reason: "SOD_INDETERMINATE" };
  if (input.requesterRef === input.reviewerRef)
    return { status: "BLOCKED", reason: "SOD_SELF_REVIEW" };
  return { status: "PASS", result: "SYNTHETIC_GATE_CONDITIONS_MET" };
}

type FieldClass = "PUBLIC" | "INTERNAL" | "PERSONAL" | "SENSITIVE_PERSONAL" |
  "HIGHLY_RESTRICTED" | "CREDENTIAL_SECRET";
export function projectSyntheticFields(input: {
  policyVersion: string | null;
  purposeAuthorized: boolean;
  fields: Readonly<Record<string, { classification: FieldClass; value: string }>>;
  permittedFieldNames: readonly string[];
  permittedClasses: readonly FieldClass[];
}): PrimitiveGate<Record<string, string>> {
  if (!input.policyVersion || !input.purposeAuthorized || !Array.isArray(input.permittedFieldNames) ||
      !Array.isArray(input.permittedClasses))
    return { status: "BLOCKED", reason: "FIELD_PROJECTION_POLICY_UNCONFIGURED" };
  const result: Record<string, string> = {};
  for (const name of input.permittedFieldNames) {
    if (!Object.prototype.hasOwnProperty.call(input.fields, name)) continue;
    const field = input.fields[name];
    if (!field) continue;
    if (field.classification === "CREDENTIAL_SECRET" ||
        field.classification === "SENSITIVE_PERSONAL" ||
        field.classification === "HIGHLY_RESTRICTED") continue;
    if (input.permittedClasses.includes(field.classification)) result[name] = field.value;
  }
  return { status: "PASS", result };
}

type ScanResult = "PASS" | "FAIL" | "INDETERMINATE";
type ContaminationScanResults = Readonly<Record<
  "exact" | "normalized" | "semantic" | "template" | "generatorSeed" |
  "expectedAnswer" | "reviewerAccess", ScanResult
>>;
export function checkSyntheticEvalIsolation(input: {
  synthetic: boolean;
  scope: "SYNTHETIC_GLOBAL" | "TENANT_SPECIFIC" | "GLOBAL_PRODUCT";
  governanceNamespaceId: string | null;
  trainPartition: string;
  evalPartition: string;
  sharedGeneratorLineage: boolean;
  expectedAnswerAccessibleToTrainingAuthor: boolean;
  scanResults: ContaminationScanResults;
}): PrimitiveGate<"ISOLATED_FOR_SYNTHETIC_TEST"> {
  if (!input.synthetic || input.scope !== "SYNTHETIC_GLOBAL" || !input.governanceNamespaceId)
    return { status: "BLOCKED", reason: "GROWTH_SCOPE_NOT_ALLOWED" };
  if (!input.trainPartition || !input.evalPartition ||
      input.trainPartition === input.evalPartition || input.sharedGeneratorLineage ||
      input.expectedAnswerAccessibleToTrainingAuthor)
    return { status: "BLOCKED", reason: "EVAL_CONTAMINATION_DETECTED" };
  const requiredScans = ["exact", "normalized", "semantic", "template", "generatorSeed",
    "expectedAnswer", "reviewerAccess"] as const;
  if (!input.scanResults || requiredScans.some((name) => input.scanResults[name] !== "PASS"))
    return { status: "BLOCKED", reason: "EVAL_CONTAMINATION_UNRESOLVED" };
  return { status: "PASS", result: "ISOLATED_FOR_SYNTHETIC_TEST" };
}
