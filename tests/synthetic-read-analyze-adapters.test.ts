import { describe, expect, it } from "vitest";
import { InMemoryCapabilityExecutionAuditSink } from "../src/audit/capability-execution-audit.js";
import { InMemoryCapabilityGatewayAuditSink } from "../src/audit/capability-audit.js";
import { CapabilityGateway, digestCapabilityPayload } from "../src/capabilities/gateway.js";
import { SyntheticCapabilityExecutor } from "../src/capabilities/implementations/executor.js";
import { SyntheticReadAnalyzeImplementationRegistry } from "../src/capabilities/implementations/implementation-registry.js";
import type { SyntheticCapabilityAdapter } from "../src/capabilities/implementations/types.js";
import { capabilityRegistry } from "../src/capabilities/registry.js";
import type { CapabilityEntry, CapabilityId } from "../src/contracts/capability.js";
import type { RequestContext } from "../src/contracts/navigation.js";

const fixedNow = new Date("2026-09-21T02:00:00.000Z");
const collectionCapabilityIds = new Set<CapabilityId>([
  "hr.onboarding.case.list",
  "hr.onboarding.risk.list",
  "hr.onboarding.responsibility.workbox.read",
  "hr.onboarding.artifact.list",
  "hr.onboarding.audit.timeline.read"
]);

