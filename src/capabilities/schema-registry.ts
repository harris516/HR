import { z } from "zod";
import {
  capabilityRefSchema,
  payloadSchemaNames,
  resultStatusSchema,
  sideEffectClassSchema,
  type PayloadSchemaName
} from "../contracts/capability.js";
import { canonicalReasonCodeSchema } from "./reason-codes.js";

const refSchema = z.string().min(1);
const refsSchema = z.array(refSchema);
const versionSchema = z.number().int().nonnegative();
const dateTimeSchema = z.string().datetime();
const freshnessSchema = z.enum(["fresh", "stale", "unavailable", "unknown", "not_applicable"]);
const qualitySchema = z.enum(["unchecked", "valid", "warning", "invalid", "indeterminate"]);

export const timeRangeSchema = z.object({
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional()
}).strict().superRefine((value, context) => {
  if (value.from === undefined && value.to === undefined) {
    context.addIssue({ code: "custom", message: "at least one time boundary is required" });
  }
  if (value.from !== undefined && value.to !== undefined && value.from > value.to) {
    context.addIssue({ code: "custom", message: "from must not be later than to" });
  }
});

export const caseStatusFilterSchema = z.object({
  dimension: z.enum([
    "LIFECYCLE",
    "WORKFLOW",
    "SUGGESTED_READINESS",
    "FORMAL_READINESS",
    "CONFIRMATION"
  ]),
  values: z.array(z.string().min(1)).min(1)
}).strict();

export const riskFilterSchema = z.object({
  dimension: z.enum(["SEVERITY", "BLOCKING", "PHC", "REVIEW_STATUS"]),
  values: z.array(z.string().min(1)).min(1)
}).strict();

const authorizedCaseSummarySchema = z.object({
  caseRef: refSchema,
  caseVersion: versionSchema,
  displaySubjectRef: refSchema,
  plannedStartDateCandidate: dateTimeSchema.optional(),
  lifecycleStatus: z.enum([
    "draft",
    "active",
    "suspended",
    "handoff_ready",
    "closed",
    "archived",
    "cancelled_by_authorized_process"
  ]),
  suggestedReadiness: z.enum(["READY", "AT_RISK", "BLOCKED", "REVIEW_REQUIRED"]),
  formalReadiness: z.enum(["READY", "AT_RISK", "BLOCKED", "REVIEW_REQUIRED"]).nullable(),
  riskSummaryCodes: z.array(canonicalReasonCodeSchema),
  sourceFreshnessSummary: freshnessSchema,
  fieldProjectionRef: refSchema
}).strict();

const requirementStatusItemSchema = z.object({
  requirementRef: refSchema,
  requirementVersion: versionSchema,
  requirementType: z.string().min(1),
  applicabilityStatus: z.enum(["applicable", "not_applicable", "indeterminate"]),
  formalStatus: z.enum([
    "not_started",
    "in_progress",
    "evidence_pending",
    "completed_candidate",
    "completed",
    "exception_open",
    "review_required",
    "blocked",
    "not_applicable",
    "waived",
    "exception_accepted",
    "cancelled_by_valid_process"
  ]),
  completionCandidateStatus: z.enum(["COMPLETE_CANDIDATE", "NOT_COMPLETE", "INDETERMINATE"]),
  criteriaVersionRef: refSchema,
  evidenceSetVersionRef: refSchema,
  freshnessStatus: freshnessSchema,
  reasonCodes: z.array(canonicalReasonCodeSchema)
}).strict();

const authorizedRiskSummarySchema = z.object({
  riskRef: refSchema,
  caseRef: refSchema,
  caseVersion: versionSchema,
  severity: z.enum(["low", "medium", "high", "critical", "indeterminate"]),
  blocking: z.boolean(),
  effectivePHC: z.enum(["PHC_0", "PHC_1", "PHC_2", "PHC_3", "PHC_4"]),
  reasonCodes: z.array(canonicalReasonCodeSchema).min(1),
  affectedObjectRefs: refsSchema,
  sourceFreshnessSummary: freshnessSchema,
  fieldProjectionRef: refSchema
}).strict();

