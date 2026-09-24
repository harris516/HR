export interface SyntheticCaseRecord {
  synthetic: true;
  tenantId: string;
  dataSpaceId: string;
  authorizedActorIds: string[];
  caseRef: string;
  caseVersion: number;
  displaySubjectRef: string;
  plannedStartDateCandidate: string;
  lifecycleStatus: "active";
  workflowStage: "preparation_in_progress";
  suggestedReadiness: "READY" | "AT_RISK";
  formalReadiness: null;
  confirmationStatus: "pending";
  knowledgeState: "KNOWN";
  sourceRefs: string[];
  freshness: "fresh" | "stale" | "unavailable" | "unknown";
  policyVersionRefs: string[];
}

export interface SyntheticCapabilityStore {
  synthetic: true;
  tenantId: string;
  dataSpaceId: string;
  handoff: {
    handoffRef: string;
    subjectCandidateRefs: string[];
    offerStatus: "accepted";
    plannedStartDateCandidate: string;
    sourceRecordRefs: string[];
    freshnessStatus: "fresh" | "stale" | "unavailable" | "unknown";
    qualityStatus: "valid";
    sourcePolicyVersion: string;
    sourceVersion: string;
  };
  cases: SyntheticCaseRecord[];
  requirements: Array<{
    tenantId: string;
    dataSpaceId: string;
    authorizedActorIds: string[];
    caseRef: string;
    caseVersion: number;
    requirementRef: string;
    requirementVersion: number;
    requirementType: string;
    applicabilityStatus: "applicable";
    formalStatus: "not_started" | "in_progress" | "evidence_pending" | "completed" | "blocked";
    completionCandidateStatus: "COMPLETE_CANDIDATE" | "NOT_COMPLETE" | "INDETERMINATE";
    criteriaVersionRef: string;
    evidenceSetVersionRef: string;
    freshnessStatus: "fresh" | "stale" | "unavailable" | "unknown";
    reasonCodes: string[];
    criteriaResultRefs: string[];
    evidenceValidationRefs: string[];
  }>;
  risks: Array<{
    tenantId: string;
    dataSpaceId: string;
    authorizedActorIds: string[];
    riskRef: string;
    caseRef: string;
    caseVersion: number;
    severity: "high";
    blocking: true;
    effectivePHC: "PHC_2";
    reasonCodes: ["REVIEW_REQUIRED"];
    affectedObjectRefs: string[];
    sourceFreshnessSummary: "fresh" | "stale" | "unavailable" | "unknown";
  }>;
  observations: Array<{
    tenantId: string;
    dataSpaceId: string;
    authorizedActorIds: string[];
    objectRef: string;
    observationRef: string;
    fieldOrPropositionRef: string;
    redactedValue: string;
    sourceRecordRef: string;
    sourceVersion: string;
    observedAt: string;
    freshnessStatus: "fresh" | "stale" | "unavailable" | "unknown";
    qualityStatus: "valid";
    policyVersion: string;
    redactionApplied: true;
  }>;
  evidenceLinks: Array<{
    tenantId: string;
    dataSpaceId: string;
    authorizedActorIds: string[];
    objectRef: string;
    evidenceLinkRef: string;
    evidenceRef: string;
    linkedObjectRef: string;
    evidenceVersion: string;
    validationStatus: "valid";
    authorityStatus: "authoritative";
    effectiveAt: string;
  }>;
  responsibilities: Array<{
    tenantId: string;
    dataSpaceId: string;
    authorizedActorIds: string[];
    responsibilityScopeRef: string;
    taskOrRequirementRef: string;
    caseRef: string;
    ownerRoleRef: string;
    assigneeRef: string;
    deadline: string;
    status: "open";
    nextActionCode: string;
  }>;
  artifacts: Array<{
    tenantId: string;
    dataSpaceId: string;
    authorizedActorIds: string[];
    caseRef: string;
    artifactRef: string;
    artifactVersion: number;
    artifactType: string;
    artifactStatus: "DRAFT";
    createdAt: string;
    sensitivityClass: "SYNTHETIC_INTERNAL";
  }>;
  auditEvents: Array<{
    tenantId: string;
    dataSpaceId: string;
    authorizedActorIds: string[];
    resourceRef: string;
    auditEventRef: string;
    eventType: string;
    actorDisplayRef: string;
    resultStatus: "SUCCESS";
    reasonCodes: string[];
    occurredAt: string;
    policyVersionRefs: string[];
    redactionApplied: true;
  }>;
  policies: {
    intakePolicyRef: string;
    intakePolicyVersion: string;
    riskPolicyRef: string;
    riskPolicyVersion: string;
    readinessRuleSetRef: string;
    readinessRuleSetVersion: string;
    sourcePolicyVersion: string;
    redactionPolicyRef: string;
    redactionPolicyVersion: string;
  };
  draftControls: {
    intakeCompletenessEvaluationRef: string;
    readinessEvaluationRef: string;
    approvedFactRefs: string[];
    sourceEvidenceRefs: string[];
    templateRefs: string[];
    audienceRoleRefs: string[];
    reviewerTypeRefs: string[];
  };
}

