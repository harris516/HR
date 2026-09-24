import { describe, expect, it } from "vitest";
import { InMemoryCapabilityExecutionAuditSink } from "../src/audit/capability-execution-audit.js";
import { InMemoryCapabilityGatewayAuditSink } from "../src/audit/capability-audit.js";
import { InMemorySkillAuditSink } from "../src/audit/skill-audit.js";
import { CapabilityGateway, digestCapabilityPayload } from "../src/capabilities/gateway.js";
import { SyntheticCapabilityExecutor } from "../src/capabilities/implementations/executor.js";
import { SyntheticSkillImplementationRegistry } from "../src/capabilities/implementations/skill-implementation-registry.js";
import { capabilityRegistry } from "../src/capabilities/registry.js";
import type { CapabilityEntry, CapabilityId, SkillId } from "../src/contracts/capability.js";
import type { RequestContext } from "../src/contracts/navigation.js";
import type { SkillRunRequest, SkillWorkflowId } from "../src/contracts/skill-orchestration.js";
import { SyntheticSkillOrchestrator } from "../src/skills/orchestrator.js";
import { skillRegistry } from "../src/skills/registry.js";

const fixedNow = new Date("2026-09-21T02:00:00.000Z");
const collectionCapabilityIds = new Set<CapabilityId>([
  "hr.onboarding.case.list",
  "hr.onboarding.risk.list",
  "hr.onboarding.responsibility.workbox.read",
  "hr.onboarding.artifact.list",
  "hr.onboarding.audit.timeline.read"
]);

function context(requestId: string): RequestContext {
  return {
    requestId,
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    activeTeamId: "hr-onboarding-team-demo",
    teamMembershipRef: "membership-demo-team",
    actorType: "user",
    actorId: "hr-user-demo-001",
    authenticationLevel: "test-verified",
    roles: ["onboarding_hr_operations"],
    scopeGrantRefs: ["scope-synthetic-s5"],
    authorityGrantRefs: [],
    channel: "test_harness",
    sessionId: `session-${requestId}`,
    correlationId: `correlation-${requestId}`,
    receivedAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z",
    dataAccessPurpose: "onboarding_operation",
    environment: "test",
    contextVersion: "2",
    integrityRef: `test-integrity-${requestId}`,
    synthetic: true
  };
}

function entryFor(capabilityId: CapabilityId): CapabilityEntry {
  const entry = capabilityRegistry.capabilities.find((candidate) => candidate.capabilityId === capabilityId);
  if (entry === undefined) throw new Error(`missing capability entry: ${capabilityId}`);
  return entry;
}