const redactedObservationSummarySchema = z.object({
  observationRef: refSchema,
  fieldOrPropositionRef: refSchema,
  normalizedValueRef: refSchema.optional(),
  redactedValue: z.string().optional(),
  sourceRecordRef: refSchema,
  sourceVersion: refSchema,
  occurredAt: dateTimeSchema.optional(),
  observedAt: dateTimeSchema,
  freshnessStatus: freshnessSchema,
  qualityStatus: qualitySchema,
  policyVersion: refSchema,
  redactionApplied: z.boolean()
}).strict();

const evidenceLinkSummarySchema = z.object({
  evidenceLinkRef: refSchema,
  evidenceRef: refSchema,
  linkedObjectRef: refSchema,
  evidenceVersion: refSchema,
  validationStatus: z.enum(["valid", "invalid", "indeterminate"]),
  authorityStatus: z.enum(["authoritative", "candidate", "unknown", "conflict"]),
  effectiveAt: dateTimeSchema.optional(),
  expiresAt: dateTimeSchema.optional()
}).strict();

const authorizedResponsibilityItemSchema = z.object({
  taskOrRequirementRef: refSchema,
  caseRef: refSchema,
  ownerRoleRef: refSchema,
  assigneeRef: refSchema.optional(),
  deadline: dateTimeSchema.optional(),
  status: z.string().min(1),
  nextActionCode: z.string().min(1).optional(),
  fieldProjectionRef: refSchema
}).strict();

const authorizedArtifactSummarySchema = z.object({
  artifactRef: refSchema,
  artifactVersion: versionSchema,
  artifactType: z.string().min(1),
  artifactStatus: z.enum(["DRAFT", "REVIEWED", "CONFIRMED", "SUPERSEDED"]),
  createdAt: dateTimeSchema,
  supersedesArtifactRef: refSchema.optional(),
  sensitivityClass: z.enum(["SYNTHETIC_PUBLIC", "SYNTHETIC_INTERNAL", "SYNTHETIC_SENSITIVE"]),
  fieldProjectionRef: refSchema
}).strict();

const redactedAuditEventSummarySchema = z.object({
  auditEventRef: refSchema,
  eventType: z.string().min(1),
  resourceRef: refSchema,
  actorDisplayRef: refSchema,
  resultStatus: resultStatusSchema,
  reasonCodes: z.array(canonicalReasonCodeSchema),
  occurredAt: dateTimeSchema,
  policyVersionRefs: refsSchema,
  redactionApplied: z.boolean()
}).strict();

const intakeHandoffQuerySchema = z.object({
  handoffRef: refSchema,
  expectedSourceVersion: refSchema.optional(),
  fieldSetRef: refSchema,
  asOf: dateTimeSchema.optional()
}).strict();

const intakeHandoffResultSchema = z.object({
  handoffRef: refSchema,
  subjectCandidateRefs: refsSchema,
  offerStatus: z.enum(["accepted", "withdrawn", "unknown", "conflict"]),
  plannedStartDateCandidate: dateTimeSchema,
  sourceRecordRefs: refsSchema.min(1),
  freshnessStatus: freshnessSchema,
  qualityStatus: qualitySchema,
  sourcePolicyVersion: refSchema,
  sourceVersion: refSchema
}).strict();

const intakeCompletenessInputSchema = z.object({
  handoffRef: refSchema,
  expectedSourceVersion: refSchema,
  intakePolicyRef: refSchema,
  intakePolicyVersion: refSchema
}).strict();

const intakeCompletenessResultSchema = z.object({
  evaluationRef: refSchema,
  result: z.enum(["COMPLETE_CANDIDATE", "INCOMPLETE", "CONFLICT", "INDETERMINATE"]),
  missingFieldCodes: z.array(z.string().min(1)),
  conflictRefs: refsSchema,
  identityResolutionStatus: z.enum(["unique", "not_found", "multiple", "conflict", "denied"]),
  policyRef: refSchema,
  policyVersion: refSchema,
  inputSnapshotDigest: refSchema
}).strict();

