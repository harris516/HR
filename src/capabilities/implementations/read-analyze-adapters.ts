import type { CapabilityId } from "../../contracts/capability.js";
import type {
  SyntheticAdapterContext,
  SyntheticAdapterResult,
  SyntheticCapabilityAdapter
} from "./types.js";
import { SyntheticAdapterError } from "./types.js";

function assertStoreBoundary(context: SyntheticAdapterContext): void {
  if (
    !context.store.synthetic ||
    context.store.tenantId !== context.requestContext.tenantId ||
    context.store.dataSpaceId !== context.requestContext.dataSpaceId
  ) {
    throw new SyntheticAdapterError("FAILED", "SOURCE_UNAVAILABLE");
  }
}

function isVisible(
  record: { tenantId: string; dataSpaceId: string; authorizedActorIds: string[] },
  context: SyntheticAdapterContext
): boolean {
  return record.tenantId === context.requestContext.tenantId &&
    record.dataSpaceId === context.requestContext.dataSpaceId &&
    record.authorizedActorIds.includes(context.requestContext.actorId);
}

function findCase(context: SyntheticAdapterContext, caseRef: string) {
  const record = context.store.cases.find(
    (candidate) => candidate.caseRef === caseRef && isVisible(candidate, context)
  );
  if (record === undefined) {
    throw new SyntheticAdapterError("WAITING", "SOURCE_UNAVAILABLE");
  }
  return record;
}

function assertVersion(actual: number, expected: unknown): void {
  if (expected !== undefined && expected !== actual) {
    throw new SyntheticAdapterError("FAILED", "OBJECT_VERSION_CONFLICT");
  }
}

function success(
  outputPayload: unknown,
  metadata: Omit<SyntheticAdapterResult, "resultStatus" | "outputPayload" | "reasonCodes">,
  reasonCodes: SyntheticAdapterResult["reasonCodes"] = []
): SyntheticAdapterResult {
  return {
    resultStatus: "SUCCESS",
    outputPayload,
    reasonCodes,
    ...metadata
  };
}

const intakeHandoffRead: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    handoffRef: string;
    expectedSourceVersion?: string;
  };
  const handoff = context.store.handoff;
  if (input.handoffRef !== handoff.handoffRef) {
    throw new SyntheticAdapterError("WAITING", "SOURCE_UNAVAILABLE");
  }
  if (handoff.freshnessStatus === "unavailable") {
    throw new SyntheticAdapterError("WAITING", "SOURCE_UNAVAILABLE");
  }
  if (handoff.freshnessStatus !== "fresh") {
    throw new SyntheticAdapterError("WAITING", "SOURCE_STALE");
  }
  if (input.expectedSourceVersion !== undefined && input.expectedSourceVersion !== handoff.sourceVersion) {
    throw new SyntheticAdapterError("FAILED", "OBJECT_VERSION_CONFLICT");
  }
  return success(
    { ...handoff },
    {
      sourceReferences: handoff.sourceRecordRefs,
      freshnessResults: [handoff.freshnessStatus],
      policyVersionRefs: [handoff.sourcePolicyVersion],
      objectVersionRefs: [handoff.sourceVersion]
    }
  );
};

const intakeCompletenessEvaluate: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    handoffRef: string;
    expectedSourceVersion: string;
    intakePolicyRef: string;
    intakePolicyVersion: string;
  };
  const handoff = context.store.handoff;
  if (input.handoffRef !== handoff.handoffRef || input.expectedSourceVersion !== handoff.sourceVersion) {
    throw new SyntheticAdapterError("FAILED", "OBJECT_VERSION_CONFLICT");
  }
  if (
    input.intakePolicyRef !== context.store.policies.intakePolicyRef ||
    input.intakePolicyVersion !== context.store.policies.intakePolicyVersion
  ) {
    throw new SyntheticAdapterError("INDETERMINATE", "SOURCE_POLICY_MISSING");
  }
  return success(
    {
      evaluationRef: context.store.draftControls.intakeCompletenessEvaluationRef,
      result: "COMPLETE_CANDIDATE",
      missingFieldCodes: [],
      conflictRefs: [],
      identityResolutionStatus: "unique",
      policyRef: input.intakePolicyRef,
      policyVersion: input.intakePolicyVersion,
      inputSnapshotDigest: "snapshot-digest-handoff-demo-v3"
    },
    {
      sourceReferences: handoff.sourceRecordRefs,
      freshnessResults: [handoff.freshnessStatus],
      policyVersionRefs: [input.intakePolicyVersion, handoff.sourcePolicyVersion],
      objectVersionRefs: [handoff.sourceVersion],
      inputSnapshotRef: "snapshot-handoff-demo-v3"
    }
  );
};

