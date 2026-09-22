import { z } from "zod";

export const skillIds = [
  "onboarding_task_navigation_pack",
  "onboarding_case_intake_pack",
  "onboarding_requirement_tracking_pack",
  "onboarding_status_control_pack",
  "onboarding_coordination_pack",
  "onboarding_delivery_pack"
] as const;

export const plannedCapabilityIds = [
  "hr.onboarding.intake.handoff.read",
  "hr.onboarding.intake.completeness.evaluate",
  "hr.onboarding.intake.draft",
  "hr.onboarding.case.list",
  "hr.onboarding.case.status.read",
  "hr.onboarding.requirement.status.read",
  "hr.onboarding.requirement.completion.evaluate",
  "hr.onboarding.risk.list",
  "hr.onboarding.source_evidence.inspect",
  "hr.onboarding.responsibility.workbox.read",
  "hr.onboarding.reminder.draft",
  "hr.onboarding.escalation.draft",
  "hr.onboarding.readiness.evaluate",
  "hr.onboarding.readiness.revalidate",
  "hr.onboarding.ready_card.draft",
  "hr.onboarding.artifact.list",
  "hr.onboarding.audit.timeline.read",
  "hr.onboarding.review_request.draft"
] as const;

export const reservedCapabilityIds = [
  "hr.onboarding.case.intake.create",
  "hr.onboarding.requirement.initialize",
  "hr.onboarding.requirement.complete",
  "hr.onboarding.task.state.update",
  "hr.onboarding.evidence.link.create",
  "hr.onboarding.responsibility.assign",
  "hr.onboarding.deadline.update",
  "hr.onboarding.exception.open",
  "hr.onboarding.review.create",
  "hr.onboarding.review.decision.commit",
  "hr.onboarding.requirement.waiver.commit",
  "hr.onboarding.exception.accept",
  "hr.onboarding.frozen_action.create",
  "hr.onboarding.frozen_action.release",
  "hr.onboarding.ready.confirm",
  "hr.onboarding.notification.send",
  "hr.onboarding.artifact.export"
] as const;

export const payloadSchemaNames = [
  "IntakeHandoffQueryV1",
  "IntakeHandoffResultV1",
  "IntakeCompletenessInputV1",
  "IntakeCompletenessResultV1",
  "IntakeDraftInputV1",
  "CaseCollectionQueryV1",
  "CaseListResultV1",
  "CaseRefQueryV1",
  "CaseStatusResultV1",
  "RequirementStatusQueryV1",
  "RequirementStatusResultV1",
  "RequirementCompletionInputV1",
  "RequirementCompletionResultV1",
  "RiskCollectionQueryV1",
  "RiskListResultV1",
  "EvidenceInspectionQueryV1",
  "EvidenceInspectionResultV1",
  "ResponsibilityWorkboxQueryV1",
  "ResponsibilityWorkboxResultV1",
  "CoordinationDraftInputV1",
  "ReadinessEvaluationInputV1",
  "ReadinessRevalidationInputV1",
  "ReadinessEvaluationResultV1",
  "ReadyCardDraftInputV1",
  "ArtifactCollectionQueryV1",
  "ArtifactListResultV1",
  "AuditTimelineQueryV1",
  "AuditTimelineResultV1",
  "ReviewDraftInputV1",
  "DraftArtifactResultV1"
] as const;

export const authorizationProfileIds = [
  "AUTH-INTAKE-READ-V1",
  "AUTH-CASE-COLLECTION-READ-V1",
  "AUTH-CASE-READ-V1",
  "AUTH-REQUIREMENT-READ-V1",
  "AUTH-EVIDENCE-READ-V1",
  "AUTH-WORKBOX-READ-V1",
  "AUTH-ANALYZE-V1",
  "AUTH-DRAFT-V1",
  "AUTH-ARTIFACT-READ-V1",
  "AUTH-AUDIT-READ-V1"
] as const;

export const dataProfileIds = [
  "DATA-INTAKE-V1",
  "DATA-CASE-V1",
  "DATA-REQUIREMENT-V1",
  "DATA-RISK-V1",
  "DATA-EVIDENCE-V1",
  "DATA-READY-V1",
  "DATA-DRAFT-V1",
  "DATA-AUDIT-V1"
] as const;

export const executionProfileIds = [
  "EXEC-READ-V1",
  "EXEC-ANALYZE-V1",
  "EXEC-DRAFT-V1"
] as const;

export const idempotencyProfiles = [
  "QUERY_SOURCE_VERSION",
  "SNAPSHOT_POLICY_VERSION",
  "SUBJECT_DRAFT_INPUT_VERSION",
  "QUERY_GRANT_VERSION",
  "RESOURCE_FIELD_VERSION",
  "TRIGGER_SNAPSHOT_VERSION",
  "OBJECT_OBSERVATION_VERSION",
  "CASE_DRAFT_INPUT_VERSION",
  "AUTHORITATIVE_SNAPSHOT_DIGEST",
  "TRIGGER_NEW_SNAPSHOT_DIGEST",
  "CASE_EVALUATION_VERSION"
] as const;

