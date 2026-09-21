import { describe, expect, it } from "vitest";
import { InMemoryCapabilityExecutionAuditSink } from "../src/audit/capability-execution-audit.js";
import { InMemoryCapabilityGatewayAuditSink } from "../src/audit/capability-audit.js";
import { CapabilityGateway, digestCapabilityPayload } from "../src/capabilities/gateway.js";
import { SyntheticDraftImplementationRegistry } from "../src/capabilities/implementations/draft-implementation-registry.js";
import { SyntheticCapabilityExecutor } from "../src/capabilities/implementations/executor.js";
import { capabilityRegistry } from "../src/capabilities/registry.js";
import type { CapabilityEntry, CapabilityId } from "../src/contracts/capability.js";
import type { RequestContext } from "../src/contracts/navigation.js";

const fixedNow = new Date("2026-09-21T02:00:00.000Z");

function context(): RequestContext {
  return {
    requestId: "request-s4-hero",
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    actorType: "user",
    actorId: "hr-user-demo-001",
    authenticationLevel: "test-verified",
    roles: ["onboarding_hr_operations"],
    scopeGrantRefs: ["scope-synthetic-s4"],
    authorityGrantRefs: [],
    channel: "test_harness",
    sessionId: "session-synthetic-s4",
    correlationId: "correlation-synthetic-s4",
    receivedAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z",
    dataAccessPurpose: "onboarding_operation",
    environment: "test",
    contextVersion: "1",
    integrityRef: "test-integrity-s4",
    synthetic: true
  };
}

function entryFor(capabilityId: CapabilityId): CapabilityEntry {
  const entry = capabilityRegistry.capabilities.find((candidate) => candidate.capabilityId === capabilityId);
  if (entry === undefined) {
    throw new Error(`missing capability entry: ${capabilityId}`);
  }
  return entry;
}