const caseList: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    pageSize: number;
    statusFilters?: Array<{ dimension: string; values: string[] }>;
  };
  const admission = context.request.collectionAdmission;
  if (admission === undefined) {
    throw new SyntheticAdapterError("FAILED", "CAPABILITY_INPUT_INVALID");
  }
  let records = context.store.cases.filter((record) => isVisible(record, context));
  for (const filter of input.statusFilters ?? []) {
    records = records.filter((record) => {
      if (filter.dimension === "LIFECYCLE") return filter.values.includes(record.lifecycleStatus);
      if (filter.dimension === "SUGGESTED_READINESS") return filter.values.includes(record.suggestedReadiness);
      if (filter.dimension === "FORMAL_READINESS") return record.formalReadiness !== null && filter.values.includes(record.formalReadiness);
      if (filter.dimension === "CONFIRMATION") return filter.values.includes(record.confirmationStatus);
      if (filter.dimension === "WORKFLOW") return filter.values.includes(record.workflowStage);
      return false;
    });
  }
  const visible = records.slice(0, input.pageSize);
  const items = visible.map((record) => ({
    caseRef: record.caseRef,
    caseVersion: record.caseVersion,
    displaySubjectRef: record.displaySubjectRef,
    ...(record.plannedStartDateCandidate === undefined ? {} : {
      plannedStartDateCandidate: record.plannedStartDateCandidate
    }),
    lifecycleStatus: record.lifecycleStatus,
    suggestedReadiness: record.suggestedReadiness,
    formalReadiness: record.formalReadiness,
    riskSummaryCodes: context.store.risks
      .filter((risk) => risk.caseRef === record.caseRef && isVisible(risk, context))
      .flatMap((risk) => risk.reasonCodes),
    sourceFreshnessSummary: record.freshness,
    fieldProjectionRef: admission.fieldProjectionRef
  }));
  return success(
    {
      items,
      ...(admission.countDisclosureAllowed ? { authorizedResultCount: records.length } : {}),
      snapshotAt: admission.snapshotAt,
      sortSpecRef: admission.sortSpecRef,
      fieldProjectionRef: admission.fieldProjectionRef
    },
    {
      sourceReferences: visible.flatMap((record) => record.sourceRefs),
      freshnessResults: visible.map((record) => record.freshness),
      policyVersionRefs: [...new Set(visible.flatMap((record) => record.policyVersionRefs))],
      objectVersionRefs: visible.map((record) => `${record.caseRef}@${record.caseVersion}`),
      inputSnapshotRef: admission.snapshotAt
    }
  );
};

const caseStatusRead: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as { onboardingCaseRef: string; expectedCaseVersion?: number };
  const record = findCase(context, input.onboardingCaseRef);
  assertVersion(record.caseVersion, input.expectedCaseVersion);
  return success(
    {
      caseRef: record.caseRef,
      caseVersion: record.caseVersion,
      lifecycleStatus: record.lifecycleStatus,
      workflowStage: record.workflowStage,
      suggestedReadiness: record.suggestedReadiness,
      formalReadiness: record.formalReadiness,
      confirmationStatus: record.confirmationStatus,
      knowledgeState: record.knowledgeState,
      sourceRefs: record.sourceRefs,
      freshness: record.freshness,
      policyVersionRefs: record.policyVersionRefs
    },
    {
      sourceReferences: record.sourceRefs,
      freshnessResults: [record.freshness],
      policyVersionRefs: record.policyVersionRefs,
      objectVersionRefs: [`${record.caseRef}@${record.caseVersion}`]
    }
  );
};

