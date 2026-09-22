import { describe, expect, it } from "vitest";
import { capabilityProfiles } from "../src/capabilities/profiles.js";
import { capabilityReasonCodeRegistry } from "../src/capabilities/reason-codes.js";
import { capabilityRegistry } from "../src/capabilities/registry.js";
import {
  capabilityInputEnvelopeSchema,
  capabilityPayloadSchemas,
  capabilityResultEnvelopeSchema,
  parseCapabilityInput
} from "../src/capabilities/schema-registry.js";
import {
  capabilityRefSchema,
  plannedCapabilityIds,
  reservedCapabilityIds
} from "../src/contracts/capability.js";
import {
  CapabilityRegistryValidationError,
  validateCapabilityRegistry
} from "../src/validation/validate-capability-registry.js";

function registryCopy(): Record<string, any> {
  return structuredClone(capabilityRegistry) as Record<string, any>;
}

describe("S1 capability registry safety gate", () => {
  it("accepts the reviewed v0.3 registry", () => {
    const registry = validateCapabilityRegistry(registryCopy());
    expect(registry.contractVersion).toBe("v0.3");
    expect(registry.capabilities).toHaveLength(18);
    expect(registry.reservedCapabilities).toHaveLength(17);
  });

  it("keeps every business capability planned and non-executable", () => {
    for (const capability of capabilityRegistry.capabilities) {
      expect(capability.status).toBe("PLANNED_TEST_STUB");
      expect(capability.featureFlag.enabled).toBe(false);
      expect(capability.implementationBindingRef).toBeNull();
      expect(capability.physicalToolBindingRefs).toEqual([]);
      expect(capability.connectorBindingRefs).toEqual([]);
    }
  });

  it("contains exactly the reviewed planned capability IDs", () => {
    expect(capabilityRegistry.capabilities.map((entry) => entry.capabilityId).sort()).toEqual(
      [...plannedCapabilityIds].sort()
    );
  });

  it("contains exactly the reserved and unregistered side-effect IDs", () => {
    expect(
      capabilityRegistry.reservedCapabilities.map((entry) => entry.capabilityId).sort()
    ).toEqual([...reservedCapabilityIds].sort());
    expect(capabilityRegistry.reservedCapabilities.every((entry) => !entry.registrationAllowed)).toBe(true);
  });

  it("does not register Subject Resolution as a business capability", () => {
    expect(
      capabilityRegistry.capabilities.some(
        (entry) => String(entry.capabilityId) === "hr.onboarding.subject.resolve"
      )
    ).toBe(false);
  });

  it("keeps action class, automation level and side effect aligned", () => {
    const expected = {
      read: ["A0_READ", "NONE_READ"],
      analyze: ["A1_ANALYZE", "NONE_ANALYZE"],
      draft: ["A2_DRAFT", "DRAFT_ONLY"]
    } as const;
    for (const capability of capabilityRegistry.capabilities) {
      expect([capability.automationLevel, capability.sideEffectClass]).toEqual(
        expected[capability.actionClass]
      );
    }
  });

  it("resolves every authorization, data and execution profile", () => {
    const auth = new Set(capabilityProfiles.authorization.map((profile) => profile.profileId));
    const data = new Set(capabilityProfiles.data.map((profile) => profile.profileId));
    const execution = new Set(capabilityProfiles.execution.map((profile) => profile.profileId));
    for (const capability of capabilityRegistry.capabilities) {
      expect(capability.authorizationProfileRefs.every((profile) => auth.has(profile))).toBe(true);
      expect(capability.dataProfileRefs.every((profile) => data.has(profile))).toBe(true);
      expect(execution.has(capability.executionProfileRef)).toBe(true);
    }
  });

  it("resolves every input and output schema", () => {
    for (const capability of capabilityRegistry.capabilities) {
      expect(capabilityPayloadSchemas[capability.inputSchemaRef]).toBeDefined();
      expect(capabilityPayloadSchemas[capability.outputSchemaRef]).toBeDefined();
    }
  });

  it("requires a structured capability reference", () => {
    expect(() => capabilityRefSchema.parse("hr.onboarding.case.list@1.0.0")).toThrow();
    expect(
      capabilityRefSchema.parse({
        capabilityId: "hr.onboarding.case.list",
        capabilityVersion: "1.0.0"
      })
    ).toEqual({
      capabilityId: "hr.onboarding.case.list",
      capabilityVersion: "1.0.0"
    });
  });

  it("accepts the minimal readiness input", () => {
    const payload = parseCapabilityInput("ReadinessEvaluationInputV1", {
      schemaVersion: "1",
      capabilityRequestRef: "cap_req_001",
      inputPayloadSchemaRef: "ReadinessEvaluationInputV1",
      inputPayloadDigest: "digest_001",
      payload: {
        onboardingCaseRef: "case_001",
        expectedCaseVersion: 7,
        evaluationPurpose: "DAY1_READY_CHECK"
      }
    });
    expect(payload).toEqual({
      onboardingCaseRef: "case_001",
      expectedCaseVersion: 7,
      evaluationPurpose: "DAY1_READY_CHECK"
    });
  });

  it("rejects caller-selected readiness evidence or rules", () => {
    expect(() => parseCapabilityInput("ReadinessEvaluationInputV1", {
      schemaVersion: "1",
      capabilityRequestRef: "cap_req_002",
      inputPayloadSchemaRef: "ReadinessEvaluationInputV1",
      inputPayloadDigest: "digest_002",
      payload: {
        onboardingCaseRef: "case_001",
        expectedCaseVersion: 7,
        evaluationPurpose: "DAY1_READY_CHECK",
        evidenceRefs: ["chosen_evidence"],
        ruleSetRef: "chosen_rule"
      }
    })).toThrow();
  });

  it("rejects tenant or actor overrides in collection payloads", () => {
    expect(() => capabilityPayloadSchemas.CaseCollectionQueryV1.parse({
      filterSpecRef: "filter_001",
      pageSize: 25,
      tenantId: "attacker_tenant",
      actorId: "attacker"
    })).toThrow();
  });

  it("rejects an input envelope whose declared schema does not match", () => {
    expect(() => parseCapabilityInput("CaseRefQueryV1", {
      schemaVersion: "1",
      capabilityRequestRef: "cap_req_003",
      inputPayloadSchemaRef: "CaseCollectionQueryV1",
      inputPayloadDigest: "digest_003",
      payload: { filterSpecRef: "filter", pageSize: 10 }
    })).toThrow("input schema mismatch");
  });

  it("rejects unknown fields in the capability input envelope", () => {
    expect(() => capabilityInputEnvelopeSchema.parse({
      schemaVersion: "1",
      capabilityRequestRef: "cap_req_004",
      inputPayloadSchemaRef: "CaseRefQueryV1",
      inputPayloadDigest: "digest_004",
      payload: {},
      unsafeOverride: true
    })).toThrow();
  });

  it("requires reason codes for non-success results", () => {
    expect(() => capabilityResultEnvelopeSchema.parse({
      schemaVersion: "1",
      capabilityResultId: "result_001",
      capabilityRef: {
        capabilityId: "hr.onboarding.case.status.read",
        capabilityVersion: "1.0.0"
      },
      capabilityRequestRef: "request_001",
      requestId: "request_001",
      taskId: "task_001",
      attemptId: "attempt_001",
      correlationId: "correlation_001",
      requestContextRef: "context_001",
      authorizationDecisionRef: "auth_001",
      tenantId: "tenant_synthetic",
      dataSpaceId: "space_synthetic",
      resourceRefs: ["case_001"],
      inputPayloadDigest: "digest_001",
      resultStatus: "FAILED",
      reasonCodes: [],
      sourceReferences: [],
      freshnessResults: [],
      policyVersionRefs: [],
      objectVersionRefs: [],
      implementationBindingRef: "impl_001",
      implementationVersion: "1.0.0",
      sideEffectClass: "NONE_READ",
      auditRef: "audit_001",
      startedAt: "2026-09-21T00:00:00.000Z",
      completedAt: "2026-09-21T00:00:00.001Z"
    })).toThrow("non-success results require a reason code");
  });

  it("keeps the capability reason registry unique and versioned", () => {
    expect(capabilityReasonCodeRegistry.registryUri).toBe("reason://hr-onboarding/capability/v1");
    const codes = capabilityReasonCodeRegistry.entries.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toHaveLength(20);
  });

  it("rejects premature capability enablement", () => {
    const registry = registryCopy();
    registry.capabilities[0].status = "TEST_STUB_ENABLED";
    expect(() => validateCapabilityRegistry(registry)).toThrow(CapabilityRegistryValidationError);
  });

  it("rejects a feature flag enabled before implementation", () => {
    const registry = registryCopy();
    registry.capabilities[0].featureFlag.enabled = true;
    expect(() => validateCapabilityRegistry(registry)).toThrow(CapabilityRegistryValidationError);
  });

  it("rejects implementation, physical tool and connector bindings in S1", () => {
    for (const mutation of [
      (registry: Record<string, any>) => { registry.capabilities[0].implementationBindingRef = "impl_001"; },
      (registry: Record<string, any>) => { registry.capabilities[0].physicalToolBindingRefs = ["tool_001"]; },
      (registry: Record<string, any>) => { registry.capabilities[0].connectorBindingRefs = ["connector_001"]; }
    ]) {
      const registry = registryCopy();
      mutation(registry);
      expect(() => validateCapabilityRegistry(registry)).toThrow(CapabilityRegistryValidationError);
    }
  });
});