const capabilityInputs: Record<CapabilityId, Record<string, unknown>> = {
  "hr.onboarding.intake.handoff.read": {
    handoffRef: "handoff-demo-001",
    expectedSourceVersion: "ats-offer-v3",
    fieldSetRef: "field-set-intake-minimum"
  },
  "hr.onboarding.intake.completeness.evaluate": {
    handoffRef: "handoff-demo-001",
    expectedSourceVersion: "ats-offer-v3",
    intakePolicyRef: "intake-policy-001",
    intakePolicyVersion: "intake-policy-v1"
  },
  "hr.onboarding.intake.draft": {
    handoffRef: "handoff-demo-001",
    completenessEvaluationRef: "evaluation-intake-complete-001",
    expectedSourceVersion: "ats-offer-v3",
    approvedFactRefs: ["fact-offer-accepted-001", "fact-start-date-001"],
    language: "zh-CN",
    templateRef: "template-intake-v1"
  },
  "hr.onboarding.case.list": {
    filterSpecRef: "filter-approved",
    pageSize: 20,
    snapshotAt: "2026-09-21T01:59:30.000Z"
  },
  "hr.onboarding.case.status.read": {
    onboardingCaseRef: "case-demo-001",
    expectedCaseVersion: 7,
    fieldSetRef: "field-set-case-status"
  },
  "hr.onboarding.requirement.status.read": {
    onboardingCaseRef: "case-demo-001",
    expectedCaseVersion: 7
  },
  "hr.onboarding.requirement.completion.evaluate": {
    onboardingCaseRef: "case-demo-001",
    requirementRef: "requirement-equipment-001",
    expectedCaseVersion: 7,
    expectedRequirementVersion: 3
  },
  "hr.onboarding.risk.list": {
    caseScopeRef: "case-demo-001",
    riskPolicyRef: "risk-policy-001",
    riskPolicyVersion: "risk-policy-v1",
    snapshotAt: "2026-09-21T01:59:30.000Z",
    pageSize: 20
  },
  "hr.onboarding.source_evidence.inspect": {
    objectRef: "case-demo-001",
    fieldOrPropositionRefs: ["planned_start_date"],
    expectedObjectVersion: 7,
    fieldSetRef: "field-set-evidence-redacted"
  },
  "hr.onboarding.responsibility.workbox.read": {
    responsibilityScopeRef: "workbox-hr-user-demo-001",
    pageSize: 20,
    snapshotAt: "2026-09-21T01:59:30.000Z"
  },
  "hr.onboarding.reminder.draft": {
    onboardingCaseRef: "case-demo-001",
    draftType: "REMINDER",
    audienceRoleCandidate: "it_onboarding_owner",
    approvedFactRefs: ["fact-equipment-pending-001"],
    missingItemRefs: ["requirement-equipment-001"],
    deadlineRef: "deadline-equipment-001",
    language: "zh-CN",
    templateRef: "template-reminder-v1",
    expectedCaseVersion: 7
  },
  "hr.onboarding.escalation.draft": {
    onboardingCaseRef: "case-demo-001",
    draftType: "ESCALATION",
    audienceRoleCandidate: "onboarding_hr_operations",
    approvedFactRefs: ["fact-equipment-pending-001"],
    missingItemRefs: ["requirement-equipment-001"],
    deadlineRef: "deadline-equipment-001",
    language: "zh-CN",
    templateRef: "template-escalation-v1",
    expectedCaseVersion: 7
  },
  "hr.onboarding.readiness.evaluate": {
    onboardingCaseRef: "case-demo-001",
    expectedCaseVersion: 7,
    evaluationPurpose: "DAY1_READY_CHECK"
  },
  "hr.onboarding.readiness.revalidate": {
    onboardingCaseRef: "case-demo-001",
    expectedCaseVersion: 7,
    previousEvaluationRef: "evaluation-previous-001",
    invalidationTriggerRef: "trigger-source-refresh-001",
    causationId: "causation-001",
    deduplicationKey: "dedupe-001"
  },
  "hr.onboarding.ready_card.draft": {
    onboardingCaseRef: "case-demo-001",
    expectedCaseVersion: 7,
    readinessEvaluationRef: "evaluation-readiness-001",
    templateRef: "template-ready-card-v1",
    language: "zh-CN",
    fieldSetRef: "field-set-ready-card-minimum"
  },
  "hr.onboarding.artifact.list": {
    onboardingCaseRef: "case-demo-001",
    pageSize: 20,
    snapshotAt: "2026-09-21T01:59:30.000Z"
  },
  "hr.onboarding.audit.timeline.read": {
    resourceRef: "case-demo-001",
    pageSize: 20,
    redactionPolicyRef: "audit-redaction-policy-001"
  },
  "hr.onboarding.review_request.draft": {
    onboardingCaseRef: "case-demo-001",
    affectedObjectRefs: ["requirement-equipment-001"],
    candidatePHC: "PHC_4",
    prohibitionClass: "AGENT_PROHIBITED",
    approvedFactRefs: ["fact-equipment-pending-001"],
    sourceEvidenceRefs: ["evidence-equipment-001"],
    conflictRefs: [],
    impactScopeRefs: ["day1-readiness"],
    requiredReviewerType: "professional_practice_reviewer",
    expectedCaseVersion: 7,
    templateRef: "template-review-request-v1",
    language: "zh-CN"
  }
};

