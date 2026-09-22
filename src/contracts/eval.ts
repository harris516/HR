import { z } from "zod";

export const evaluationLevels = ["E0", "E1", "E2", "E3", "E4", "E5", "E6"] as const;
export const evalReasonCodes = [
  "EVAL_SUBJECT_NOT_FROZEN",
  "EVAL_SCHEMA_VERSION_UNSUPPORTED",
  "EVAL_REFERENCE_MISSING",
  "EVAL_DATASET_NOT_APPROVED",
  "EVAL_REAL_DATA_NOT_ALLOWED",
  "EVAL_CONTAMINATION_DETECTED",
  "EVAL_CONTAMINATION_INDETERMINATE",
  "EVAL_ORACLE_CONFLICT",
  "EVAL_HARD_ASSERTION_FAILED",
  "EVAL_REQUIRED_COVERAGE_MISSING",
  "EVAL_ZERO_TOLERANCE_EVENT_DETECTED",
  "EVAL_BLOCKING_THRESHOLD_MISSING",
  "EVAL_QUALITY_THRESHOLD_FAILED",
  "EVAL_CASE_FLAKY",
  "EVAL_INFRASTRUCTURE_INVALID",
  "EVAL_RETRY_NOT_ALLOWED",
  "EVAL_DEPENDENCY_CHANGED",
  "EVAL_EVIDENCE_INVALIDATED",
  "EVAL_ACCEPTANCE_AUTHORITY_REQUIRED",
  "EVAL_ACCEPTANCE_NOT_AUTHORIZED",
  "EVAL_ACCEPTED_FOR_NEXT_GATE"
] as const;

export const evalReasonCodeSchema = z.enum(evalReasonCodes);
const ref = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const description = z.string().trim().min(1).max(1000);
const refs = z.array(ref);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.iso.datetime({ offset: true });
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
const level = z.enum(evaluationLevels);

export const evalSuiteManifestV1Schema = z.object({
  schemaVersion: z.literal("eval-suite-manifest.v1"), suiteId: ref, suiteVersion: version,
  evaluationLevel: level, purpose: description, subjectProfileRequirementRef: ref,
  scenarioFamilyRefs: refs, caseSnapshotRefs: refs, oraclePolicyRef: ref,
  acceptanceProfileRef: ref, requiredEnvironmentProfileRef: ref,
  requiredRepeatPolicyRef: ref, dependencyVersionRefs: refs, ownerRef: ref,
  reviewDecisionRefs: refs, createdAt: timestamp, expiresAt: timestamp.optional(),
  contentDigest: digest,
  status: z.enum(["DRAFT", "REVIEWED", "APPROVED_FOR_DESIGN", "ACTIVE_FUTURE", "SUPERSEDED", "REVOKED"])
}).strict();

const frozenSnapshot = z.object({ snapshotRef: ref, contentDigest: digest, synthetic: z.literal(true) }).strict();
export const evalCaseV1Schema = z.object({
  schemaVersion: z.literal("eval-case.v1"), evalCaseId: ref, caseVersion: version,
  suiteRef: ref, scenarioFamily: ref, riskClass: ref, synthetic: z.literal(true),
  inputFixtureRef: ref, requestContextSnapshot: frozenSnapshot, subjectClues: refs,
  expectedRoute: ref, expectedResultClass: ref, expectedStateTransitions: refs,
  expectedReasonCodes: z.array(evalReasonCodeSchema), expectedAuditEvents: refs,
  requiredOutputAssertions: refs, forbiddenEvents: refs, sideEffectExpectation: z.literal("NONE"),
  oracleRefs: refs, repeatPolicyRef: ref, contentDigest: digest
}).strict();

export const evalRunV1Schema = z.object({
  schemaVersion: z.literal("eval-run.v1"), evalRunId: ref, runAttempt: z.number().int().positive(),
  suiteSnapshotRef: ref, subjectUnderTestRef: ref, environmentSnapshotRef: ref,
  datasetSnapshotRef: ref, seedSetRef: ref, startedAt: timestamp, completedAt: timestamp.optional(),
  status: z.enum(["PLANNED", "BLOCKED", "RUNNING_FUTURE", "COMPLETED_FUTURE", "INVALIDATED", "ABORTED"]),
  caseResultRefs: refs, infrastructureIncidentRefs: refs, aggregateResultRef: ref.optional(),
  contentDigest: digest, auditRef: ref
}).strict();