function context(): RequestContext {
  return {
    requestId: "request-s3-hero",
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    activeTeamId: "hr-onboarding-team-demo",
    teamMembershipRef: "membership-demo-team",
    actorType: "user",
    actorId: "hr-user-demo-001",
    authenticationLevel: "test-verified",
    roles: ["onboarding_hr_operations"],
    scopeGrantRefs: ["scope-synthetic-s3"],
    authorityGrantRefs: [],
    channel: "test_harness",
    sessionId: "session-synthetic-s3",
    correlationId: "correlation-synthetic-s3",
    receivedAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z",
    dataAccessPurpose: "onboarding_operation",
    environment: "test",
    contextVersion: "2",
    integrityRef: "test-integrity-s3",
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

function capabilityRequest(
  capabilityId: CapabilityId,
  inputPayload: unknown,
  resourceId: string
) {
  const entry = entryFor(capabilityId);
  const capabilityRequestId = `capability-request-${capabilityId}`;
  const capabilityRef = {
    capabilityId: entry.capabilityId,
    capabilityVersion: entry.capabilityVersion
  };
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
  return {
    gatewayRequestVersion: "1",
    capabilityRequestId,
    taskId: `task-${capabilityId}`,
    attemptId: "attempt-001",
    routeDecisionRef: `route-${capabilityId}`,
    requestContext: context(),
    capabilityRef,
    resourceRefs: [{
      resourceType: capabilityId.includes("handoff") ? "OfferHandoff" : "OnboardingCase",
      resourceId,
      tenantId: "tenant-demo-001",
      dataSpaceId: "dataspace-demo-hr",
      sensitivity: "SYNTHETIC_INTERNAL"
    }],
    actionClass: entry.actionClass,
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
      actionClass: entry.actionClass,
      purpose: "onboarding_operation"
    },
    risk: { phc: "PHC_1", prohibition: "NONE" },
    review: { status: "NOT_REQUIRED" },
    ...(collectionAdmission === undefined ? {} : { collectionAdmission }),
    createdAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z"
  };
}

function createHarness(registry = new SyntheticReadAnalyzeImplementationRegistry(capabilityRegistry.capabilities), executionAuditAvailable = true) {
  const gatewayAudit = new InMemoryCapabilityGatewayAuditSink();
  const executionAudit = new InMemoryCapabilityExecutionAuditSink(executionAuditAvailable);
  let gatewayId = 0;
  let executionId = 0;
  const gateway = new CapabilityGateway({
    auditSink: gatewayAudit,
    runtimeStateResolver: registry.runtimeStateResolver(),
    allowSyntheticTestRuntimeOverrides: true,
    now: () => fixedNow,
    idFactory: () => `gateway-s3-${++gatewayId}`
  });
  const executor = new SyntheticCapabilityExecutor({
    implementationRegistry: registry,
    auditSink: executionAudit,
    allowSyntheticTestExecution: true,
    now: () => fixedNow,
    idFactory: () => `execution-s3-${++executionId}`
  });
  return { gateway, gatewayAudit, executor, executionAudit };
}

interface HeroFixture {
  fixtureId: string;
  capabilityId: CapabilityId;
  resourceId: string;
  input: unknown;
  verify: (output: Record<string, any>) => void;
}

const heroFixtures: HeroFixture[] = [
  {
    fixtureId: "CAP-001",
    capabilityId: "hr.onboarding.intake.handoff.read",
    resourceId: "handoff-demo-001",
    input: {
      handoffRef: "handoff-demo-001",
      expectedSourceVersion: "ats-offer-v3",
      fieldSetRef: "field-set-intake-minimum"
    },
    verify: (output) => {
      expect(output.sourceVersion).toBe("ats-offer-v3");
      expect(output.freshnessStatus).toBe("fresh");
    }
  },
  {
    fixtureId: "CAP-002",
    capabilityId: "hr.onboarding.intake.completeness.evaluate",
    resourceId: "handoff-demo-001",
    input: {
      handoffRef: "handoff-demo-001",
      expectedSourceVersion: "ats-offer-v3",
      intakePolicyRef: "intake-policy-001",
      intakePolicyVersion: "intake-policy-v1"
    },
    verify: (output) => {
      expect(output.result).toBe("COMPLETE_CANDIDATE");
      expect(output.inputSnapshotDigest).toBeTruthy();
    }
  },
  {
    fixtureId: "CAP-004",
    capabilityId: "hr.onboarding.case.list",
    resourceId: "case-collection-demo",
    input: { filterSpecRef: "filter-approved", pageSize: 20, snapshotAt: "2026-09-21T01:59:30.000Z" },
    verify: (output) => {
      expect(output.items).toHaveLength(1);
      expect(output.items[0].caseRef).toBe("case-demo-001");
      expect(JSON.stringify(output)).not.toContain("case-same-tenant-not-authorized");
      expect(JSON.stringify(output)).not.toContain("case-cross-tenant-hidden");
      expect(output.authorizedResultCount).toBeUndefined();
    }
  },
  {
    fixtureId: "CAP-005",
    capabilityId: "hr.onboarding.case.status.read",
    resourceId: "case-demo-001",
    input: { onboardingCaseRef: "case-demo-001", expectedCaseVersion: 7, fieldSetRef: "field-set-case-status" },
    verify: (output) => {
      expect(output).toMatchObject({
        caseVersion: 7,
        lifecycleStatus: "active",
        workflowStage: "preparation_in_progress",
        suggestedReadiness: "AT_RISK",
        formalReadiness: null,
        confirmationStatus: "pending",
        freshness: "fresh"
      });
    }
  },
  {
    fixtureId: "CAP-006",
    capabilityId: "hr.onboarding.requirement.status.read",
    resourceId: "case-demo-001",
    input: { onboardingCaseRef: "case-demo-001", expectedCaseVersion: 7 },
    verify: (output) => {
      expect(output.requirements[0]).toMatchObject({
        formalStatus: "evidence_pending",
        completionCandidateStatus: "COMPLETE_CANDIDATE",
        freshnessStatus: "fresh"
      });
      expect(output.requirements[0].formalStatus).not.toBe("completed");
    }
  },
  {
    fixtureId: "CAP-007",
    capabilityId: "hr.onboarding.requirement.completion.evaluate",
    resourceId: "case-demo-001",
    input: {
      onboardingCaseRef: "case-demo-001",
      requirementRef: "requirement-equipment-001",
      expectedCaseVersion: 7,
      expectedRequirementVersion: 3
    },
    verify: (output) => {
      expect(output.result).toBe("COMPLETE_CANDIDATE");
      expect(output.formalStatusChanged).toBe(false);
    }
  },
  {
    fixtureId: "CAP-008",
    capabilityId: "hr.onboarding.risk.list",
    resourceId: "case-demo-001",
    input: {
      caseScopeRef: "case-demo-001",
      riskPolicyRef: "risk-policy-001",
      riskPolicyVersion: "risk-policy-v1",
      snapshotAt: "2026-09-21T01:59:30.000Z",
      pageSize: 20
    },
    verify: (output) => {
      expect(output.policyVersion).toBe("risk-policy-v1");
      expect(output.items[0]).toMatchObject({ severity: "high", blocking: true });
      expect(output.items[0].reasonCodes).toContain("REVIEW_REQUIRED");
    }
  },
  {
    fixtureId: "CAP-009",
    capabilityId: "hr.onboarding.source_evidence.inspect",
    resourceId: "case-demo-001",
    input: {
      objectRef: "case-demo-001",
      fieldOrPropositionRefs: ["planned_start_date"],
      expectedObjectVersion: 7,
      fieldSetRef: "field-set-evidence-redacted"
    },
    verify: (output) => {
      expect(output).toMatchObject({
        authorityStatus: "authoritative",
        provenanceStatus: "complete",
        freshnessStatus: "fresh"
      });
      expect(output.observations[0].redactionApplied).toBe(true);
      expect(output.observations[0].normalizedValueRef).toBeUndefined();
    }
  },
  {
    fixtureId: "CAP-010",
    capabilityId: "hr.onboarding.responsibility.workbox.read",
    resourceId: "case-demo-001",
    input: {
      responsibilityScopeRef: "workbox-hr-user-demo-001",
      pageSize: 20,
      snapshotAt: "2026-09-21T01:59:30.000Z"
    },
    verify: (output) => {
      expect(output.items).toHaveLength(1);
      expect(output.items[0]).toMatchObject({
        taskOrRequirementRef: "requirement-equipment-001",
        status: "open"
      });
    }
  },
  {
    fixtureId: "CAP-013",
    capabilityId: "hr.onboarding.readiness.evaluate",
    resourceId: "case-demo-001",
    input: { onboardingCaseRef: "case-demo-001", expectedCaseVersion: 7, evaluationPurpose: "DAY1_READY_CHECK" },
    verify: (output) => {
      expect(output.result).toBe("NOT_ELIGIBLE");
      expect(output.authoritativeSnapshotRef).toBe("authoritative-snapshot-case-demo-001-v7");
      expect(output.formalReadinessChanged).toBe(false);
    }
  },
  {
    fixtureId: "CAP-014",
    capabilityId: "hr.onboarding.readiness.revalidate",
    resourceId: "case-demo-001",
    input: {
      onboardingCaseRef: "case-demo-001",
      expectedCaseVersion: 7,
      previousEvaluationRef: "evaluation-previous-001",
      invalidationTriggerRef: "trigger-source-refresh-001",
      causationId: "causation-001",
      deduplicationKey: "dedupe-001"
    },
    verify: (output) => {
      expect(output.authoritativeSnapshotRef).toContain("revalidation");
      expect(output.evaluationId).not.toBe("evaluation-previous-001");
      expect(output.formalReadinessChanged).toBe(false);
    }
  },
  {
    fixtureId: "CAP-016",
    capabilityId: "hr.onboarding.artifact.list",
    resourceId: "case-demo-001",
    input: { onboardingCaseRef: "case-demo-001", pageSize: 20, snapshotAt: "2026-09-21T01:59:30.000Z" },
    verify: (output) => {
      expect(output.items[0]).toMatchObject({
        artifactStatus: "DRAFT",
        artifactVersion: 2,
        sensitivityClass: "SYNTHETIC_INTERNAL"
      });
    }
  },
  {
    fixtureId: "CAP-017",
    capabilityId: "hr.onboarding.audit.timeline.read",
    resourceId: "case-demo-001",
    input: {
      resourceRef: "case-demo-001",
      pageSize: 20,
      redactionPolicyRef: "audit-redaction-policy-001"
    },
    verify: (output) => {
      expect(output.items[0].redactionApplied).toBe(true);
      expect(output.redactionPolicyVersion).toBe("audit-redaction-policy-v1");
      expect(JSON.stringify(output).toLowerCase()).not.toContain("secret");
    }
  }
];

describe("S3 synthetic read/analyze implementation registry", () => {
  it("registers exactly the 13 reviewed read/analyze adapters and no draft adapter", () => {
    const registry = new SyntheticReadAnalyzeImplementationRegistry(capabilityRegistry.capabilities);
    expect(registry.registrations()).toHaveLength(13);
    for (const registration of registry.registrations()) {
      expect(entryFor(registration.capabilityId).actionClass).not.toBe("draft");
      expect(registration.binding.mode).toBe("TEST_STUB");
      expect(registration.binding.allowedEnvironments).toEqual(["test"]);
    }
    expect(registry.get("hr.onboarding.reminder.draft")).toBeUndefined();
  });

  it("does not allow adapter overrides without explicit test-only opt-in", () => {
    expect(() => new SyntheticReadAnalyzeImplementationRegistry(
      capabilityRegistry.capabilities,
      { adapterOverrides: new Map() }
    )).toThrow("test-only opt-in");
  });
});

describe("S3 read/analyze Hero Fixtures", () => {
  it.each(heroFixtures)("$fixtureId executes $capabilityId with validated output", (fixture) => {
    const request = capabilityRequest(fixture.capabilityId, fixture.input, fixture.resourceId);
    const { gateway, gatewayAudit, executor, executionAudit } = createHarness();
    const admission = gateway.resolve(request);
    expect(admission).toMatchObject({
      decision: "ALLOW_TO_IMPLEMENTATION",
      mayInvokeImplementation: true,
      implementationInvoked: false
    });

    const outcome = executor.execute(request, admission);
    expect(outcome.envelope).toMatchObject({
      capabilityRef: request.capabilityRef,
      capabilityRequestRef: request.capabilityRequestId,
      tenantId: "tenant-demo-001",
      dataSpaceId: "dataspace-demo-hr",
      resultStatus: "SUCCESS",
      outputPayloadSchemaRef: entryFor(fixture.capabilityId).outputSchemaRef
    });
    expect(outcome.implementationInvoked).toBe(true);
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
    fixture.verify(outcome.outputPayload as Record<string, any>);
  });
});

describe("S3 executor safety boundary", () => {
  it("keeps the default runtime all-denied even though S3 adapters exist", () => {
    const request = capabilityRequest(
      "hr.onboarding.case.status.read",
      { onboardingCaseRef: "case-demo-001", expectedCaseVersion: 7, fieldSetRef: "safe" },
      "case-demo-001"
    );
    const defaultGateway = new CapabilityGateway({
      auditSink: new InMemoryCapabilityGatewayAuditSink(),
      now: () => fixedNow
    });
    const admission = defaultGateway.resolve(request);
    expect(admission).toMatchObject({
      decision: "DENY",
      reasonCodes: ["CAPABILITY_NOT_EXECUTABLE"],
      mayInvokeImplementation: false
    });
  });

  it("does not invoke an adapter when the gateway admission is denied", () => {
    const request = capabilityRequest(
      "hr.onboarding.case.status.read",
      { onboardingCaseRef: "case-demo-001", expectedCaseVersion: 7, fieldSetRef: "safe" },
      "case-demo-001"
    );
    const registry = new SyntheticReadAnalyzeImplementationRegistry(capabilityRegistry.capabilities);
    const defaultGateway = new CapabilityGateway({
      auditSink: new InMemoryCapabilityGatewayAuditSink(),
      now: () => fixedNow
    });
    const admission = defaultGateway.resolve(request);
    const { executor } = createHarness(registry);
    const outcome = executor.execute(request, admission);
    expect(outcome.envelope.reasonCodes).toEqual(["IMPLEMENTATION_NOT_AVAILABLE"]);
    expect(outcome.implementationInvoked).toBe(false);
    expect(executor.implementationCallCount).toBe(0);
  });

  it("fails closed before invocation when execution audit is unavailable", () => {
    const request = capabilityRequest(
      "hr.onboarding.case.status.read",
      { onboardingCaseRef: "case-demo-001", expectedCaseVersion: 7, fieldSetRef: "safe" },
      "case-demo-001"
    );
    const { gateway, executor } = createHarness(
      new SyntheticReadAnalyzeImplementationRegistry(capabilityRegistry.capabilities),
      false
    );
    const outcome = executor.execute(request, gateway.resolve(request));
    expect(outcome.envelope.reasonCodes).toEqual(["AUDIT_UNAVAILABLE"]);
    expect(outcome.implementationInvoked).toBe(false);
    expect(executor.implementationCallCount).toBe(0);
  });

  it("does not publish output that fails the reviewed output schema", () => {
    const capabilityId: CapabilityId = "hr.onboarding.case.status.read";
    const invalidAdapter: SyntheticCapabilityAdapter = () => ({
      resultStatus: "SUCCESS",
      outputPayload: { unsafeUnknownField: true },
      reasonCodes: [],
      sourceReferences: [],
      freshnessResults: [],
      policyVersionRefs: [],
      objectVersionRefs: []
    });
    const registry = new SyntheticReadAnalyzeImplementationRegistry(
      capabilityRegistry.capabilities,
      {
        adapterOverrides: new Map([[capabilityId, invalidAdapter]]),
        allowSyntheticTestAdapterOverrides: true
      }
    );
    const request = capabilityRequest(
      capabilityId,
      { onboardingCaseRef: "case-demo-001", expectedCaseVersion: 7, fieldSetRef: "safe" },
      "case-demo-001"
    );
    const { gateway, executor, executionAudit } = createHarness(registry);
    const outcome = executor.execute(request, gateway.resolve(request));
    expect(outcome.envelope).toMatchObject({
      resultStatus: "FAILED",
      reasonCodes: ["CAPABILITY_OUTPUT_INVALID"]
    });
    expect(outcome.outputPayload).toBeUndefined();
    expect(outcome.implementationInvoked).toBe(true);
    expect(executionAudit.events().at(-1)?.eventType).toBe("capability_implementation_failed");
  });
});