function capabilityRequest(
  capabilityId: CapabilityId,
  requestContext: RequestContext,
  taskId: string,
  attemptId: string,
  routeDecisionRef: string
) {
  const entry = entryFor(capabilityId);
  const inputPayload = capabilityInputs[capabilityId];
  const capabilityRequestId = `${requestContext.requestId}:${capabilityId}`;
  const capabilityRef = { capabilityId, capabilityVersion: entry.capabilityVersion };
  const collectionAdmission = collectionCapabilityIds.has(capabilityId)
    ? {
        predicateRef: "predicate://synthetic/actor-scope/v1",
        fieldProjectionRef: "projection://synthetic/minimum/v1",
        grantVersion: "grant-synthetic-v1",
        queryDigest: `query-digest-${capabilityId}`,
        sortSpecRef: "sort://synthetic/stable/v1",
        snapshotAt: "2026-09-21T01:59:30.000Z",
        countDisclosureAllowed: false
      }
    : undefined;
  const reviewRequired = [
    "hr.onboarding.escalation.draft",
    "hr.onboarding.ready_card.draft",
    "hr.onboarding.review_request.draft"
  ].includes(capabilityId);
  return {
    gatewayRequestVersion: "1" as const,
    capabilityRequestId,
    taskId,
    attemptId,
    routeDecisionRef,
    requestContext,
    capabilityRef,
    resourceRefs: [{
      resourceType: capabilityId.includes("intake") ? "OfferHandoff" : "OnboardingCase",
      resourceId: capabilityId.includes("intake") ? "handoff-demo-001" : "case-demo-001",
      tenantId: requestContext.tenantId,
      dataSpaceId: requestContext.dataSpaceId,
      sensitivity: "SYNTHETIC_INTERNAL" as const
    }],
    actionClass: entry.actionClass,
    purpose: "onboarding_operation" as const,
    inputEnvelope: {
      schemaVersion: "1" as const,
      capabilityRequestRef: capabilityRequestId,
      inputPayloadSchemaRef: entry.inputSchemaRef,
      inputPayloadDigest: digestCapabilityPayload(inputPayload),
      payload: inputPayload
    },
    authorizationDecision: {
      decisionId: `authorization-${capabilityId}`,
      result: "allow" as const,
      policyVersion: "authorization-policy-v1",
      grantVersion: "grant-synthetic-v1",
      enforcementPoint: "capability_gateway" as const,
      capabilityRef,
      tenantId: requestContext.tenantId,
      dataSpaceId: requestContext.dataSpaceId,
      actorId: requestContext.actorId,
      actionClass: entry.actionClass,
      purpose: "onboarding_operation" as const
    },
    risk: { phc: "PHC_1" as const, prohibition: "NONE" as const },
    review: reviewRequired
      ? { status: "SATISFIED" as const, reviewRef: `review-${capabilityId}` }
      : { status: "NOT_REQUIRED" as const },
    ...(collectionAdmission === undefined ? {} : { collectionAdmission }),
    createdAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z"
  };
}

interface WorkflowFixture {
  skillId: SkillId;
  workflowId: SkillWorkflowId;
  capabilities: CapabilityId[];
}

const heroWorkflows: WorkflowFixture[] = [
  {
    skillId: "onboarding_task_navigation_pack",
    workflowId: "navigation_route_handoff",
    capabilities: []
  },
  {
    skillId: "onboarding_case_intake_pack",
    workflowId: "case_intake_candidate",
    capabilities: [
      "hr.onboarding.intake.handoff.read",
      "hr.onboarding.intake.completeness.evaluate",
      "hr.onboarding.intake.draft"
    ]
  },
  {
    skillId: "onboarding_requirement_tracking_pack",
    workflowId: "requirement_completion_candidate",
    capabilities: [
      "hr.onboarding.requirement.status.read",
      "hr.onboarding.requirement.completion.evaluate"
    ]
  },
  {
    skillId: "onboarding_status_control_pack",
    workflowId: "risk_workbox",
    capabilities: ["hr.onboarding.risk.list"]
  },
  {
    skillId: "onboarding_coordination_pack",
    workflowId: "responsibility_reminder_draft",
    capabilities: [
      "hr.onboarding.responsibility.workbox.read",
      "hr.onboarding.reminder.draft"
    ]
  },
  {
    skillId: "onboarding_delivery_pack",
    workflowId: "day1_ready_card_candidate",
    capabilities: [
      "hr.onboarding.readiness.evaluate",
      "hr.onboarding.ready_card.draft"
    ]
  }
];