export const evalCaseResultV1Schema = z.object({
  schemaVersion: z.literal("eval-case-result.v1"), caseResultId: ref, evalRunRef: ref,
  evalCaseSnapshotRef: ref, attemptIndex: z.number().int().nonnegative(),
  observedRoute: ref, observedResultClass: ref, observedStateTransitions: refs,
  observedReasonCodes: z.array(evalReasonCodeSchema), observedAuditEventRefs: refs,
  observedOutputRef: ref, forbiddenEventObservations: refs, assertionResults: refs,
  latencyObservation: z.number().nonnegative().optional(),
  tokenAndCostObservation: z.object({ tokens: z.number().int().nonnegative(), cost: z.number().nonnegative() }).strict().optional(),
  result: z.enum(["PASS", "FAIL", "INDETERMINATE", "INFRASTRUCTURE_INVALID"]),
  failureClass: z.enum([
    "CONTRACT_FAILURE", "STATE_SEMANTIC_FAILURE", "AUTHORIZATION_FAILURE",
    "TENANT_ISOLATION_FAILURE", "PRIVACY_OR_SECRET_FAILURE", "PROFESSIONAL_BOUNDARY_FAILURE",
    "AUDIT_FAILURE", "IDEMPOTENCY_OR_CONCURRENCY_FAILURE", "CONNECTOR_OR_RECONCILIATION_FAILURE",
    "OUTPUT_OR_ARTIFACT_FAILURE", "GROWTH_OR_TRAINING_BOUNDARY_FAILURE",
    "RESILIENCE_OR_RECOVERY_FAILURE", "QUALITY_THRESHOLD_FAILURE", "ORACLE_CONFLICT",
    "INFRASTRUCTURE_FAILURE"
  ]).optional(), contentDigest: digest, auditRef: ref
}).strict();

export const evalDatasetManifestV1Schema = z.object({
  schemaVersion: z.literal("eval-dataset-manifest.v1"), evalDatasetId: ref,
  datasetVersion: version, purpose: z.literal("INDEPENDENT_EVALUATION"),
  coveredLevels: z.array(level), scopeRef: ref, synthetic: z.literal(true),
  scenarioFamilyDistribution: z.record(ref, z.number().int().nonnegative()),
  generatorLineageRefs: refs, holdoutPartitionRefs: refs, acceptancePartitionRefs: refs,
  trainingRegistryDigest: digest, contaminationCheckRef: ref,
  privacySecurityReviewRefs: refs, retentionClassRef: ref, contentDigest: digest,
  status: z.enum(["DRAFT", "QUARANTINED", "REVIEWED", "APPROVED_FUTURE", "SUPERSEDED", "REVOKED"])
}).strict();

export const acceptanceProfileV1Schema = z.object({
  schemaVersion: z.literal("acceptance-profile.v1"), acceptanceProfileId: ref,
  profileVersion: version, evaluationLevel: level, blockingAssertionRefs: refs,
  requiredScenarioFamilies: refs, zeroToleranceEventTypes: refs,
  qualityMetricDefinitions: refs, qualityThresholdRefs: refs, repeatPolicyRef: ref,
  segmentCoveragePolicyRef: ref, flakyPolicyRef: ref, infrastructureValidityPolicyRef: ref,
  knownLimitationPolicyRef: ref, contentDigest: digest
}).strict();

export const acceptanceAggregateV1Schema = z.object({
  schemaVersion: z.literal("acceptance-aggregate.v1"), aggregateId: ref,
  evalRunSnapshotRefs: refs, subjectUnderTestRef: ref, acceptanceProfileRef: ref,
  levelResults: refs, blockingAssertionSummary: ref, zeroToleranceEventSummary: ref,
  scenarioCoverageSummary: ref, segmentCoverageSummary: ref, qualityMetricSummary: ref,
  flakyCaseRefs: refs, unresolvedCaseRefs: refs, knownLimitations: refs,
  result: z.enum(["PASS", "FAIL", "INDETERMINATE"]), contentDigest: digest
}).strict();

export const acceptanceDecisionV1Schema = z.object({
  schemaVersion: z.literal("acceptance-decision.v1"), acceptanceDecisionId: ref,
  aggregateSnapshotRef: ref, subjectUnderTestRef: ref,
  decision: z.enum(["ACCEPTED_FOR_NEXT_GATE", "REJECTED", "REVISION_REQUIRED", "INDETERMINATE"]),
  acceptedEvaluationLevels: z.array(level), approvedScopeRef: ref, conditions: refs,
  reasonCodes: z.array(evalReasonCodeSchema), reviewerResolutionRefs: refs,
  authorityRequirementRef: ref, sodEvaluationRef: ref, expectedAggregateVersion: version,
  idempotencyKey: ref, decidedAt: timestamp, expiresAt: timestamp,
  contentDigest: digest, auditRef: ref
}).strict();

export const evalRequestV1Schema = z.object({
  schemaVersion: z.literal("eval-request.v1"), requestId: ref, suiteId: ref,
  datasetId: ref, subjectSnapshotRef: ref, synthetic: z.literal(true)
}).strict();
export type EvalRequestV1 = z.infer<typeof evalRequestV1Schema>;
export type EvalReasonCode = z.infer<typeof evalReasonCodeSchema>;
