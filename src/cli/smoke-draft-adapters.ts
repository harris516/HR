import { InMemoryCapabilityExecutionAuditSink } from "../audit/capability-execution-audit.js";
import { InMemoryCapabilityGatewayAuditSink } from "../audit/capability-audit.js";
import { CapabilityGateway, digestCapabilityPayload } from "../capabilities/gateway.js";
import { SyntheticDraftImplementationRegistry } from "../capabilities/implementations/draft-implementation-registry.js";
import { SyntheticCapabilityExecutor } from "../capabilities/implementations/executor.js";
import { capabilityRegistry } from "../capabilities/registry.js";

const now = new Date("2026-09-21T02:00:00.000Z");
const capabilityRef = {
  capabilityId: "hr.onboarding.reminder.draft",
  capabilityVersion: "1.0.0"
} as const;
const payload = {
  onboardingCaseRef: "case-demo-001",
  draftType: "REMINDER",
  audienceRoleCandidate: "it_onboarding_owner",
  approvedFactRefs: ["fact-equipment-pending-001"],
  missingItemRefs: ["requirement-equipment-001"],
  deadlineRef: "deadline-equipment-001",
  language: "zh-CN",
  templateRef: "template-reminder-v1",
  expectedCaseVersion: 7
};
const request = {
  gatewayRequestVersion: "1",
  capabilityRequestId: "capability-request-s4-smoke",
  taskId: "task-s4-smoke",
  attemptId: "attempt-s4-smoke",
  routeDecisionRef: "route-s4-smoke",
  requestContext: {
    requestId: "request-s4-smoke",
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    activeTeamId: "hr-onboarding-team-demo",
    teamMembershipRef: "membership-demo-team",
    actorType: "user",
    actorId: "hr-user-demo-001",
    authenticationLevel: "test-verified",
    roles: ["onboarding_hr_operations"],
    scopeGrantRefs: ["scope-synthetic-s4"],
    authorityGrantRefs: [],
    channel: "test_harness",
    sessionId: "session-synthetic-s4",
    correlationId: "correlation-s4-smoke",
    receivedAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z",
    dataAccessPurpose: "onboarding_operation",
    environment: "test",
    contextVersion: "2",
    integrityRef: "test-integrity-s4-smoke",
    synthetic: true
  },
  capabilityRef,
  resourceRefs: [{
    resourceType: "OnboardingCase",
    resourceId: "case-demo-001",
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    sensitivity: "SYNTHETIC_INTERNAL"
  }],
  actionClass: "draft",
  purpose: "onboarding_operation",
  inputEnvelope: {
    schemaVersion: "1",
    capabilityRequestRef: "capability-request-s4-smoke",
    inputPayloadSchemaRef: "CoordinationDraftInputV1",
    inputPayloadDigest: digestCapabilityPayload(payload),
    payload
  },
  authorizationDecision: {
    decisionId: "authorization-s4-smoke",
    result: "allow",
    policyVersion: "authorization-policy-v1",
    grantVersion: "grant-synthetic-v1",
    enforcementPoint: "capability_gateway",
    capabilityRef,
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    actorId: "hr-user-demo-001",
    actionClass: "draft",
    purpose: "onboarding_operation"
  },
  risk: { phc: "PHC_1", prohibition: "NONE" },
  review: { status: "NOT_REQUIRED" },
  createdAt: "2026-09-21T01:59:00.000Z",
  expiresAt: "2030-09-21T02:00:00.000Z"
};

const registry = new SyntheticDraftImplementationRegistry(capabilityRegistry.capabilities);
const gateway = new CapabilityGateway({
  auditSink: new InMemoryCapabilityGatewayAuditSink(),
  runtimeStateResolver: registry.runtimeStateResolver(),
  allowSyntheticTestRuntimeOverrides: true,
  now: () => now
});
const executionAudit = new InMemoryCapabilityExecutionAuditSink();
const executor = new SyntheticCapabilityExecutor({
  implementationRegistry: registry,
  auditSink: executionAudit,
  allowSyntheticTestExecution: true,
  now: () => now
});
const admission = gateway.resolve(request);
const outcome = executor.execute(request, admission);
const output = outcome.outputPayload as Record<string, unknown>;

const defaultDecision = new CapabilityGateway({
  auditSink: new InMemoryCapabilityGatewayAuditSink(),
  now: () => now
}).resolve(request);

if (
  admission.decision !== "ALLOW_TO_IMPLEMENTATION" ||
  outcome.envelope.resultStatus !== "SUCCESS" ||
  output.artifactStatus !== "DRAFT" ||
  output.sendStatus !== "NOT_SENT" ||
  output.formalStateChanged !== false ||
  output.externalSideEffect !== false ||
  defaultDecision.decision !== "DENY" ||
  defaultDecision.reasonCodes[0] !== "CAPABILITY_NOT_EXECUTABLE"
) {
  throw new Error("S4 draft smoke test did not preserve the draft-only boundary");
}

process.stdout.write(`${JSON.stringify({
  status: "draft_adapter_smoke_passed",
  syntheticDraftImplementationCount: registry.registrations().length,
  testHarnessAdmission: admission.decision,
  executionStatus: outcome.envelope.resultStatus,
  artifactStatus: output.artifactStatus,
  sendStatus: output.sendStatus,
  formalStateChanged: output.formalStateChanged,
  externalSideEffect: output.externalSideEffect,
  executionAuditEventCount: executionAudit.events().length,
  defaultRuntimeDecision: defaultDecision.decision,
  defaultRuntimeReasonCodes: defaultDecision.reasonCodes
}, null, 2)}\n`);

