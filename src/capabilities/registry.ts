import {
  capabilityEntrySchema,
  capabilityRegistrySchema,
  type CapabilityEntry,
  type CapabilityId,
  type CapabilityRegistry,
  type ReservedCapabilityId
} from "../contracts/capability.js";

type PlannedCapabilityInput = Omit<
  CapabilityEntry,
  | "baseProfileRef"
  | "status"
  | "featureFlag"
  | "implementationBindingRef"
  | "physicalToolBindingRefs"
  | "connectorBindingRefs"
  | "owner"
>;

function plannedCapability(input: PlannedCapabilityInput): CapabilityEntry {
  return capabilityEntrySchema.parse({
    ...input,
    baseProfileRef: "CAP-BASE-SYNTHETIC-V1",
    status: "PLANNED_TEST_STUB",
    featureFlag: {
      key: `capability.${input.capabilityId}.test.enabled`,
      enabled: false
    },
    implementationBindingRef: null,
    physicalToolBindingRefs: [],
    connectorBindingRefs: [],
    owner: "root"
  });
}

const capabilities: CapabilityEntry[] = [
  plannedCapability({
    capabilityId: "hr.onboarding.intake.handoff.read",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_case_intake_pack",
    actionClass: "read",
    automationLevel: "A0_READ",
    allowedPHC: ["PHC_0", "PHC_1"],
    inputSchemaRef: "IntakeHandoffQueryV1",
    outputSchemaRef: "IntakeHandoffResultV1",
    authorizationProfileRefs: ["AUTH-INTAKE-READ-V1"],
    dataProfileRefs: ["DATA-INTAKE-V1"],
    preconditions: ["handoff_ref_valid", "source_policy_active"],
    idempotencyProfile: "QUERY_SOURCE_VERSION",
    executionProfileRef: "EXEC-READ-V1",
    reviewRequirement: "NONE",
    sideEffectClass: "NONE_READ"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.intake.completeness.evaluate",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_case_intake_pack",
    actionClass: "analyze",
    automationLevel: "A1_ANALYZE",
    allowedPHC: ["PHC_1", "PHC_2"],
    inputSchemaRef: "IntakeCompletenessInputV1",
    outputSchemaRef: "IntakeCompletenessResultV1",
    authorizationProfileRefs: ["AUTH-ANALYZE-V1"],
    dataProfileRefs: ["DATA-INTAKE-V1"],
    preconditions: ["complete_snapshot_available", "identity_conflict_absent"],
    idempotencyProfile: "SNAPSHOT_POLICY_VERSION",
    executionProfileRef: "EXEC-ANALYZE-V1",
    reviewRequirement: "CANDIDATE_ONLY",
    sideEffectClass: "NONE_ANALYZE"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.intake.draft",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_case_intake_pack",
    actionClass: "draft",
    automationLevel: "A2_DRAFT",
    allowedPHC: ["PHC_1", "PHC_2"],
    inputSchemaRef: "IntakeDraftInputV1",
    outputSchemaRef: "DraftArtifactResultV1",
    authorizationProfileRefs: ["AUTH-DRAFT-V1"],
    dataProfileRefs: ["DATA-DRAFT-V1", "DATA-INTAKE-V1"],
    preconditions: ["completeness_result_valid", "approved_facts_resolvable"],
    idempotencyProfile: "SUBJECT_DRAFT_INPUT_VERSION",
    executionProfileRef: "EXEC-DRAFT-V1",
    reviewRequirement: "HUMAN_REVIEW_IF_SENSITIVE",
    sideEffectClass: "DRAFT_ONLY"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.case.list",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_status_control_pack",
    actionClass: "read",
    automationLevel: "A0_READ",
    allowedPHC: ["PHC_0", "PHC_1"],
    inputSchemaRef: "CaseCollectionQueryV1",
    outputSchemaRef: "CaseListResultV1",
    authorizationProfileRefs: ["AUTH-CASE-COLLECTION-READ-V1"],
    dataProfileRefs: ["DATA-CASE-V1"],
    preconditions: ["collection_policy_active", "cursor_valid_if_present"],
    idempotencyProfile: "QUERY_GRANT_VERSION",
    executionProfileRef: "EXEC-READ-V1",
    reviewRequirement: "NONE",
    sideEffectClass: "NONE_READ"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.case.status.read",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_status_control_pack",
    actionClass: "read",
    automationLevel: "A0_READ",
    allowedPHC: ["PHC_0", "PHC_1"],
    inputSchemaRef: "CaseRefQueryV1",
    outputSchemaRef: "CaseStatusResultV1",
    authorizationProfileRefs: ["AUTH-CASE-READ-V1"],
    dataProfileRefs: ["DATA-CASE-V1"],
    preconditions: ["case_exists", "expected_version_matches_if_present"],
    idempotencyProfile: "RESOURCE_FIELD_VERSION",
    executionProfileRef: "EXEC-READ-V1",
    reviewRequirement: "NONE",
    sideEffectClass: "NONE_READ"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.requirement.status.read",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_requirement_tracking_pack",
    actionClass: "read",
    automationLevel: "A0_READ",
    allowedPHC: ["PHC_0", "PHC_1"],
    inputSchemaRef: "RequirementStatusQueryV1",
    outputSchemaRef: "RequirementStatusResultV1",
    authorizationProfileRefs: ["AUTH-REQUIREMENT-READ-V1"],
    dataProfileRefs: ["DATA-REQUIREMENT-V1"],
    preconditions: ["case_requirement_scope_valid"],
    idempotencyProfile: "RESOURCE_FIELD_VERSION",
    executionProfileRef: "EXEC-READ-V1",
    reviewRequirement: "NONE",
    sideEffectClass: "NONE_READ"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.requirement.completion.evaluate",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_requirement_tracking_pack",
    actionClass: "analyze",
    automationLevel: "A1_ANALYZE",
    allowedPHC: ["PHC_1", "PHC_2"],
    inputSchemaRef: "RequirementCompletionInputV1",
    outputSchemaRef: "RequirementCompletionResultV1",
    authorizationProfileRefs: ["AUTH-ANALYZE-V1"],
    dataProfileRefs: ["DATA-REQUIREMENT-V1", "DATA-EVIDENCE-V1"],
    preconditions: ["criteria_snapshot_complete", "evidence_snapshot_complete"],
    idempotencyProfile: "SNAPSHOT_POLICY_VERSION",
    executionProfileRef: "EXEC-ANALYZE-V1",
    reviewRequirement: "CANDIDATE_ONLY",
    sideEffectClass: "NONE_ANALYZE"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.risk.list",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_status_control_pack",
    actionClass: "analyze",
    automationLevel: "A1_ANALYZE",
    allowedPHC: ["PHC_1", "PHC_2"],
    inputSchemaRef: "RiskCollectionQueryV1",
    outputSchemaRef: "RiskListResultV1",
    authorizationProfileRefs: ["AUTH-CASE-COLLECTION-READ-V1", "AUTH-ANALYZE-V1"],
    dataProfileRefs: ["DATA-RISK-V1", "DATA-CASE-V1"],
    preconditions: ["risk_policy_active", "snapshot_complete", "cursor_valid_if_present"],
    idempotencyProfile: "TRIGGER_SNAPSHOT_VERSION",
    executionProfileRef: "EXEC-ANALYZE-V1",
    reviewRequirement: "HUMAN_REVIEW_IF_SENSITIVE",
    sideEffectClass: "NONE_ANALYZE"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.source_evidence.inspect",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_status_control_pack",
    actionClass: "read",
    automationLevel: "A0_READ",
    allowedPHC: ["PHC_0", "PHC_1", "PHC_2"],
    inputSchemaRef: "EvidenceInspectionQueryV1",
    outputSchemaRef: "EvidenceInspectionResultV1",
    authorizationProfileRefs: ["AUTH-EVIDENCE-READ-V1"],
    dataProfileRefs: ["DATA-EVIDENCE-V1"],
    preconditions: ["object_scope_valid", "source_policy_active"],
    idempotencyProfile: "OBJECT_OBSERVATION_VERSION",
    executionProfileRef: "EXEC-READ-V1",
    reviewRequirement: "HUMAN_REVIEW_IF_SENSITIVE",
    sideEffectClass: "NONE_READ"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.responsibility.workbox.read",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_coordination_pack",
    actionClass: "read",
    automationLevel: "A0_READ",
    allowedPHC: ["PHC_1"],
    inputSchemaRef: "ResponsibilityWorkboxQueryV1",
    outputSchemaRef: "ResponsibilityWorkboxResultV1",
    authorizationProfileRefs: ["AUTH-WORKBOX-READ-V1"],
    dataProfileRefs: ["DATA-CASE-V1"],
    preconditions: ["responsibility_scope_valid", "deadline_policy_active"],
    idempotencyProfile: "QUERY_GRANT_VERSION",
    executionProfileRef: "EXEC-READ-V1",
    reviewRequirement: "NONE",
    sideEffectClass: "NONE_READ"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.reminder.draft",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_coordination_pack",
    actionClass: "draft",
    automationLevel: "A2_DRAFT",
    allowedPHC: ["PHC_1", "PHC_2"],
    inputSchemaRef: "CoordinationDraftInputV1",
    outputSchemaRef: "DraftArtifactResultV1",
    authorizationProfileRefs: ["AUTH-DRAFT-V1"],
    dataProfileRefs: ["DATA-DRAFT-V1"],
    preconditions: ["missing_items_resolvable", "audience_role_candidate_valid"],
    idempotencyProfile: "CASE_DRAFT_INPUT_VERSION",
    executionProfileRef: "EXEC-DRAFT-V1",
    reviewRequirement: "HUMAN_REVIEW_IF_SENSITIVE",
    sideEffectClass: "DRAFT_ONLY"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.escalation.draft",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_coordination_pack",
    actionClass: "draft",
    automationLevel: "A2_DRAFT",
    allowedPHC: ["PHC_1", "PHC_2", "PHC_3"],
    inputSchemaRef: "CoordinationDraftInputV1",
    outputSchemaRef: "DraftArtifactResultV1",
    authorizationProfileRefs: ["AUTH-DRAFT-V1"],
    dataProfileRefs: ["DATA-DRAFT-V1", "DATA-RISK-V1"],
    preconditions: ["risk_or_exception_candidate_valid"],
    idempotencyProfile: "CASE_DRAFT_INPUT_VERSION",
    executionProfileRef: "EXEC-DRAFT-V1",
    reviewRequirement: "HUMAN_REVIEW_REQUIRED",
    sideEffectClass: "DRAFT_ONLY"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.readiness.evaluate",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_delivery_pack",
    actionClass: "analyze",
    automationLevel: "A1_ANALYZE",
    allowedPHC: ["PHC_1", "PHC_2", "PHC_3"],
    inputSchemaRef: "ReadinessEvaluationInputV1",
    outputSchemaRef: "ReadinessEvaluationResultV1",
    authorizationProfileRefs: ["AUTH-ANALYZE-V1"],
    dataProfileRefs: ["DATA-READY-V1", "DATA-EVIDENCE-V1"],
    preconditions: ["expected_case_version_matches", "authoritative_snapshot_complete"],
    idempotencyProfile: "AUTHORITATIVE_SNAPSHOT_DIGEST",
    executionProfileRef: "EXEC-ANALYZE-V1",
    reviewRequirement: "CANDIDATE_ONLY",
    sideEffectClass: "NONE_ANALYZE"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.readiness.revalidate",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_delivery_pack",
    actionClass: "analyze",
    automationLevel: "A1_ANALYZE",
    allowedPHC: ["PHC_1", "PHC_2", "PHC_3"],
    inputSchemaRef: "ReadinessRevalidationInputV1",
    outputSchemaRef: "ReadinessEvaluationResultV1",
    authorizationProfileRefs: ["AUTH-ANALYZE-V1"],
    dataProfileRefs: ["DATA-READY-V1", "DATA-EVIDENCE-V1"],
    preconditions: ["previous_evaluation_valid", "invalidation_trigger_valid"],
    idempotencyProfile: "TRIGGER_NEW_SNAPSHOT_DIGEST",
    executionProfileRef: "EXEC-ANALYZE-V1",
    reviewRequirement: "CANDIDATE_ONLY",
    sideEffectClass: "NONE_ANALYZE"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.ready_card.draft",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_delivery_pack",
    actionClass: "draft",
    automationLevel: "A2_DRAFT",
    allowedPHC: ["PHC_1", "PHC_2", "PHC_3"],
    inputSchemaRef: "ReadyCardDraftInputV1",
    outputSchemaRef: "DraftArtifactResultV1",
    authorizationProfileRefs: ["AUTH-DRAFT-V1"],
    dataProfileRefs: ["DATA-DRAFT-V1", "DATA-READY-V1"],
    preconditions: ["evaluation_current", "case_version_matches"],
    idempotencyProfile: "CASE_EVALUATION_VERSION",
    executionProfileRef: "EXEC-DRAFT-V1",
    reviewRequirement: "HUMAN_REVIEW_REQUIRED",
    sideEffectClass: "DRAFT_ONLY"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.artifact.list",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_delivery_pack",
    actionClass: "read",
    automationLevel: "A0_READ",
    allowedPHC: ["PHC_0", "PHC_1", "PHC_2"],
    inputSchemaRef: "ArtifactCollectionQueryV1",
    outputSchemaRef: "ArtifactListResultV1",
    authorizationProfileRefs: ["AUTH-ARTIFACT-READ-V1"],
    dataProfileRefs: ["DATA-CASE-V1"],
    preconditions: ["artifact_scope_valid", "version_policy_active"],
    idempotencyProfile: "QUERY_GRANT_VERSION",
    executionProfileRef: "EXEC-READ-V1",
    reviewRequirement: "HUMAN_REVIEW_IF_SENSITIVE",
    sideEffectClass: "NONE_READ"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.audit.timeline.read",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_status_control_pack",
    actionClass: "read",
    automationLevel: "A0_READ",
    allowedPHC: ["PHC_0", "PHC_1", "PHC_2"],
    inputSchemaRef: "AuditTimelineQueryV1",
    outputSchemaRef: "AuditTimelineResultV1",
    authorizationProfileRefs: ["AUTH-AUDIT-READ-V1"],
    dataProfileRefs: ["DATA-AUDIT-V1"],
    preconditions: ["audit_purpose_allowed", "redaction_policy_active"],
    idempotencyProfile: "QUERY_GRANT_VERSION",
    executionProfileRef: "EXEC-READ-V1",
    reviewRequirement: "HUMAN_REVIEW_IF_SENSITIVE",
    sideEffectClass: "NONE_READ"
  }),
  plannedCapability({
    capabilityId: "hr.onboarding.review_request.draft",
    capabilityVersion: "1.0.0",
    skillOwner: "onboarding_coordination_pack",
    actionClass: "draft",
    automationLevel: "A2_DRAFT",
    allowedPHC: ["PHC_2", "PHC_3", "PHC_4"],
    inputSchemaRef: "ReviewDraftInputV1",
    outputSchemaRef: "DraftArtifactResultV1",
    authorizationProfileRefs: ["AUTH-DRAFT-V1"],
    dataProfileRefs: ["DATA-DRAFT-V1", "DATA-EVIDENCE-V1"],
    preconditions: ["phc_candidate_valid", "approved_facts_resolvable"],
    idempotencyProfile: "CASE_DRAFT_INPUT_VERSION",
    executionProfileRef: "EXEC-DRAFT-V1",
    reviewRequirement: "PHC_4_FACTS_ONLY",
    sideEffectClass: "DRAFT_ONLY"
  })
];