const intakeDraftInputSchema = z.object({
  handoffRef: refSchema,
  completenessEvaluationRef: refSchema,
  expectedSourceVersion: refSchema,
  approvedFactRefs: refsSchema,
  language: z.string().min(1),
  templateRef: refSchema
}).strict();

const caseCollectionQuerySchema = z.object({
  filterSpecRef: refSchema,
  timeRange: timeRangeSchema.optional(),
  statusFilters: z.array(caseStatusFilterSchema).optional(),
  riskFilters: z.array(riskFilterSchema).optional(),
  organizationScopeRef: refSchema.optional(),
  pageSize: z.number().int().positive().max(200),
  pageToken: refSchema.optional(),
  snapshotAt: dateTimeSchema.optional()
}).strict();

const caseListResultSchema = z.object({
  items: z.array(authorizedCaseSummarySchema),
  nextPageToken: refSchema.optional(),
  authorizedResultCount: z.number().int().nonnegative().optional(),
  snapshotAt: dateTimeSchema,
  sortSpecRef: refSchema,
  fieldProjectionRef: refSchema
}).strict();

const caseRefQuerySchema = z.object({
  onboardingCaseRef: refSchema,
  expectedCaseVersion: versionSchema.optional(),
  fieldSetRef: refSchema,
  asOf: dateTimeSchema.optional()
}).strict();

const caseStatusResultSchema = z.object({
  caseRef: refSchema,
  caseVersion: versionSchema,
  lifecycleStatus: authorizedCaseSummarySchema.shape.lifecycleStatus,
  workflowStage: z.enum([
    "offer_accepted",
    "case_intake",
    "requirements_initialized",
    "preparation_in_progress",
    "ready_assessment",
    "day1_ready_checkpoint_reached",
    "handoff_pending"
  ]),
  suggestedReadiness: authorizedCaseSummarySchema.shape.suggestedReadiness,
  formalReadiness: authorizedCaseSummarySchema.shape.formalReadiness,
  confirmationStatus: z.enum([
    "not_required",
    "confirmation_required",
    "pending",
    "confirmed",
    "rejected",
    "invalidated",
    "revalidation_required"
  ]),
  knowledgeState: z.enum(["KNOWN", "UNKNOWN", "STALE", "CONFLICT"]),
  sourceRefs: refsSchema,
  freshness: freshnessSchema,
  policyVersionRefs: refsSchema
}).strict();

const requirementStatusQuerySchema = z.object({
  onboardingCaseRef: refSchema,
  requirementRef: refSchema.optional(),
  requirementTypeFilter: z.string().min(1).optional(),
  expectedCaseVersion: versionSchema.optional(),
  asOf: dateTimeSchema.optional()
}).strict();

const requirementStatusResultSchema = z.object({
  caseRef: refSchema,
  caseVersion: versionSchema,
  requirements: z.array(requirementStatusItemSchema),
  criteriaVersionRefs: refsSchema,
  evidenceSetVersionRefs: refsSchema,
  sourceRefs: refsSchema,
  freshness: freshnessSchema,
  reasonCodes: z.array(canonicalReasonCodeSchema)
}).strict();

const requirementCompletionInputSchema = z.object({
  onboardingCaseRef: refSchema,
  requirementRef: refSchema,
  expectedCaseVersion: versionSchema,
  expectedRequirementVersion: versionSchema
}).strict();

const requirementCompletionResultSchema = z.object({
  evaluationRef: refSchema,
  result: z.enum(["COMPLETE_CANDIDATE", "NOT_COMPLETE", "INDETERMINATE"]),
  criteriaResultRefs: refsSchema,
  evidenceValidationRefs: refsSchema,
  blockingRefs: refsSchema,
  inputSnapshotDigest: refSchema,
  formalStatusChanged: z.literal(false)
}).strict();

