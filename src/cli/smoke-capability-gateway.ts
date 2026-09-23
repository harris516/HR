import { InMemoryCapabilityGatewayAuditSink } from "../audit/capability-audit.js";
import { resolveCapabilityCandidate } from "../capabilities/candidate-resolver.js";
import { CapabilityGateway, digestCapabilityPayload } from "../capabilities/gateway.js";

const payload = {
  onboardingCaseRef: "case-demo-001",
  fieldSetRef: "field-set-safe"
};
const candidate = resolveCapabilityCandidate("GET_CASE_STATUS");
if (!candidate.resolved) {
  throw new Error(`capability candidate resolution failed: ${candidate.reasonCode}`);
}
const capabilityRef = candidate.capabilityRef;
const requestContext = {
  requestId: "request-gateway-smoke-001",
  tenantId: "tenant-demo-001",
  dataSpaceId: "dataspace-demo-hr",
  activeTeamId: "hr-onboarding-team-demo",
  teamMembershipRef: "membership-demo-team",
  actorType: "user",
  actorId: "hr-user-demo-001",
  authenticationLevel: "test-verified",
  roles: ["onboarding_hr_operations"],
  scopeGrantRefs: ["scope-synthetic-a2"],
  authorityGrantRefs: [],
  channel: "test_harness",
  sessionId: "session-synthetic-001",
  correlationId: "correlation-gateway-smoke-001",
  receivedAt: "2026-09-21T01:59:00.000Z",
  expiresAt: "2030-09-21T02:00:00.000Z",
  dataAccessPurpose: "onboarding_operation",
  environment: "test",
  contextVersion: "2",
  integrityRef: "test-integrity-gateway-smoke",
  synthetic: true
};

const audit = new InMemoryCapabilityGatewayAuditSink();
const gateway = new CapabilityGateway({
  auditSink: audit,
  now: () => new Date("2026-09-21T02:00:00.000Z")
});

const result = gateway.resolve({
  gatewayRequestVersion: "1",
  capabilityRequestId: "capability-request-smoke-001",
  taskId: "task-smoke-001",
  attemptId: "attempt-smoke-001",
  routeDecisionRef: "route-smoke-001",
  requestContext,
  capabilityRef,
  resourceRefs: [{
    resourceType: "OnboardingCase",
    resourceId: "case-demo-001",
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    sensitivity: "SYNTHETIC_INTERNAL"
  }],
  actionClass: "read",
  purpose: "onboarding_operation",
  inputEnvelope: {
    schemaVersion: "1",
    capabilityRequestRef: "capability-request-smoke-001",
    inputPayloadSchemaRef: "CaseRefQueryV1",
    inputPayloadDigest: digestCapabilityPayload(payload),
    payload
  },
  authorizationDecision: {
    decisionId: "authorization-smoke-001",
    result: "allow",
    policyVersion: "authorization-policy-v1",
    grantVersion: "grant-v1",
    enforcementPoint: "capability_gateway",
    capabilityRef,
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    actorId: "hr-user-demo-001",
    actionClass: "read",
    purpose: "onboarding_operation"
  },
  risk: { phc: "PHC_1", prohibition: "NONE" },
  review: { status: "NOT_REQUIRED" },
  createdAt: "2026-09-21T01:59:00.000Z",
  expiresAt: "2030-09-21T02:00:00.000Z"
});

if (
  result.decision !== "DENY" ||
  result.reasonCodes[0] !== "CAPABILITY_NOT_EXECUTABLE" ||
  result.mayInvokeImplementation ||
  result.implementationInvoked ||
  result.externalSideEffect
) {
  throw new Error("capability gateway smoke test did not preserve the S1 all-denied baseline");
}

process.stdout.write(`${JSON.stringify({
  status: "capability_gateway_smoke_passed",
  decision: result.decision,
  reasonCodes: result.reasonCodes,
  auditEventCount: audit.events().length,
  implementationInvoked: result.implementationInvoked,
  externalSideEffect: result.externalSideEffect
}, null, 2)}\n`);