const actorId = "hr-user-demo-001";

export const syntheticCapabilityStore: SyntheticCapabilityStore = {
  synthetic: true,
  tenantId: "tenant-demo-001",
  dataSpaceId: "dataspace-demo-hr",
  handoff: {
    handoffRef: "handoff-demo-001",
    subjectCandidateRefs: ["candidate-demo-001"],
    offerStatus: "accepted",
    plannedStartDateCandidate: "2026-10-01T01:00:00.000Z",
    sourceRecordRefs: ["source-record-ats-001"],
    freshnessStatus: "fresh",
    qualityStatus: "valid",
    sourcePolicyVersion: "source-policy-v1",
    sourceVersion: "ats-offer-v3"
  },
  cases: [
    {
      synthetic: true,
      tenantId: "tenant-demo-001",
      dataSpaceId: "dataspace-demo-hr",
      authorizedActorIds: [actorId],
      caseRef: "case-demo-001",
      caseVersion: 7,
      displaySubjectRef: "subject-display-redacted-001",
      plannedStartDateCandidate: "2026-10-01T01:00:00.000Z",
      lifecycleStatus: "active",
      workflowStage: "preparation_in_progress",
      suggestedReadiness: "AT_RISK",
      formalReadiness: null,
      confirmationStatus: "pending",
      knowledgeState: "KNOWN",
      sourceRefs: ["source-record-ats-001", "source-record-itsm-001"],
      freshness: "fresh",
      policyVersionRefs: ["source-policy-v1", "readiness-policy-v1"]
    },
    {
      synthetic: true,
      tenantId: "tenant-demo-001",
      dataSpaceId: "dataspace-demo-hr",
      authorizedActorIds: ["hr-user-other"],
      caseRef: "case-same-tenant-not-authorized",
      caseVersion: 1,
      displaySubjectRef: "subject-display-redacted-002",
      plannedStartDateCandidate: "2026-10-02T01:00:00.000Z",
      lifecycleStatus: "active",
      workflowStage: "preparation_in_progress",
      suggestedReadiness: "AT_RISK",
      formalReadiness: null,
      confirmationStatus: "pending",
      knowledgeState: "KNOWN",
      sourceRefs: ["source-record-ats-002"],
      freshness: "fresh",
      policyVersionRefs: ["source-policy-v1"]
    },
    {
      synthetic: true,
      tenantId: "tenant-other",
      dataSpaceId: "dataspace-other",
      authorizedActorIds: [actorId],
      caseRef: "case-cross-tenant-hidden",
      caseVersion: 1,
      displaySubjectRef: "subject-display-redacted-003",
      plannedStartDateCandidate: "2026-10-03T01:00:00.000Z",
      lifecycleStatus: "active",
      workflowStage: "preparation_in_progress",
      suggestedReadiness: "AT_RISK",
      formalReadiness: null,
      confirmationStatus: "pending",
      knowledgeState: "KNOWN",
      sourceRefs: ["source-record-ats-003"],
      freshness: "fresh",
      policyVersionRefs: ["source-policy-v1"]
    }
  ],
  requirements: [{
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    authorizedActorIds: [actorId],
    caseRef: "case-demo-001",
    caseVersion: 7,
    requirementRef: "requirement-equipment-001",
    requirementVersion: 3,
    requirementType: "equipment",
    applicabilityStatus: "applicable",
    formalStatus: "evidence_pending",
    completionCandidateStatus: "COMPLETE_CANDIDATE",
    criteriaVersionRef: "criteria-equipment-v2",
    evidenceSetVersionRef: "evidence-set-equipment-v4",
    freshnessStatus: "fresh",
    reasonCodes: [],
    criteriaResultRefs: ["criteria-result-equipment-001"],
    evidenceValidationRefs: ["evidence-validation-equipment-001"]
  }],
  risks: [{
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    authorizedActorIds: [actorId],
    riskRef: "risk-equipment-deadline-001",
    caseRef: "case-demo-001",
    caseVersion: 7,
    severity: "high",
    blocking: true,
    effectivePHC: "PHC_2",
    reasonCodes: ["REVIEW_REQUIRED"],
    affectedObjectRefs: ["requirement-equipment-001"],
    sourceFreshnessSummary: "fresh"
  }],
  observations: [{
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    authorizedActorIds: [actorId],
    objectRef: "case-demo-001",
    observationRef: "observation-start-date-001",
    fieldOrPropositionRef: "planned_start_date",
    redactedValue: "2026-10-01",
    sourceRecordRef: "source-record-ats-001",
    sourceVersion: "ats-offer-v3",
    observedAt: "2026-09-21T01:30:00.000Z",
    freshnessStatus: "fresh",
    qualityStatus: "valid",
    policyVersion: "source-policy-v1",
    redactionApplied: true
  }],
  evidenceLinks: [{
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    authorizedActorIds: [actorId],
    objectRef: "case-demo-001",
    evidenceLinkRef: "evidence-link-offer-001",
    evidenceRef: "evidence-offer-001",
    linkedObjectRef: "case-demo-001",
    evidenceVersion: "evidence-offer-v2",
    validationStatus: "valid",
    authorityStatus: "authoritative",
    effectiveAt: "2026-09-20T01:00:00.000Z"
  }],
  responsibilities: [{
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    authorizedActorIds: [actorId],
    responsibilityScopeRef: "workbox-hr-user-demo-001",
    taskOrRequirementRef: "requirement-equipment-001",
    caseRef: "case-demo-001",
    ownerRoleRef: "it_onboarding_owner",
    assigneeRef: "assignee-redacted-it-001",
    deadline: "2026-09-28T09:00:00.000Z",
    status: "open",
    nextActionCode: "FOLLOW_UP_EQUIPMENT"
  }],
  artifacts: [{
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    authorizedActorIds: [actorId],
    caseRef: "case-demo-001",
    artifactRef: "artifact-readiness-draft-001",
    artifactVersion: 2,
    artifactType: "DAY1_READY_CARD",
    artifactStatus: "DRAFT",
    createdAt: "2026-09-21T01:45:00.000Z",
    sensitivityClass: "SYNTHETIC_INTERNAL"
  }],
  auditEvents: [{
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    authorizedActorIds: [actorId],
    resourceRef: "case-demo-001",
    auditEventRef: "audit-case-created-001",
    eventType: "case.synthetic_observed",
    actorDisplayRef: "actor-redacted-hr-001",
    resultStatus: "SUCCESS",
    reasonCodes: [],
    occurredAt: "2026-09-21T01:40:00.000Z",
    policyVersionRefs: ["audit-redaction-policy-v1"],
    redactionApplied: true
  }],
  policies: {
    intakePolicyRef: "intake-policy-001",
    intakePolicyVersion: "intake-policy-v1",
    riskPolicyRef: "risk-policy-001",
    riskPolicyVersion: "risk-policy-v1",
    readinessRuleSetRef: "readiness-rules-001",
    readinessRuleSetVersion: "readiness-rules-v1",
    sourcePolicyVersion: "source-policy-v1",
    redactionPolicyRef: "audit-redaction-policy-001",
    redactionPolicyVersion: "audit-redaction-policy-v1"
  },
  draftControls: {
    intakeCompletenessEvaluationRef: "evaluation-intake-complete-001",
    readinessEvaluationRef: "evaluation-readiness-001",
    approvedFactRefs: [
      "fact-offer-accepted-001",
      "fact-start-date-001",
      "fact-equipment-pending-001"
    ],
    sourceEvidenceRefs: ["evidence-offer-001", "evidence-equipment-001"],
    templateRefs: [
      "template-intake-v1",
      "template-reminder-v1",
      "template-escalation-v1",
      "template-ready-card-v1",
      "template-review-request-v1"
    ],
    audienceRoleRefs: ["it_onboarding_owner", "onboarding_hr_operations"],
    reviewerTypeRefs: ["authorized_hr_reviewer", "professional_practice_reviewer"]
  }
};