export const capabilityIdSchema = z.enum(plannedCapabilityIds);
export const reservedCapabilityIdSchema = z.enum(reservedCapabilityIds);
export const payloadSchemaNameSchema = z.enum(payloadSchemaNames);
export const skillIdSchema = z.enum(skillIds);
export const authorizationProfileIdSchema = z.enum(authorizationProfileIds);
export const dataProfileIdSchema = z.enum(dataProfileIds);
export const executionProfileIdSchema = z.enum(executionProfileIds);
export const idempotencyProfileSchema = z.enum(idempotencyProfiles);

export const semanticVersionSchema = z.string().regex(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
  "version must be an explicit semantic version"
);

export const capabilityRefSchema = z.object({
  capabilityId: capabilityIdSchema,
  capabilityVersion: semanticVersionSchema
}).strict();

export const actionClassSchema = z.enum(["read", "analyze", "draft"]);
export const automationLevelSchema = z.enum(["A0_READ", "A1_ANALYZE", "A2_DRAFT"]);
export const phcSchema = z.enum(["PHC_0", "PHC_1", "PHC_2", "PHC_3", "PHC_4"]);
export const sideEffectClassSchema = z.enum(["NONE_READ", "NONE_ANALYZE", "DRAFT_ONLY"]);
export const capabilityStatusSchema = z.enum([
  "CONTRACT_DRAFT",
  "PLANNED_TEST_STUB",
  "TEST_STUB_ENABLED",
  "PENDING_DEPENDENCY",
  "STAGING_ENABLED",
  "PRODUCTION_ENABLED",
  "SUSPENDED",
  "RETIRED"
]);
export const resultStatusSchema = z.enum([
  "SUCCESS",
  "PARTIAL",
  "DENIED",
  "REVIEW_REQUIRED",
  "WAITING",
  "INDETERMINATE",
  "FAILED",
  "TIMED_OUT",
  "CANCELLED"
]);
export const reviewRequirementSchema = z.enum([
  "NONE",
  "CANDIDATE_ONLY",
  "HUMAN_REVIEW_IF_SENSITIVE",
  "HUMAN_REVIEW_REQUIRED",
  "PHC_4_FACTS_ONLY"
]);

export const capabilityEntrySchema = z.object({
  capabilityId: capabilityIdSchema,
  capabilityVersion: semanticVersionSchema,
  baseProfileRef: z.literal("CAP-BASE-SYNTHETIC-V1"),
  skillOwner: skillIdSchema,
  actionClass: actionClassSchema,
  automationLevel: automationLevelSchema,
  allowedPHC: z.array(phcSchema).min(1),
  inputSchemaRef: payloadSchemaNameSchema,
  outputSchemaRef: payloadSchemaNameSchema,
  authorizationProfileRefs: z.array(authorizationProfileIdSchema).min(1),
  dataProfileRefs: z.array(dataProfileIdSchema).min(1),
  preconditions: z.array(z.string().min(1)).min(1),
  idempotencyProfile: idempotencyProfileSchema,
  executionProfileRef: executionProfileIdSchema,
  reviewRequirement: reviewRequirementSchema,
  sideEffectClass: sideEffectClassSchema,
  status: z.literal("PLANNED_TEST_STUB"),
  featureFlag: z.object({
    key: z.string().regex(/^capability\.hr\.onboarding\.[a-z0-9_.]+\.test\.enabled$/),
    enabled: z.literal(false)
  }).strict(),
  implementationBindingRef: z.null(),
  physicalToolBindingRefs: z.array(z.never()).max(0),
  connectorBindingRefs: z.array(z.never()).max(0),
  owner: z.literal("root")
}).strict();

export const reservedCapabilitySchema = z.object({
  capabilityId: reservedCapabilityIdSchema,
  status: z.literal("RESERVED_NOT_REGISTERED"),
  sideEffectClass: z.enum(["INTERNAL_COMMIT", "OUTBOUND_MESSAGE", "EXPORT", "EXTERNAL_WRITE"]),
  registrationAllowed: z.literal(false)
}).strict();

export const capabilityRegistrySchema = z.object({
  registryVersion: z.literal("1"),
  contractVersion: z.literal("v0.3"),
  baseProfileRef: z.literal("CAP-BASE-SYNTHETIC-V1"),
  status: z.literal("reviewed_planned_test_stubs"),
  capabilities: z.array(capabilityEntrySchema).length(plannedCapabilityIds.length),
  reservedCapabilities: z.array(reservedCapabilitySchema).length(reservedCapabilityIds.length)
}).strict();

export type CapabilityId = z.infer<typeof capabilityIdSchema>;
export type SkillId = z.infer<typeof skillIdSchema>;
export type ReservedCapabilityId = z.infer<typeof reservedCapabilityIdSchema>;
export type PayloadSchemaName = z.infer<typeof payloadSchemaNameSchema>;
export type CapabilityRef = z.infer<typeof capabilityRefSchema>;
export type CapabilityEntry = z.infer<typeof capabilityEntrySchema>;
export type CapabilityRegistry = z.infer<typeof capabilityRegistrySchema>;
export type ResultStatus = z.infer<typeof resultStatusSchema>;