const riskCollectionQuerySchema = z.object({
  caseScopeRef: refSchema,
  riskPolicyRef: refSchema,
  riskPolicyVersion: refSchema,
  snapshotAt: dateTimeSchema,
  severityFilters: z.array(z.enum(["low", "medium", "high", "critical", "indeterminate"])).optional(),
  blockingFilters: z.array(z.boolean()).optional(),
  pageSize: z.number().int().positive().max(200),
  pageToken: refSchema.optional()
}).strict();

const riskListResultSchema = z.object({
  items: z.array(authorizedRiskSummarySchema),
  nextPageToken: refSchema.optional(),
  snapshotAt: dateTimeSchema,
  policyRef: refSchema,
  policyVersion: refSchema,
  sourceRefs: refsSchema,
  freshness: freshnessSchema,
  reasonCodes: z.array(canonicalReasonCodeSchema)
}).strict();

const evidenceInspectionQuerySchema = z.object({
  objectRef: refSchema,
  fieldOrPropositionRefs: refsSchema.min(1),
  expectedObjectVersion: versionSchema.optional(),
  fieldSetRef: refSchema,
  asOf: dateTimeSchema.optional()
}).strict();

const evidenceInspectionResultSchema = z.object({
  objectRef: refSchema,
  observations: z.array(redactedObservationSummarySchema),
  evidenceLinks: z.array(evidenceLinkSummarySchema),
  authorityStatus: z.enum(["authoritative", "candidate", "unknown", "conflict"]),
  provenanceStatus: z.enum(["complete", "incomplete", "unknown"]),
  freshnessStatus: freshnessSchema,
  qualityStatus: qualitySchema,
  conflictRefs: refsSchema,
  policyVersionRefs: refsSchema
}).strict();

const responsibilityWorkboxQuerySchema = z.object({
  responsibilityScopeRef: refSchema,
  deadlineRange: timeRangeSchema.optional(),
  statusFilters: z.array(z.string().min(1)).optional(),
  pageSize: z.number().int().positive().max(200),
  pageToken: refSchema.optional(),
  snapshotAt: dateTimeSchema.optional()
}).strict();

const responsibilityWorkboxResultSchema = z.object({
  items: z.array(authorizedResponsibilityItemSchema),
  nextPageToken: refSchema.optional(),
  snapshotAt: dateTimeSchema,
  fieldProjectionRef: refSchema
}).strict();

const coordinationDraftInputSchema = z.object({
  onboardingCaseRef: refSchema,
  draftType: z.enum(["REMINDER", "ESCALATION"]),
  audienceRoleCandidate: refSchema,
  approvedFactRefs: refsSchema,
  missingItemRefs: refsSchema,
  deadlineRef: refSchema.optional(),
  language: z.string().min(1),
  templateRef: refSchema,
  expectedCaseVersion: versionSchema
}).strict();

const readinessEvaluationInputSchema = z.object({
  onboardingCaseRef: refSchema,
  expectedCaseVersion: versionSchema,
  evaluationPurpose: z.literal("DAY1_READY_CHECK")
}).strict();

const readinessRevalidationInputSchema = z.object({
  onboardingCaseRef: refSchema,
  expectedCaseVersion: versionSchema,
  previousEvaluationRef: refSchema,
  invalidationTriggerRef: refSchema,
  causationId: refSchema,
  deduplicationKey: refSchema
}).strict();

const readinessEvaluationResultSchema = z.object({
  evaluationId: refSchema,
  caseRef: refSchema,
  caseVersion: versionSchema,
  authoritativeSnapshotRef: refSchema,
  authoritativeSnapshotDigest: refSchema,
  ruleSetRef: refSchema,
  ruleSetVersion: refSchema,
  result: z.enum(["ELIGIBLE", "NOT_ELIGIBLE", "INDETERMINATE"]),
  blockingRequirementRefs: refsSchema,
  unknownRefs: refsSchema,
  conflictRefs: refsSchema,
  reviewRequiredRefs: refsSchema,
  reasonCodes: z.array(canonicalReasonCodeSchema),
  evaluatedAt: dateTimeSchema,
  formalReadinessChanged: z.literal(false)
}).strict();