function draftRequest(
  capabilityId: CapabilityId,
  inputPayload: unknown,
  resourceId: string,
  phc: "PHC_1" | "PHC_2" | "PHC_3" | "PHC_4",
  reviewSatisfied: boolean
) {
  const entry = entryFor(capabilityId);
  const capabilityRequestId = `capability-request-${capabilityId}`;
  const capabilityRef = { capabilityId, capabilityVersion: entry.capabilityVersion };
  return {
    gatewayRequestVersion: "1",
    capabilityRequestId,
    taskId: `task-${capabilityId}`,
    attemptId: "attempt-001",
    routeDecisionRef: `route-${capabilityId}`,
    requestContext: context(),
    capabilityRef,
    resourceRefs: [{
      resourceType: capabilityId.includes("intake") ? "OfferHandoff" : "OnboardingCase",
      resourceId,
      tenantId: "tenant-demo-001",
      dataSpaceId: "dataspace-demo-hr",
      sensitivity: "SYNTHETIC_INTERNAL"
    }],
    actionClass: "draft",
    purpose: "onboarding_operation",
    inputEnvelope: {
      schemaVersion: "1",
      capabilityRequestRef: capabilityRequestId,
      inputPayloadSchemaRef: entry.inputSchemaRef,
      inputPayloadDigest: digestCapabilityPayload(inputPayload),
      payload: inputPayload
    },
    authorizationDecision: {
      decisionId: `authorization-${capabilityId}`,
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
    risk: { phc, prohibition: "NONE" },
    review: reviewSatisfied
      ? { status: "SATISFIED", reviewRef: `review-approval-${capabilityId}` }
      : { status: "NOT_REQUIRED" },
    createdAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z"
  };
}

function createHarness() {
  const registry = new SyntheticDraftImplementationRegistry(capabilityRegistry.capabilities);
  const gatewayAudit = new InMemoryCapabilityGatewayAuditSink();
  const executionAudit = new InMemoryCapabilityExecutionAuditSink();
  let gatewayId = 0;
  let executionId = 0;
  const gateway = new CapabilityGateway({
    auditSink: gatewayAudit,
    runtimeStateResolver: registry.runtimeStateResolver(),
    allowSyntheticTestRuntimeOverrides: true,
    now: () => fixedNow,
    idFactory: () => `gateway-s4-${++gatewayId}`
  });
  const executor = new SyntheticCapabilityExecutor({
    implementationRegistry: registry,
    auditSink: executionAudit,
    allowSyntheticTestExecution: true,
    now: () => fixedNow,
    idFactory: () => `execution-s4-${++executionId}`
  });
  return { registry, gateway, gatewayAudit, executor, executionAudit };
}

interface DraftFixture {
  fixtureId: string;
  capabilityId: CapabilityId;
  resourceId: string;
  phc: "PHC_1" | "PHC_2" | "PHC_3" | "PHC_4";
  reviewSatisfied: boolean;
  input: Record<string, unknown>;
  artifactType: string;
  reviewRequired: boolean;
}

const draftFixtures: DraftFixture[] = [
  {
    fixtureId: "CAP-003",
    capabilityId: "hr.onboarding.intake.draft",
    resourceId: "handoff-demo-001",
    phc: "PHC_1",
    reviewSatisfied: false,
    input: {
      handoffRef: "handoff-demo-001",
      completenessEvaluationRef: "evaluation-intake-complete-001",
      expectedSourceVersion: "ats-offer-v3",
      approvedFactRefs: ["fact-offer-accepted-001", "fact-start-date-001"],
      language: "zh-CN",
      templateRef: "template-intake-v1"
    },
    artifactType: "ONBOARDING_INTAKE_DRAFT",
    reviewRequired: false
  },
  {
    fixtureId: "CAP-011",
    capabilityId: "hr.onboarding.reminder.draft",
    resourceId: "case-demo-001",
    phc: "PHC_1",
    reviewSatisfied: false,
    input: {
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
    artifactType: "ONBOARDING_REMINDER_DRAFT",
    reviewRequired: false
  },
  {
    fixtureId: "CAP-012",
    capabilityId: "hr.onboarding.escalation.draft",
    resourceId: "case-demo-001",
    phc: "PHC_3",
    reviewSatisfied: true,
    input: {
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
    artifactType: "ONBOARDING_ESCALATION_DRAFT",
    reviewRequired: true
  },
  {
    fixtureId: "CAP-015",
    capabilityId: "hr.onboarding.ready_card.draft",
    resourceId: "case-demo-001",
    phc: "PHC_3",
    reviewSatisfied: true,
    input: {
      onboardingCaseRef: "case-demo-001",
      expectedCaseVersion: 7,
      readinessEvaluationRef: "evaluation-readiness-001",
      templateRef: "template-ready-card-v1",
      language: "zh-CN",
      fieldSetRef: "field-set-ready-card-minimum"
    },
    artifactType: "DAY1_READY_CARD_DRAFT",
    reviewRequired: true
  },
  {
    fixtureId: "CAP-018",
    capabilityId: "hr.onboarding.review_request.draft",
    resourceId: "case-demo-001",
    phc: "PHC_4",
    reviewSatisfied: true,
    input: {
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
    },
    artifactType: "PROFESSIONAL_REVIEW_REQUEST_DRAFT",
    reviewRequired: true
  }
];

describe("S4 synthetic draft implementation registry", () => {
  it("registers exactly five reviewed Draft adapters", () => {
    const registry = new SyntheticDraftImplementationRegistry(capabilityRegistry.capabilities);
    expect(registry.registrations()).toHaveLength(5);
    for (const registration of registry.registrations()) {
      expect(entryFor(registration.capabilityId).actionClass).toBe("draft");
      expect(registration.binding.sideEffectClass).toBe("DRAFT_ONLY");
      expect(registration.binding.mode).toBe("TEST_STUB");
    }
    expect(registry.get("hr.onboarding.case.status.read")).toBeUndefined();
  });
});

describe("S4 Draft Hero Fixtures", () => {
  it.each(draftFixtures)("$fixtureId executes $capabilityId as an unsent draft", (fixture) => {
    const request = draftRequest(
      fixture.capabilityId,
      fixture.input,
      fixture.resourceId,
      fixture.phc,
      fixture.reviewSatisfied
    );
    const { gateway, gatewayAudit, executor, executionAudit } = createHarness();
    const admission = gateway.resolve(request);
    expect(admission.decision).toBe("ALLOW_TO_IMPLEMENTATION");

    const outcome = executor.execute(request, admission);
    expect(outcome.envelope).toMatchObject({
      resultStatus: "SUCCESS",
      sideEffectClass: "DRAFT_ONLY",
      outputPayloadSchemaRef: "DraftArtifactResultV1"
    });
    expect(outcome.outputPayload).toMatchObject({
      artifactType: fixture.artifactType,
      artifactStatus: "DRAFT",
      sendStatus: "NOT_SENT",
      formalStateChanged: false,
      externalSideEffect: false,
      reviewRequired: fixture.reviewRequired
    });
    expect(outcome.envelope.executionReceiptRef).toBeUndefined();
    expect(outcome.externalSideEffect).toBe(false);
    expect(executor.implementationCallCount).toBe(1);
    expect(gatewayAudit.events().map((event) => event.eventType)).toEqual([
      "capability_gateway_ingress",
      "capability_gateway_admission_allowed"
    ]);
    expect(executionAudit.events().map((event) => event.eventType)).toEqual([
      "capability_implementation_started",
      "capability_implementation_completed"
    ]);
    expect(Object.keys(outcome.outputPayload as Record<string, unknown>).sort()).toEqual([
      "artifactRef",
      "artifactStatus",
      "artifactType",
      "artifactVersion",
      "contentDigest",
      "externalSideEffect",
      "formalStateChanged",
      "redactionSummary",
      "reviewRequired",
      "sendStatus",
      "sourceReferences"
    ]);
  });
});

describe("S4 Draft safety boundary", () => {
  it("keeps all Draft capabilities denied in the default runtime", () => {
    const fixture = draftFixtures[1]!;
    const request = draftRequest(
      fixture.capabilityId,
      fixture.input,
      fixture.resourceId,
      fixture.phc,
      fixture.reviewSatisfied
    );
    const defaultGateway = new CapabilityGateway({
      auditSink: new InMemoryCapabilityGatewayAuditSink(),
      now: () => fixedNow
    });
    expect(defaultGateway.resolve(request)).toMatchObject({
      decision: "DENY",
      reasonCodes: ["CAPABILITY_NOT_EXECUTABLE"],
      mayInvokeImplementation: false
    });
  });

  it("stops a high-risk Draft before implementation when review is missing", () => {
    const fixture = draftFixtures[2]!;
    const request = draftRequest(
      fixture.capabilityId,
      fixture.input,
      fixture.resourceId,
      fixture.phc,
      false
    );
    const { gateway, executor } = createHarness();
    const admission = gateway.resolve(request);
    expect(admission).toMatchObject({
      decision: "REVIEW_REQUIRED",
      reasonCodes: ["REVIEW_REQUIRED"],
      mayInvokeImplementation: false
    });
    const outcome = executor.execute(request, admission);
    expect(outcome.implementationInvoked).toBe(false);
    expect(executor.implementationCallCount).toBe(0);
  });

  it("rejects a reminder request that attempts to switch to escalation semantics", () => {
    const fixture = draftFixtures[1]!;
    const unsafeInput = { ...fixture.input, draftType: "ESCALATION" };
    const request = draftRequest(
      fixture.capabilityId,
      unsafeInput,
      fixture.resourceId,
      fixture.phc,
      fixture.reviewSatisfied
    );
    const { gateway, executor } = createHarness();
    const admission = gateway.resolve(request);
    expect(admission.decision).toBe("ALLOW_TO_IMPLEMENTATION");
    const outcome = executor.execute(request, admission);
    expect(outcome.envelope).toMatchObject({
      resultStatus: "FAILED",
      reasonCodes: ["CAPABILITY_INPUT_INVALID"]
    });
    expect(outcome.outputPayload).toBeUndefined();
    expect(outcome.externalSideEffect).toBe(false);
  });

  it("keeps the PHC-4 review request as a facts-only artifact with no decision fields", () => {
    const fixture = draftFixtures[4]!;
    const request = draftRequest(
      fixture.capabilityId,
      fixture.input,
      fixture.resourceId,
      fixture.phc,
      fixture.reviewSatisfied
    );
    const { gateway, executor } = createHarness();
    const outcome = executor.execute(request, gateway.resolve(request));
    const output = outcome.outputPayload as Record<string, unknown>;
    expect(output.artifactType).toBe("PROFESSIONAL_REVIEW_REQUEST_DRAFT");
    expect(output).not.toHaveProperty("decision");
    expect(output).not.toHaveProperty("recommendation");
    expect(output).not.toHaveProperty("waiverDecision");
    expect(output).not.toHaveProperty("employmentDecision");
    expect(output.formalStateChanged).toBe(false);
  });
});