function skillRun(fixture: WorkflowFixture): SkillRunRequest {
  const requestContext = context(`request-${fixture.workflowId}`);
  const taskId = `task-${fixture.workflowId}`;
  const attemptId = "attempt-s5-001";
  const routeDecisionRef = `route-${fixture.workflowId}`;
  return {
    skillRunVersion: "1" as const,
    skillRunId: `skill-run-${fixture.workflowId}`,
    skillRef: { skillId: fixture.skillId, skillVersion: "1.0.0" },
    workflowId: fixture.workflowId,
    taskId,
    attemptId,
    routeDecisionRef,
    requestContext,
    capabilityRequests: fixture.capabilities.map((capabilityId) =>
      capabilityRequest(capabilityId, requestContext, taskId, attemptId, routeDecisionRef)
    ),
    createdAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z"
  };
}

function createHarness(skillAuditAvailable = true, defaultGateway = false) {
  const implementationRegistry = new SyntheticSkillImplementationRegistry(capabilityRegistry.capabilities);
  const gatewayAudit = new InMemoryCapabilityGatewayAuditSink();
  const executionAudit = new InMemoryCapabilityExecutionAuditSink();
  const skillAudit = new InMemorySkillAuditSink(skillAuditAvailable);
  let gatewayId = 0;
  let executionId = 0;
  let skillId = 0;
  const gateway = new CapabilityGateway({
    auditSink: gatewayAudit,
    ...(defaultGateway ? {} : {
      runtimeStateResolver: implementationRegistry.runtimeStateResolver(),
      allowSyntheticTestRuntimeOverrides: true
    }),
    now: () => fixedNow,
    idFactory: () => `gateway-s5-${++gatewayId}`
  });
  const executor = new SyntheticCapabilityExecutor({
    implementationRegistry,
    auditSink: executionAudit,
    allowSyntheticTestExecution: true,
    now: () => fixedNow,
    idFactory: () => `execution-s5-${++executionId}`
  });
  const orchestrator = new SyntheticSkillOrchestrator({
    gateway,
    executor,
    auditSink: skillAudit,
    allowSyntheticTestExecution: true,
    now: () => fixedNow,
    idFactory: () => `skill-s5-${++skillId}`
  });
  return { implementationRegistry, gatewayAudit, executionAudit, skillAudit, executor, orchestrator };
}

describe("S5 Skill Registry", () => {
  it("registers six disabled synthetic Skill contracts and covers all 18 capabilities", () => {
    expect(skillRegistry).toHaveLength(6);
    expect(skillRegistry.every((skill) => !skill.featureEnabled && skill.runtimeBindingRef === null)).toBe(true);
    const allowed = new Set(skillRegistry.flatMap((skill) =>
      skill.workflows.flatMap((workflow) => workflow.capabilityRefs.map((item) => item.capabilityId))
    ));
    expect(allowed.size).toBe(18);
    expect(skillRegistry.flatMap((skill) => skill.workflows).every((workflow) =>
      workflow.genericToolFallbackAllowed === false && workflow.stopOnNonSuccess
    )).toBe(true);
  });

  it("combines exactly the 18 S3/S4 synthetic adapters for the S5 harness", () => {
    const registry = new SyntheticSkillImplementationRegistry(capabilityRegistry.capabilities);
    expect(registry.registrations()).toHaveLength(18);
    expect(registry.registrations().every((item) => item.binding.mode === "TEST_STUB")).toBe(true);
  });
});