const readyCardDraftInputSchema = z.object({
  onboardingCaseRef: refSchema,
  expectedCaseVersion: versionSchema,
  readinessEvaluationRef: refSchema,
  templateRef: refSchema,
  language: z.string().min(1),
  fieldSetRef: refSchema
}).strict();

const artifactCollectionQuerySchema = z.object({
  onboardingCaseRef: refSchema,
  artifactTypeFilters: z.array(z.string().min(1)).optional(),
  statusFilters: z.array(z.enum(["DRAFT", "REVIEWED", "CONFIRMED", "SUPERSEDED"])).optional(),
  pageSize: z.number().int().positive().max(200),
  pageToken: refSchema.optional(),
  snapshotAt: dateTimeSchema.optional()
}).strict();

const artifactListResultSchema = z.object({
  items: z.array(authorizedArtifactSummarySchema),
  nextPageToken: refSchema.optional(),
  snapshotAt: dateTimeSchema,
  fieldProjectionRef: refSchema
}).strict();

const auditTimelineQuerySchema = z.object({
  resourceRef: refSchema,
  eventTypeFilters: z.array(z.string().min(1)).optional(),
  timeRange: timeRangeSchema.optional(),
  pageSize: z.number().int().positive().max(200),
  pageToken: refSchema.optional(),
  redactionPolicyRef: refSchema
}).strict();

const auditTimelineResultSchema = z.object({
  items: z.array(redactedAuditEventSummarySchema),
  nextPageToken: refSchema.optional(),
  snapshotAt: dateTimeSchema,
  redactionPolicyRef: refSchema,
  redactionPolicyVersion: refSchema
}).strict();

const reviewDraftInputSchema = z.object({
  onboardingCaseRef: refSchema,
  affectedObjectRefs: refsSchema,
  candidatePHC: z.enum(["PHC_2", "PHC_3", "PHC_4"]),
  prohibitionClass: z.enum(["NONE", "AGENT_PROHIBITED"]),
  approvedFactRefs: refsSchema,
  sourceEvidenceRefs: refsSchema,
  conflictRefs: refsSchema,
  impactScopeRefs: refsSchema,
  requiredReviewerType: refSchema,
  expectedCaseVersion: versionSchema,
  templateRef: refSchema,
  language: z.string().min(1)
}).strict();

const draftArtifactResultSchema = z.object({
  artifactRef: refSchema,
  artifactVersion: versionSchema,
  artifactType: z.string().min(1),
  artifactStatus: z.literal("DRAFT"),
  sendStatus: z.literal("NOT_SENT"),
  formalStateChanged: z.literal(false),
  externalSideEffect: z.literal(false),
  sourceReferences: refsSchema,
  redactionSummary: z.string(),
  reviewRequired: z.boolean(),
  contentDigest: refSchema
}).strict();

export const capabilityPayloadSchemas: Record<PayloadSchemaName, z.ZodType> = {
  IntakeHandoffQueryV1: intakeHandoffQuerySchema,
  IntakeHandoffResultV1: intakeHandoffResultSchema,
  IntakeCompletenessInputV1: intakeCompletenessInputSchema,
  IntakeCompletenessResultV1: intakeCompletenessResultSchema,
  IntakeDraftInputV1: intakeDraftInputSchema,
  CaseCollectionQueryV1: caseCollectionQuerySchema,
  CaseListResultV1: caseListResultSchema,
  CaseRefQueryV1: caseRefQuerySchema,
  CaseStatusResultV1: caseStatusResultSchema,
  RequirementStatusQueryV1: requirementStatusQuerySchema,
  RequirementStatusResultV1: requirementStatusResultSchema,
  RequirementCompletionInputV1: requirementCompletionInputSchema,
  RequirementCompletionResultV1: requirementCompletionResultSchema,
  RiskCollectionQueryV1: riskCollectionQuerySchema,
  RiskListResultV1: riskListResultSchema,
  EvidenceInspectionQueryV1: evidenceInspectionQuerySchema,
  EvidenceInspectionResultV1: evidenceInspectionResultSchema,
  ResponsibilityWorkboxQueryV1: responsibilityWorkboxQuerySchema,
  ResponsibilityWorkboxResultV1: responsibilityWorkboxResultSchema,
  CoordinationDraftInputV1: coordinationDraftInputSchema,
  ReadinessEvaluationInputV1: readinessEvaluationInputSchema,
  ReadinessRevalidationInputV1: readinessRevalidationInputSchema,
  ReadinessEvaluationResultV1: readinessEvaluationResultSchema,
  ReadyCardDraftInputV1: readyCardDraftInputSchema,
  ArtifactCollectionQueryV1: artifactCollectionQuerySchema,
  ArtifactListResultV1: artifactListResultSchema,
  AuditTimelineQueryV1: auditTimelineQuerySchema,
  AuditTimelineResultV1: auditTimelineResultSchema,
  ReviewDraftInputV1: reviewDraftInputSchema,
  DraftArtifactResultV1: draftArtifactResultSchema
};