function reserved(
  capabilityId: ReservedCapabilityId,
  sideEffectClass: "INTERNAL_COMMIT" | "OUTBOUND_MESSAGE" | "EXPORT" | "EXTERNAL_WRITE"
) {
  return {
    capabilityId,
    status: "RESERVED_NOT_REGISTERED" as const,
    sideEffectClass,
    registrationAllowed: false as const
  };
}

export const capabilityRegistry: CapabilityRegistry = capabilityRegistrySchema.parse({
  registryVersion: "1",
  contractVersion: "v0.3",
  baseProfileRef: "CAP-BASE-SYNTHETIC-V1",
  status: "reviewed_planned_test_stubs",
  capabilities,
  reservedCapabilities: [
    reserved("hr.onboarding.case.intake.create", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.requirement.initialize", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.requirement.complete", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.task.state.update", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.evidence.link.create", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.responsibility.assign", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.deadline.update", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.exception.open", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.review.create", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.review.decision.commit", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.requirement.waiver.commit", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.exception.accept", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.frozen_action.create", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.frozen_action.release", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.ready.confirm", "INTERNAL_COMMIT"),
    reserved("hr.onboarding.notification.send", "OUTBOUND_MESSAGE"),
    reserved("hr.onboarding.artifact.export", "EXPORT")
  ]
});

export function getPlannedCapability(capabilityId: CapabilityId): CapabilityEntry {
  const capability = capabilityRegistry.capabilities.find(
    (entry) => entry.capabilityId === capabilityId
  );
  if (capability === undefined) {
    throw new Error(`capability is not registered: ${capabilityId}`);
  }
  return capability;
}