const requirementStatusRead: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    onboardingCaseRef: string;
    requirementRef?: string;
    requirementTypeFilter?: string;
    expectedCaseVersion?: number;
  };
  const record = findCase(context, input.onboardingCaseRef);
  assertVersion(record.caseVersion, input.expectedCaseVersion);
  const requirements = context.store.requirements.filter((requirement) =>
    requirement.caseRef === record.caseRef &&
    isVisible(requirement, context) &&
    (input.requirementRef === undefined || requirement.requirementRef === input.requirementRef) &&
    (input.requirementTypeFilter === undefined || requirement.requirementType === input.requirementTypeFilter)
  );
  return success(
    {
      caseRef: record.caseRef,
      caseVersion: record.caseVersion,
      requirements: requirements.map((requirement) => ({
        requirementRef: requirement.requirementRef,
        requirementVersion: requirement.requirementVersion,
        requirementType: requirement.requirementType,
        applicabilityStatus: requirement.applicabilityStatus,
        formalStatus: requirement.formalStatus,
        completionCandidateStatus: requirement.completionCandidateStatus,
        criteriaVersionRef: requirement.criteriaVersionRef,
        evidenceSetVersionRef: requirement.evidenceSetVersionRef,
        freshnessStatus: requirement.freshnessStatus,
        reasonCodes: requirement.reasonCodes
      })),
      criteriaVersionRefs: requirements.map((requirement) => requirement.criteriaVersionRef),
      evidenceSetVersionRefs: requirements.map((requirement) => requirement.evidenceSetVersionRef),
      sourceRefs: record.sourceRefs,
      freshness: record.freshness,
      reasonCodes: []
    },
    {
      sourceReferences: record.sourceRefs,
      freshnessResults: [record.freshness, ...requirements.map((requirement) => requirement.freshnessStatus)],
      policyVersionRefs: record.policyVersionRefs,
      objectVersionRefs: [
        `${record.caseRef}@${record.caseVersion}`,
        ...requirements.map((requirement) => `${requirement.requirementRef}@${requirement.requirementVersion}`)
      ]
    }
  );
};

const requirementCompletionEvaluate: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    onboardingCaseRef: string;
    requirementRef: string;
    expectedCaseVersion: number;
    expectedRequirementVersion: number;
  };
  const record = findCase(context, input.onboardingCaseRef);
  assertVersion(record.caseVersion, input.expectedCaseVersion);
  const requirement = context.store.requirements.find((candidate) =>
    candidate.requirementRef === input.requirementRef && candidate.caseRef === record.caseRef && isVisible(candidate, context)
  );
  if (requirement === undefined) {
    throw new SyntheticAdapterError("WAITING", "SOURCE_UNAVAILABLE");
  }
  assertVersion(requirement.requirementVersion, input.expectedRequirementVersion);
  return success(
    {
      evaluationRef: context.idFactory(),
      result: requirement.completionCandidateStatus,
      criteriaResultRefs: requirement.criteriaResultRefs,
      evidenceValidationRefs: requirement.evidenceValidationRefs,
      blockingRefs: [],
      inputSnapshotDigest: "snapshot-digest-requirement-equipment-v3",
      formalStatusChanged: false
    },
    {
      sourceReferences: record.sourceRefs,
      freshnessResults: [requirement.freshnessStatus],
      policyVersionRefs: [requirement.criteriaVersionRef],
      objectVersionRefs: [
        `${record.caseRef}@${record.caseVersion}`,
        `${requirement.requirementRef}@${requirement.requirementVersion}`
      ],
      inputSnapshotRef: requirement.evidenceSetVersionRef
    }
  );
};