/**
 * Produces the adapter view from the canonical SQLite snapshots. Supplementary
 * risk/responsibility/artifact fixtures remain synthetic presentation aids only.
 */
export function createPersistentCapabilityView(
  base: SyntheticCapabilityStore,
  context: { tenantId: string; dataSpaceId: string; actorId: string },
  cases: readonly import("../../mvp/synthetic-business-store.js").SyntheticCaseSnapshot[],
  auditEvents: readonly import("../../mvp/synthetic-case-store.js").SyntheticCaseAuditSnapshot[]
): SyntheticCapabilityStore {
  const store = structuredClone(base) as SyntheticCapabilityStore;
  store.tenantId = context.tenantId;
  store.dataSpaceId = context.dataSpaceId;
  store.cases = cases.map((item) => ({
    synthetic: true,
    tenantId: context.tenantId,
    dataSpaceId: context.dataSpaceId,
    authorizedActorIds: [context.actorId],
    caseRef: item.caseRef,
    caseVersion: item.caseVersion,
    displaySubjectRef: item.candidateDisplayName,
    plannedStartDateCandidate: item.plannedStartAt ?? "not_provided",
    lifecycleStatus: "active",
    workflowStage: "preparation_in_progress",
    suggestedReadiness: item.suggestedReadiness === "READY_CANDIDATE" ? "READY" : "AT_RISK",
    formalReadiness: null,
    confirmationStatus: "pending",
    knowledgeState: "KNOWN",
    sourceRefs: [item.sourceVersionRef],
    freshness: "fresh",
    policyVersionRefs: ["synthetic-mvp-rule-v1"]
  }));
  store.requirements = cases.flatMap((item) => item.requirements.map((requirement) => ({
    tenantId: context.tenantId,
    dataSpaceId: context.dataSpaceId,
    authorizedActorIds: [context.actorId],
    caseRef: item.caseRef,
    caseVersion: item.caseVersion,
    requirementRef: requirement.requirementRef,
    requirementVersion: requirement.version,
    requirementType: requirement.kind,
    applicabilityStatus: "applicable" as const,
    formalStatus: requirement.status,
    completionCandidateStatus: requirement.status === "completed"
      ? "COMPLETE_CANDIDATE" as const
      : "NOT_COMPLETE" as const,
    criteriaVersionRef: requirement.completionCriteriaRef,
    evidenceSetVersionRef: requirement.evidenceRefs[0] ?? "evidence-not-provided",
    freshnessStatus: requirement.freshness,
    reasonCodes: [],
    criteriaResultRefs: requirement.status === "completed" ? ["criteria-satisfied"] : [],
    evidenceValidationRefs: requirement.evidenceValidationRef === null
      ? []
      : [requirement.evidenceValidationRef]
  })));
  const scoped = <T extends { tenantId: string; dataSpaceId: string; authorizedActorIds: string[] }>(
    record: T
  ): T => ({ ...record, tenantId: context.tenantId, dataSpaceId: context.dataSpaceId,
    authorizedActorIds: [context.actorId] });
  store.risks = store.risks.map(scoped).filter((record) => cases.some((item) => item.caseRef === record.caseRef));
  store.observations = store.observations.map(scoped).filter((record) => cases.some((item) => item.caseRef === record.objectRef));
  store.evidenceLinks = store.evidenceLinks.map(scoped).filter((record) => cases.some((item) => item.caseRef === record.objectRef));
  store.responsibilities = store.responsibilities.map((record) => ({
    ...scoped(record), responsibilityScopeRef: `workbox-${context.actorId}`
  })).filter((record) => cases.some((item) => item.caseRef === record.caseRef));
  store.artifacts = store.artifacts.map(scoped).filter((record) => cases.some((item) => item.caseRef === record.caseRef));
  store.auditEvents = auditEvents.map((event) => ({
    tenantId: context.tenantId,
    dataSpaceId: context.dataSpaceId,
    authorizedActorIds: [context.actorId],
    resourceRef: event.caseRef,
    auditEventRef: event.eventRef,
    eventType: event.eventType,
    actorDisplayRef: event.actorId,
    resultStatus: "SUCCESS",
    reasonCodes: [],
    occurredAt: event.occurredAt,
    policyVersionRefs: ["synthetic-audit-v1"],
    redactionApplied: true
  }));
  return store;
}
