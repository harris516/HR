import { InMemoryCapabilityExecutionAuditSink } from "../audit/capability-execution-audit.js";
import { InMemoryCapabilityGatewayAuditSink } from "../audit/capability-audit.js";
import { CapabilityGateway, digestCapabilityPayload } from "../capabilities/gateway.js";
import { SyntheticCapabilityExecutor } from "../capabilities/implementations/executor.js";
import { SyntheticReadAnalyzeImplementationRegistry } from "../capabilities/implementations/implementation-registry.js";
import { capabilityRegistry } from "../capabilities/registry.js";

const now = new Date("2026-09-21T02:00:00.000Z");
const capabilityRef = {
  capabilityId: "hr.onboarding.case.status.read",
  capabilityVersion: "1.0.0"
} as const;
const payload = {
  onboardingCaseRef: "case-demo-001",
  expectedCaseVersion: 7,
  fieldSetRef: "field-set-case-status"
};
const request = {
  gatewayRequestVersion: "1",
  capabilityRequestId: "capability-request-s3-smoke",
  taskId: "task-s3-smoke",
  attemptId: "attempt-s3-smoke",
  routeDecisionRef: "route-s3-smoke",
  requestContext: {
    requestId: "request-s3-smoke",
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    actorType: "user",
    actorId: "hr-user-demo-001",
    authenticationLevel: "test-verified",
    roles: ["onboarding_hr_operations"],
    scopeGrantRefs: ["scope-synthetic-s3"],
    authorityGrantRefs: [],
    channel: "test_harness",
    sessionId: "session-synthetic-s3",
    correlationId: "correlation-s3-smoke",
    receivedAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z",
    dataAccessPurpose: "onboarding_operation",
    environment: "test",
    contextVersion: "1",
    integrityRef: "test-integrity-s3-smoke",
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
  actionClass: "read",
  purpose: "onboarding_operation",
  inputEnvelope: {
    schemaVersion: "1",
    capabilityRequestRef: "capability-request-s3-smoke",
    inputPayloadSchemaRef: "CaseRefQueryV1",
    inputPayloadDigest: digestCapabilityPayload(payload),
    payload
  },
  authorizationDecision: {
    decisionId: "authorization-s3-smoke",
    result: "allow",
    policyVersion: "authorization-policy-v1",
    grantVersion: "grant-synthetic-v1",
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
};

const implementationRegistry = new SyntheticReadAnalyzeImplementationRegistry(
  capabilityRegistry.capabilities
);
const enabledGatewayAudit = new InMemoryCapabilityGatewayAuditSink();
const enabledGateway = new CapabilityGateway({
  auditSink: enabledGatewayAudit,
  runtimeStateResolver: implementationRegistry.runtimeStateResolver(),
  allowSyntheticTestRuntimeOverrides: true,
  now: () => now
});
const executionAudit = new InMemoryCapabilityExecutionAuditSink();
const executor = new SyntheticCapabilityExecutor({
  implementationRegistry,
  auditSink: executionAudit,
  allowSyntheticTestExecution: true,
  now: () => now
});

const admission = enabledGateway.resolve(request);
const outcome = executor.execute(request, admission);

const defaultGateway = new CapabilityGateway({
  auditSink: new InMemoryCapabilityGatewayAuditSink(),
  now: () => now
});
const defaultDecision = defaultGateway.resolve(request);

if (
  admission.decision !== "ALLOW_TO_IMPLEMENTATION" ||
  outcome.envelope.resultStatus !== "SUCCESS" ||
  executor.implementationCallCount !== 1 ||
  outcome.externalSideEffect ||
  defaultDecision.decision !== "DENY" ||
  defaultDecision.reasonCodes[0] !== "CAPABILITY_NOT_EXECUTABLE"
) {
  throw new Error("S3 adapter smoke test did not preserve its test-only execution boundary");
}

process.stdout.write(`${JSON.stringify({
  status: "read_analyze_adapter_smoke_passed",
  syntheticImplementationCount: implementationRegistry.registrations().length,
  testHarnessAdmission: admission.decision,
  executionStatus: outcome.envelope.resultStatus,
  implementationCallCount: executor.implementationCallCount,
  executionAuditEventCount: executionAudit.events().length,
  defaultRuntimeDecision: defaultDecision.decision,
  defaultRuntimeReasonCodes: defaultDecision.reasonCodes,
  externalSideEffect: outcome.externalSideEffect
}, null, 2)}\n`);