describe("S5 six Skill Hero workflows", () => {
  it.each(heroWorkflows)("orchestrates $skillId / $workflowId", (fixture) => {
    const { orchestrator, gatewayAudit, executionAudit, skillAudit } = createHarness();
    const result = orchestrator.run(skillRun(fixture));
    expect(result).toMatchObject({
      status: "COMPLETED",
      capabilityRequestCount: fixture.capabilities.length,
      implementationCallCount: fixture.capabilities.length,
      independentCapabilityAudit: true,
      formalStateChanged: false,
      externalSideEffect: false,
      outboundMessageSent: false,
      realCustomerDataProcessed: false,
      unsafeToolFallbackCount: 0,
      domainCompletionClaimed: false
    });
    expect(result.stepResults.every((step) => step.completed)).toBe(true);
    expect(gatewayAudit.events()).toHaveLength(fixture.capabilities.length * 2);
    expect(executionAudit.events()).toHaveLength(fixture.capabilities.length * 2);
    expect(skillAudit.events()[0]?.eventType).toBe("skill_run_ingress");
    expect(skillAudit.events().at(-1)?.eventType).toBe("skill_run_finalized");
    expect(skillAudit.events()[0]).toMatchObject({
      actorId: "hr-user-demo-001",
      activeTeamId: "hr-onboarding-team-demo",
      teamMembershipRef: "membership-demo-team"
    });
    expect(executionAudit.events().every((event) =>
      event.actorId === "hr-user-demo-001" &&
      event.activeTeamId === "hr-onboarding-team-demo" &&
      event.teamMembershipRef === "membership-demo-team"
    )).toBe(true);
    for (const step of result.stepResults) {
      expect(step.gatewayResult.auditRef).toBeTruthy();
      expect(step.executionOutcome?.envelope.auditRef).toBeTruthy();
    }
  });
});

