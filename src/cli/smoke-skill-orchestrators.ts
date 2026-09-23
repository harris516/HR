import { InMemoryCapabilityExecutionAuditSink } from "../audit/capability-execution-audit.js";
import { InMemoryCapabilityGatewayAuditSink } from "../audit/capability-audit.js";
import { InMemorySkillAuditSink } from "../audit/skill-audit.js";
import { CapabilityGateway, digestCapabilityPayload } from "../capabilities/gateway.js";
import { SyntheticCapabilityExecutor } from "../capabilities/implementations/executor.js";
import { SyntheticSkillImplementationRegistry } from "../capabilities/implementations/skill-implementation-registry.js";
import { capabilityRegistry } from "../capabilities/registry.js";
import type { CapabilityId } from "../contracts/capability.js";
import type { RequestContext } from "../contracts/navigation.js";
import { SyntheticSkillOrchestrator } from "../skills/orchestrator.js";
import { skillRegistry } from "../skills/registry.js";

const now = new Date("2026-09-21T02:00:00.000Z");
const requestContext: RequestContext = {
  requestId: "request-s5-smoke",
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
  sessionId: "session-s5-smoke",
  correlationId: "correlation-s5-smoke",
  receivedAt: "2026-09-21T01:59:00.000Z",
  expiresAt: "2030-09-21T02:00:00.000Z",
  dataAccessPurpose: "onboarding_operation",
  environment: "test",
  contextVersion: "2",
  integrityRef: "test-integrity-s5-smoke",
  synthetic: true
};

const taskId = "task-s5-ready-card-smoke";
const attemptId = "attempt-s5-smoke-001";
const routeDecisionRef = "route-s5-ready-card-smoke";

function capabilityRequest(capabilityId: CapabilityId, payload: Record<string, unknown>) {
  const entry = capabilityRegistry.capabilities.find((candidate) => candidate.capabilityId === capabilityId);
  if (entry === undefined) throw new Error(`missing capability: ${capabilityId}`);
  const capabilityRequestId = `s5-smoke:${capabilityId}`;
  const capabilityRef = { capabilityId, capabilityVersion: entry.capabilityVersion };
  return {
    gatewayRequestVersion: "1" as const,
    capabilityRequestId,
    taskId,
    attemptId,
    routeDecisionRef,
    requestContext,
    capabilityRef,
    resourceRefs: [{
      resourceType: "OnboardingCase",
      resourceId: "case-demo-001",
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
      inputPayloadDigest: digestCapabilityPayload(payload),
      payload
    },
    authorizationDecision: {
      decisionId: `authorization-s5-smoke-${capabilityId}`,
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
    review: capabilityId === "hr.onboarding.ready_card.draft"
      ? { status: "SATISFIED" as const, reviewRef: "review-s5-ready-card-smoke" }
      : { status: "NOT_REQUIRED" as const },
    createdAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z"
  };
}

const evaluationRequest = capabilityRequest("hr.onboarding.readiness.evaluate", {
  onboardingCaseRef: "case-demo-001",
  expectedCaseVersion: 7,
  evaluationPurpose: "DAY1_READY_CHECK"
});
const draftRequest = capabilityRequest("hr.onboarding.ready_card.draft", {
  onboardingCaseRef: "case-demo-001",
  expectedCaseVersion: 7,
  readinessEvaluationRef: "evaluation-readiness-001",
  templateRef: "template-ready-card-v1",
  language: "zh-CN",
  fieldSetRef: "field-set-ready-card-minimum"
});

const skillRun = {
  skillRunVersion: "1" as const,
  skillRunId: "skill-run-s5-smoke",
  skillRef: { skillId: "onboarding_delivery_pack" as const, skillVersion: "1.0.0" },
  workflowId: "day1_ready_card_candidate" as const,
  taskId,
  attemptId,
  routeDecisionRef,
  requestContext,
  capabilityRequests: [evaluationRequest, draftRequest],
  createdAt: "2026-09-21T01:59:00.000Z",
  expiresAt: "2030-09-21T02:00:00.000Z"
};

const implementations = new SyntheticSkillImplementationRegistry(capabilityRegistry.capabilities);
const gatewayAudit = new InMemoryCapabilityGatewayAuditSink();
const executionAudit = new InMemoryCapabilityExecutionAuditSink();
const skillAudit = new InMemorySkillAuditSink();
let gatewayId = 0;
let executionId = 0;
let skillId = 0;
const gateway = new CapabilityGateway({
  auditSink: gatewayAudit,
  runtimeStateResolver: implementations.runtimeStateResolver(),
  allowSyntheticTestRuntimeOverrides: true,
  now: () => now,
  idFactory: () => `gateway-s5-smoke-${++gatewayId}`
});
const executor = new SyntheticCapabilityExecutor({
  implementationRegistry: implementations,
  auditSink: executionAudit,
  allowSyntheticTestExecution: true,
  now: () => now,
  idFactory: () => `execution-s5-smoke-${++executionId}`
});
const orchestrator = new SyntheticSkillOrchestrator({
  gateway,
  executor,
  auditSink: skillAudit,
  allowSyntheticTestExecution: true,
  now: () => now,
  idFactory: () => `skill-s5-smoke-${++skillId}`
});
const result = orchestrator.run(skillRun);

const defaultAdmission = new CapabilityGateway({
  auditSink: new InMemoryCapabilityGatewayAuditSink(),
  now: () => now
}).resolve(evaluationRequest);

if (
  result.status !== "COMPLETED" ||
  result.stepResults.length !== 2 ||
  result.implementationCallCount !== 2 ||
  result.externalSideEffect ||
  result.outboundMessageSent ||
  defaultAdmission.decision !== "DENY"
) {
  throw new Error("S5 Skill Orchestrator smoke test failed");
}

console.log(JSON.stringify({
  status: "skill_orchestrator_smoke_passed",
  registeredSkillCount: skillRegistry.length,
  syntheticCapabilityImplementationCount: implementations.registrations().length,
  heroSkillId: result.skillRef.skillId,
  heroWorkflowId: result.workflowId,
  skillStatus: result.status,
  completedStepCount: result.stepResults.filter((step) => step.completed).length,
  independentCapabilityAudit: result.independentCapabilityAudit,
  skillAuditEventCount: skillAudit.events().length,
  gatewayAuditEventCount: gatewayAudit.events().length,
  executionAuditEventCount: executionAudit.events().length,
  formalStateChanged: result.formalStateChanged,
  outboundMessageSent: result.outboundMessageSent,
  externalSideEffect: result.externalSideEffect,
  unsafeToolFallbackCount: result.unsafeToolFallbackCount,
  defaultRuntimeDecision: defaultAdmission.decision,
  defaultRuntimeReasonCodes: defaultAdmission.reasonCodes
}, null, 2));