const riskList: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    caseScopeRef: string;
    riskPolicyRef: string;
    riskPolicyVersion: string;
    snapshotAt: string;
    severityFilters?: string[];
    blockingFilters?: boolean[];
    pageSize: number;
  };
  const admission = context.request.collectionAdmission;
  if (
    admission === undefined ||
    input.riskPolicyRef !== context.store.policies.riskPolicyRef ||
    input.riskPolicyVersion !== context.store.policies.riskPolicyVersion
  ) {
    throw new SyntheticAdapterError("INDETERMINATE", "SOURCE_POLICY_MISSING");
  }
  const risks = context.store.risks.filter((risk) =>
    risk.caseRef === input.caseScopeRef &&
    isVisible(risk, context) &&
    (input.severityFilters === undefined || input.severityFilters.includes(risk.severity)) &&
    (input.blockingFilters === undefined || input.blockingFilters.includes(risk.blocking))
  ).slice(0, input.pageSize);
  return success(
    {
      items: risks.map((risk) => ({
        riskRef: risk.riskRef,
        caseRef: risk.caseRef,
        caseVersion: risk.caseVersion,
        severity: risk.severity,
        blocking: risk.blocking,
        effectivePHC: risk.effectivePHC,
        reasonCodes: risk.reasonCodes,
        affectedObjectRefs: risk.affectedObjectRefs,
        sourceFreshnessSummary: risk.sourceFreshnessSummary,
        fieldProjectionRef: admission.fieldProjectionRef
      })),
      snapshotAt: input.snapshotAt,
      policyRef: input.riskPolicyRef,
      policyVersion: input.riskPolicyVersion,
      sourceRefs: ["source-record-itsm-001"],
      freshness: "fresh",
      reasonCodes: risks.flatMap((risk) => risk.reasonCodes)
    },
    {
      sourceReferences: ["source-record-itsm-001"],
      freshnessResults: risks.map((risk) => risk.sourceFreshnessSummary),
      policyVersionRefs: [input.riskPolicyVersion],
      objectVersionRefs: risks.map((risk) => `${risk.riskRef}@${risk.caseVersion}`),
      inputSnapshotRef: input.snapshotAt
    }
  );
};

const sourceEvidenceInspect: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    objectRef: string;
    fieldOrPropositionRefs: string[];
    expectedObjectVersion?: number;
  };
  const record = findCase(context, input.objectRef);
  assertVersion(record.caseVersion, input.expectedObjectVersion);
  const observations = context.store.observations.filter((observation) =>
    observation.objectRef === input.objectRef &&
    input.fieldOrPropositionRefs.includes(observation.fieldOrPropositionRef) &&
    isVisible(observation, context)
  );
  const evidenceLinks = context.store.evidenceLinks.filter((link) =>
    link.objectRef === input.objectRef && isVisible(link, context)
  );
  return success(
    {
      objectRef: input.objectRef,
      observations: observations.map(({ tenantId: _tenantId, dataSpaceId: _dataSpaceId, authorizedActorIds: _actors, objectRef: _objectRef, ...observation }) => observation),
      evidenceLinks: evidenceLinks.map(({ tenantId: _tenantId, dataSpaceId: _dataSpaceId, authorizedActorIds: _actors, objectRef: _objectRef, ...link }) => link),
      authorityStatus: "authoritative",
      provenanceStatus: "complete",
      freshnessStatus: "fresh",
      qualityStatus: "valid",
      conflictRefs: [],
      policyVersionRefs: [context.store.policies.sourcePolicyVersion]
    },
    {
      sourceReferences: observations.map((observation) => observation.sourceRecordRef),
      freshnessResults: observations.map((observation) => observation.freshnessStatus),
      policyVersionRefs: [context.store.policies.sourcePolicyVersion],
      objectVersionRefs: [`${record.caseRef}@${record.caseVersion}`, ...evidenceLinks.map((link) => link.evidenceVersion)]
    }
  );
};

const responsibilityWorkboxRead: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    responsibilityScopeRef: string;
    statusFilters?: string[];
    pageSize: number;
  };
  const admission = context.request.collectionAdmission;
  if (admission === undefined) {
    throw new SyntheticAdapterError("FAILED", "CAPABILITY_INPUT_INVALID");
  }
  const records = context.store.responsibilities.filter((record) =>
    record.responsibilityScopeRef === input.responsibilityScopeRef &&
    isVisible(record, context) &&
    (input.statusFilters === undefined || input.statusFilters.includes(record.status))
  ).slice(0, input.pageSize);
  return success(
    {
      items: records.map((record) => ({
        taskOrRequirementRef: record.taskOrRequirementRef,
        caseRef: record.caseRef,
        ownerRoleRef: record.ownerRoleRef,
        assigneeRef: record.assigneeRef,
        deadline: record.deadline,
        status: record.status,
        nextActionCode: record.nextActionCode,
        fieldProjectionRef: admission.fieldProjectionRef
      })),
      snapshotAt: admission.snapshotAt,
      fieldProjectionRef: admission.fieldProjectionRef
    },
    {
      sourceReferences: ["source-record-responsibility-001"],
      freshnessResults: ["fresh"],
      policyVersionRefs: ["responsibility-policy-v1"],
      objectVersionRefs: records.map((record) => record.taskOrRequirementRef),
      inputSnapshotRef: admission.snapshotAt
    }
  );
};