export const capabilityInputEnvelopeSchema = z.object({
  schemaVersion: z.literal("1"),
  capabilityRequestRef: refSchema,
  inputPayloadSchemaRef: z.enum(payloadSchemaNames),
  inputPayloadDigest: refSchema,
  payload: z.unknown()
}).strict();

export const capabilityResultEnvelopeSchema = z.object({
  schemaVersion: z.literal("1"),
  capabilityResultId: refSchema,
  capabilityRef: capabilityRefSchema,
  capabilityRequestRef: refSchema,
  requestId: refSchema,
  taskId: refSchema,
  attemptId: refSchema,
  correlationId: refSchema,
  requestContextRef: refSchema,
  authorizationDecisionRef: refSchema,
  tenantId: refSchema,
  dataSpaceId: refSchema,
  resourceRefs: refsSchema,
  inputPayloadDigest: refSchema,
  inputSnapshotRef: refSchema.optional(),
  outputPayloadSchemaRef: z.enum(payloadSchemaNames).optional(),
  resultStatus: resultStatusSchema,
  resultPayloadRef: refSchema.optional(),
  reasonCodes: z.array(canonicalReasonCodeSchema),
  sourceReferences: refsSchema,
  freshnessResults: z.array(freshnessSchema),
  policyVersionRefs: refsSchema,
  objectVersionRefs: refsSchema,
  implementationBindingRef: refSchema,
  implementationVersion: refSchema,
  sideEffectClass: sideEffectClassSchema,
  executionReceiptRef: refSchema.optional(),
  auditRef: refSchema,
  startedAt: dateTimeSchema,
  completedAt: dateTimeSchema
}).strict().superRefine((value, context) => {
  if (!["SUCCESS", "PARTIAL"].includes(value.resultStatus) && value.reasonCodes.length === 0) {
    context.addIssue({ code: "custom", message: "non-success results require a reason code" });
  }
  if (["SUCCESS", "PARTIAL"].includes(value.resultStatus) && value.outputPayloadSchemaRef === undefined) {
    context.addIssue({ code: "custom", message: "successful results require an output schema" });
  }
  if (value.executionReceiptRef !== undefined) {
    context.addIssue({ code: "custom", message: "S1 A0-A2 capabilities cannot emit execution receipts" });
  }
});

export function parseCapabilityInput(
  expectedSchema: PayloadSchemaName,
  input: unknown
): unknown {
  const envelope = capabilityInputEnvelopeSchema.parse(input);
  if (envelope.inputPayloadSchemaRef !== expectedSchema) {
    throw new Error(`input schema mismatch: expected ${expectedSchema}`);
  }
  return capabilityPayloadSchemas[expectedSchema].parse(envelope.payload);
}

export function assertSchemaRegistryComplete(): void {
  const registered = new Set(Object.keys(capabilityPayloadSchemas));
  for (const schemaName of payloadSchemaNames) {
    if (!registered.has(schemaName)) {
      throw new Error(`missing payload schema: ${schemaName}`);
    }
  }
  if (registered.size !== payloadSchemaNames.length) {
    throw new Error("payload schema registry contains an unknown schema");
  }
}