describe("S5 orchestration boundary", () => {
  it("stops at a denied child request without inheriting the previous Allow", () => {
    const fixture = heroWorkflows[2]!;
    const run = skillRun(fixture);
    const denied = run.capabilityRequests[1]!;
    run.capabilityRequests[1] = {
      ...denied,
      authorizationDecision: {
        ...denied.authorizationDecision,
        result: "deny",
        reasonCode: "ACTION_NOT_ALLOWED"
      }
    };
    const { orchestrator, executor, gatewayAudit } = createHarness();
    const result = orchestrator.run(run);
    expect(result.status).toBe("DENIED");
    expect(result.stepResults).toHaveLength(2);
    expect(result.stepResults[0]?.completed).toBe(true);
    expect(result.stepResults[1]?.gatewayResult.decision).toBe("DENY");
    expect(result.implementationCallCount).toBe(1);
    expect(executor.implementationCallCount).toBe(1);
    expect(gatewayAudit.events()).toHaveLength(4);
  });

  it("rejects an unreviewed capability sequence before Gateway invocation", () => {
    const fixture = heroWorkflows[3]!;
    const run = skillRun(fixture);
    run.capabilityRequests = [skillRun(heroWorkflows[5]!).capabilityRequests[0]!];
    const { orchestrator, gatewayAudit, executor } = createHarness();
    const result = orchestrator.run(run);
    expect(result).toMatchObject({ status: "DENIED", reasonCodes: ["ACTION_NOT_ALLOWED"] });
    expect(gatewayAudit.events()).toHaveLength(0);
    expect(executor.implementationCallCount).toBe(0);
  });

  it("rejects Child Capability context drift before any Gateway invocation", () => {
    const fixture = heroWorkflows[2]!;
    const run = skillRun(fixture);
    const second = run.capabilityRequests[1]!;
    run.capabilityRequests[1] = {
      ...second,
      requestContext: {
        ...(second.requestContext as RequestContext),
        actorId: "different-actor"
      }
    };
    const { orchestrator, gatewayAudit, executor } = createHarness();
    const result = orchestrator.run(run);
    expect(result).toMatchObject({
      status: "DENIED",
      reasonCodes: ["REQUEST_CONTEXT_INVALID"],
      capabilityRequestCount: 0,
      implementationCallCount: 0
    });
    expect(gatewayAudit.events()).toHaveLength(0);
    expect(executor.implementationCallCount).toBe(0);
  });

  it("stops when a downstream draft does not reference the actual evaluation", () => {
    const fixture = heroWorkflows[5]!;
    const run = skillRun(fixture);
    const draft = run.capabilityRequests[1]!;
    const draftEnvelope = draft.inputEnvelope as {
      schemaVersion: "1";
      capabilityRequestRef: string;
      inputPayloadSchemaRef: CapabilityEntry["inputSchemaRef"];
      inputPayloadDigest: string;
      payload: Record<string, unknown>;
    };
    const payload = {
      ...draftEnvelope.payload,
      readinessEvaluationRef: "evaluation-not-from-this-run"
    };
    run.capabilityRequests[1] = {
      ...draft,
      inputEnvelope: {
        ...draftEnvelope,
        inputPayloadDigest: digestCapabilityPayload(payload),
        payload
      }
    };
    const { orchestrator, gatewayAudit, executor } = createHarness();
    const result = orchestrator.run(run);
    expect(result).toMatchObject({ status: "FAILED", reasonCodes: ["CAPABILITY_INPUT_INVALID"] });
    expect(result.stepResults).toHaveLength(1);
    expect(gatewayAudit.events()).toHaveLength(2);
    expect(executor.implementationCallCount).toBe(1);
  });

  it("creates only a Practice Handoff candidate and invokes no capability", () => {
    const fixture: WorkflowFixture = {
      skillId: "onboarding_coordination_pack",
      workflowId: "practice_review_draft",
      capabilities: []
    };
    const run = {
      ...skillRun(fixture),
      practiceHandoffSignal: {
        practiceCandidateId: "practice-candidate-001",
        caseRef: "case-demo-001",
        affectedObjectRefs: ["requirement-equipment-001"],
        candidatePHC: "PHC_3" as const,
        prohibitionClass: "NONE" as const,
        factRefs: ["fact-equipment-pending-001"],
        sourceEvidenceVersionRefs: ["evidence-equipment-001@v1"],
        conflictRefs: ["conflict-start-date-001"],
        frozenActionCandidates: ["formal-ready-confirm"],
        requiredReviewerType: "professional_practice_reviewer",
        reasonCodes: ["REVIEW_REQUIRED" as const]
      }
    };
    const { orchestrator, gatewayAudit, executionAudit, skillAudit } = createHarness();
    const result = orchestrator.run(run);
    expect(result).toMatchObject({
      status: "PRACTICE_HANDOFF",
      capabilityRequestCount: 0,
      implementationCallCount: 0,
      practiceHandoff: {
        handoffStatus: "CANDIDATE_ONLY",
        formalReviewCreated: false,
        professionalDecisionMade: false
      }
    });
    expect(gatewayAudit.events()).toHaveLength(0);
    expect(executionAudit.events()).toHaveLength(0);
    expect(skillAudit.events().map((event) => event.eventType)).toEqual([
      "skill_run_ingress",
      "skill_practice_handoff",
      "skill_run_finalized"
    ]);
  });

  it("fails closed before Gateway when the Skill audit is unavailable", () => {
    const run = skillRun(heroWorkflows[1]!);
    const { orchestrator, gatewayAudit, executor } = createHarness(false);
    const result = orchestrator.run(run);
    expect(result).toMatchObject({ status: "FAILED", reasonCodes: ["AUDIT_UNAVAILABLE"] });
    expect(gatewayAudit.events()).toHaveLength(0);
    expect(executor.implementationCallCount).toBe(0);
  });

  it("keeps the default runtime denied even when the S5 orchestrator exists", () => {
    const run = skillRun(heroWorkflows[3]!);
    const { orchestrator, executor } = createHarness(true, true);
    const result = orchestrator.run(run);
    expect(result).toMatchObject({
      status: "DENIED",
      reasonCodes: ["CAPABILITY_NOT_EXECUTABLE"],
      implementationCallCount: 0,
      externalSideEffect: false,
      unsafeToolFallbackCount: 0
    });
    expect(executor.implementationCallCount).toBe(0);
  });
});