function readinessResult(context: SyntheticAdapterContext, revalidation: boolean): SyntheticAdapterResult {
  const input = context.input as { onboardingCaseRef: string; expectedCaseVersion: number };
  const record = findCase(context, input.onboardingCaseRef);
  assertVersion(record.caseVersion, input.expectedCaseVersion);
  const requirements = context.store.requirements.filter((requirement) =>
    requirement.caseRef === record.caseRef && isVisible(requirement, context)
  );
  const risks = context.store.risks.filter((risk) => risk.caseRef === record.caseRef && isVisible(risk, context));
  if (context.store.policies.sourcePolicyVersion.length === 0) {
    throw new SyntheticAdapterError("INDETERMINATE", "SOURCE_POLICY_MISSING");
  }
  if (
    record.freshness !== "fresh" ||
    requirements.some((requirement) => requirement.freshnessStatus !== "fresh") ||
    risks.some((risk) => risk.sourceFreshnessSummary !== "fresh")
  ) {
    throw new SyntheticAdapterError("INDETERMINATE", "SOURCE_STALE");
  }
  const blockingRequirementRefs = requirements
    .filter((requirement) => requirement.formalStatus !== "completed")
    .map((requirement) => requirement.requirementRef);
  const result = blockingRequirementRefs.length > 0 || risks.some((risk) => risk.blocking)
    ? "NOT_ELIGIBLE"
    : "ELIGIBLE";
  return success(
    {
      evaluationId: revalidation
        ? "evaluation-readiness-revalidation-001"
        : context.store.draftControls.readinessEvaluationRef,
      caseRef: record.caseRef,
      caseVersion: record.caseVersion,
      authoritativeSnapshotRef: revalidation
        ? "authoritative-snapshot-case-demo-001-revalidation-v8"
        : "authoritative-snapshot-case-demo-001-v7",
      authoritativeSnapshotDigest: revalidation
        ? "snapshot-digest-case-demo-001-revalidation-v8"
        : "snapshot-digest-case-demo-001-v7",
      ruleSetRef: context.store.policies.readinessRuleSetRef,
      ruleSetVersion: context.store.policies.readinessRuleSetVersion,
      result,
      blockingRequirementRefs,
      unknownRefs: [],
      conflictRefs: [],
      reviewRequiredRefs: risks.filter((risk) => risk.effectivePHC === "PHC_2").map((risk) => risk.riskRef),
      reasonCodes: risks.flatMap((risk) => risk.reasonCodes),
      evaluatedAt: context.now.toISOString(),
      formalReadinessChanged: false
    },
    {
      sourceReferences: record.sourceRefs,
      freshnessResults: [record.freshness, ...requirements.map((requirement) => requirement.freshnessStatus)],
      policyVersionRefs: [context.store.policies.readinessRuleSetVersion, ...record.policyVersionRefs],
      objectVersionRefs: [
        `${record.caseRef}@${record.caseVersion}`,
        ...requirements.map((requirement) => `${requirement.requirementRef}@${requirement.requirementVersion}`)
      ],
      inputSnapshotRef: revalidation
        ? "authoritative-snapshot-case-demo-001-revalidation-v8"
        : "authoritative-snapshot-case-demo-001-v7"
    }
  );
}

const readinessEvaluate: SyntheticCapabilityAdapter = (context) => readinessResult(context, false);
const readinessRevalidate: SyntheticCapabilityAdapter = (context) => readinessResult(context, true);

const artifactList: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    onboardingCaseRef: string;
    artifactTypeFilters?: string[];
    statusFilters?: string[];
    pageSize: number;
  };
  findCase(context, input.onboardingCaseRef);
  const admission = context.request.collectionAdmission;
  if (admission === undefined) {
    throw new SyntheticAdapterError("FAILED", "CAPABILITY_INPUT_INVALID");
  }
  const records = context.store.artifacts.filter((record) =>
    record.caseRef === input.onboardingCaseRef &&
    isVisible(record, context) &&
    (input.artifactTypeFilters === undefined || input.artifactTypeFilters.includes(record.artifactType)) &&
    (input.statusFilters === undefined || input.statusFilters.includes(record.artifactStatus))
  ).slice(0, input.pageSize);
  return success(
    {
      items: records.map((record) => ({
        artifactRef: record.artifactRef,
        artifactVersion: record.artifactVersion,
        artifactType: record.artifactType,
        artifactStatus: record.artifactStatus,
        createdAt: record.createdAt,
        sensitivityClass: record.sensitivityClass,
        fieldProjectionRef: admission.fieldProjectionRef
      })),
      snapshotAt: admission.snapshotAt,
      fieldProjectionRef: admission.fieldProjectionRef
    },
    {
      sourceReferences: records.map((record) => record.artifactRef),
      freshnessResults: ["not_applicable"],
      policyVersionRefs: ["artifact-policy-v1"],
      objectVersionRefs: records.map((record) => `${record.artifactRef}@${record.artifactVersion}`),
      inputSnapshotRef: admission.snapshotAt
    }
  );
};

const auditTimelineRead: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    resourceRef: string;
    eventTypeFilters?: string[];
    timeRange?: { from?: string; to?: string };
    pageSize: number;
    redactionPolicyRef: string;
  };
  const admission = context.request.collectionAdmission;
  if (
    admission === undefined ||
    input.redactionPolicyRef !== context.store.policies.redactionPolicyRef
  ) {
    throw new SyntheticAdapterError("INDETERMINATE", "SOURCE_POLICY_MISSING");
  }
  const records = context.store.auditEvents.filter((record) =>
    record.resourceRef === input.resourceRef &&
    isVisible(record, context) &&
    (input.eventTypeFilters === undefined || input.eventTypeFilters.includes(record.eventType)) &&
    (input.timeRange?.from === undefined || record.occurredAt >= input.timeRange.from) &&
    (input.timeRange?.to === undefined || record.occurredAt <= input.timeRange.to)
  ).slice(0, input.pageSize);
  return success(
    {
      items: records.map((record) => ({
        auditEventRef: record.auditEventRef,
        eventType: record.eventType,
        resourceRef: record.resourceRef,
        actorDisplayRef: record.actorDisplayRef,
        resultStatus: record.resultStatus,
        reasonCodes: record.reasonCodes,
        occurredAt: record.occurredAt,
        policyVersionRefs: record.policyVersionRefs,
        redactionApplied: record.redactionApplied
      })),
      snapshotAt: admission.snapshotAt,
      redactionPolicyRef: input.redactionPolicyRef,
      redactionPolicyVersion: context.store.policies.redactionPolicyVersion
    },
    {
      sourceReferences: records.map((record) => record.auditEventRef),
      freshnessResults: ["not_applicable"],
      policyVersionRefs: [context.store.policies.redactionPolicyVersion],
      objectVersionRefs: records.map((record) => record.auditEventRef),
      inputSnapshotRef: admission.snapshotAt
    }
  );
};

export const syntheticReadAnalyzeAdapters: ReadonlyMap<CapabilityId, SyntheticCapabilityAdapter> = new Map([
  ["hr.onboarding.intake.handoff.read", intakeHandoffRead],
  ["hr.onboarding.intake.completeness.evaluate", intakeCompletenessEvaluate],
  ["hr.onboarding.case.list", caseList],
  ["hr.onboarding.case.status.read", caseStatusRead],
  ["hr.onboarding.requirement.status.read", requirementStatusRead],
  ["hr.onboarding.requirement.completion.evaluate", requirementCompletionEvaluate],
  ["hr.onboarding.risk.list", riskList],
  ["hr.onboarding.source_evidence.inspect", sourceEvidenceInspect],
  ["hr.onboarding.responsibility.workbox.read", responsibilityWorkboxRead],
  ["hr.onboarding.readiness.evaluate", readinessEvaluate],
  ["hr.onboarding.readiness.revalidate", readinessRevalidate],
  ["hr.onboarding.artifact.list", artifactList],
  ["hr.onboarding.audit.timeline.read", auditTimelineRead]
]);
