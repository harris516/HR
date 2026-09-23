import { describe, expect, it } from "vitest";
import { InMemoryCapabilityGatewayAuditSink } from "../src/audit/capability-audit.js";
import { resolveCapabilityCandidate } from "../src/capabilities/candidate-resolver.js";
import {
  CapabilityGateway,
  digestCapabilityPayload,
  type CapabilityRuntimeStateResolver
} from "../src/capabilities/gateway.js";
import { capabilityRegistry } from "../src/capabilities/registry.js";
import type { CapabilityEntry } from "../src/contracts/capability.js";
import type { CapabilityRuntimeState } from "../src/contracts/capability-gateway.js";
import type { RequestContext } from "../src/contracts/navigation.js";

const fixedNow = new Date("2026-09-21T02:00:00.000Z");

function context(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: "req-synthetic-gateway-001",
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
    correlationId: "corr-synthetic-gateway-001",
    receivedAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z",
    dataAccessPurpose: "onboarding_operation",
    environment: "test",
    contextVersion: "2",
    integrityRef: "test-integrity-gateway-001",
    synthetic: true,
    ...overrides
  };
}

function inputEnvelope(schemaRef = "CaseRefQueryV1", payload: unknown = {
  onboardingCaseRef: "case-demo-001",
  fieldSetRef: "field-set-safe"
}) {
  return {
    schemaVersion: "1",
    capabilityRequestRef: "cap-req-001",
    inputPayloadSchemaRef: schemaRef,
    inputPayloadDigest: digestCapabilityPayload(payload),
    payload
  };
}

function request(overrides: Record<string, unknown> = {}) {
  const capabilityRef = (overrides.capabilityRef as { capabilityId: string; capabilityVersion: string } | undefined) ?? {
    capabilityId: "hr.onboarding.case.status.read",
    capabilityVersion: "1.0.0"
  };
  const requestContext = (overrides.requestContext as RequestContext | undefined) ?? context();
  const actionClass = (overrides.actionClass as "read" | "analyze" | "draft" | undefined) ?? "read";
  const purpose = (overrides.purpose as "onboarding_operation" | "review" | "audit" | undefined) ?? "onboarding_operation";
  return {
    gatewayRequestVersion: "1",
    capabilityRequestId: "cap-req-001",
    taskId: "task-synthetic-001",
    attemptId: "attempt-synthetic-001",
    routeDecisionRef: "route-synthetic-001",
    requestContext,
    capabilityRef,
    resourceRefs: [{
      resourceType: "OnboardingCase",
      resourceId: "case-demo-001",
      tenantId: requestContext.tenantId,
      dataSpaceId: requestContext.dataSpaceId,
      sensitivity: "SYNTHETIC_INTERNAL"
    }],
    actionClass,
    purpose,
    inputEnvelope: inputEnvelope(),
    authorizationDecision: {
      decisionId: "authz-synthetic-001",
      result: "allow",
      policyVersion: "authz-policy-v1",
      grantVersion: "grant-v1",
      enforcementPoint: "capability_gateway",
      capabilityRef,
      tenantId: requestContext.tenantId,
      dataSpaceId: requestContext.dataSpaceId,
      actorId: requestContext.actorId,
      actionClass,
      purpose
    },
    risk: { phc: "PHC_1", prohibition: "NONE" },
    review: { status: "NOT_REQUIRED" },
    createdAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z",
    ...overrides
  };
}

function activeState(entry: CapabilityEntry, overrides: Partial<CapabilityRuntimeState> = {}): CapabilityRuntimeState {
  return {
    capabilityId: entry.capabilityId,
    capabilityVersion: entry.capabilityVersion,
    status: "TEST_STUB_ENABLED",
    featureEnabled: true,
    allowedEnvironments: ["test"],
    implementationBinding: {
      bindingRef: `impl://${entry.capabilityId}/test`,
      implementedCapabilityId: entry.capabilityId,
      supportedCapabilityVersions: [entry.capabilityVersion],
      implementationName: `synthetic-${entry.capabilityId}`,
      implementationVersion: "1.0.0",
      mode: "TEST_STUB",
      allowedEnvironments: ["test"],
      scopePolicy: "REQUEST_TENANT_AND_DATA_SPACE",
      inputSchemaRef: entry.inputSchemaRef,
      outputSchemaRef: entry.outputSchemaRef,
      timeoutMs: 1000,
      maxAttempts: 1,
      retryAllowed: false,
      circuitPolicyRef: "circuit-test-v1",
      sideEffectClass: entry.sideEffectClass,
      auditSupport: true,
      healthStatus: "HEALTHY",
      featureFlagRef: entry.featureFlag.key,
      approvedBy: "root",
      approvalRef: "approval-synthetic-test"
    },
    ...overrides
  };
}

function resolver(overrides: Partial<CapabilityRuntimeState> = {}): CapabilityRuntimeStateResolver {
  return { resolve: (entry) => activeState(entry, overrides) };
}

function gateway(options: {
  audit?: InMemoryCapabilityGatewayAuditSink;
  runtimeStateResolver?: CapabilityRuntimeStateResolver;
} = {}) {
  const audit = options.audit ?? new InMemoryCapabilityGatewayAuditSink();
  return {
    audit,
    gateway: new CapabilityGateway({
      auditSink: audit,
      now: () => fixedNow,
      idFactory: (() => {
        let id = 0;
        return () => `gateway-id-${++id}`;
      })(),
      ...(options.runtimeStateResolver === undefined
        ? {}
        : {
            runtimeStateResolver: options.runtimeStateResolver,
            allowSyntheticTestRuntimeOverrides: true
          })
    })
  };
}

describe("S2 capability candidate resolution", () => {
  it("resolves each supported P0 intent to a versioned capability reference", () => {
    const result = resolveCapabilityCandidate("GET_CASE_STATUS");
    expect(result).toEqual({
      resolved: true,
      capabilityRef: {
        capabilityId: "hr.onboarding.case.status.read",
        capabilityVersion: "1.0.0"
      }
    });
  });

  it("does not infer a capability for forbidden or unknown intents", () => {
    expect(resolveCapabilityCandidate("FORMAL_READY_COMMIT_REQUEST")).toEqual({
      resolved: false,
      reasonCode: "CAPABILITY_NOT_REGISTERED"
    });
  });
});

describe("S2 capability gateway default-deny baseline", () => {
  it("keeps all 18 reviewed capabilities non-executable in the default runtime", () => {
    const { gateway: target } = gateway();
    for (const entry of capabilityRegistry.capabilities) {
      const result = target.resolve(request({
        capabilityRequestId: `request-${entry.capabilityId}`,
        capabilityRef: { capabilityId: entry.capabilityId, capabilityVersion: entry.capabilityVersion },
        actionClass: entry.actionClass,
        authorizationDecision: {
          decisionId: "authz-baseline",
          result: "allow",
          policyVersion: "authz-policy-v1",
          grantVersion: "grant-v1",
          enforcementPoint: "capability_gateway",
          capabilityRef: { capabilityId: entry.capabilityId, capabilityVersion: entry.capabilityVersion },
          tenantId: "tenant-demo-001",
          dataSpaceId: "dataspace-demo-hr",
          actorId: "hr-user-demo-001",
          actionClass: entry.actionClass,
          purpose: "onboarding_operation"
        }
      }));
      expect(result).toMatchObject({
        decision: "DENY",
        resultStatus: "DENIED",
        reasonCodes: ["CAPABILITY_NOT_EXECUTABLE"],
        mayInvokeImplementation: false,
        implementationInvoked: false,
        externalSideEffect: false
      });
    }
  });

  it.each([
    "hr.onboarding.notification.send",
    "hr.onboarding.not.real"
  ])("rejects reserved or unknown capability %s without a generic fallback", (capabilityId) => {
    const { gateway: target } = gateway();
    const result = target.resolve(request({
      capabilityRef: { capabilityId, capabilityVersion: "1.0.0" },
      authorizationDecision: {
        ...request().authorizationDecision,
        capabilityRef: { capabilityId, capabilityVersion: "1.0.0" }
      }
    }));
    expect(result.reasonCodes).toEqual(["CAPABILITY_NOT_REGISTERED"]);
    expect(result.mayInvokeImplementation).toBe(false);
  });

  it("rejects unsupported versions before runtime binding resolution", () => {
    const { gateway: target } = gateway();
    const result = target.resolve(request({
      capabilityRef: { capabilityId: "hr.onboarding.case.status.read", capabilityVersion: "2.0.0" }
    }));
    expect(result.reasonCodes).toEqual(["CAPABILITY_VERSION_UNSUPPORTED"]);
  });

  it("fails closed before any admission work when audit is unavailable", () => {
    const audit = new InMemoryCapabilityGatewayAuditSink(false);
    const { gateway: target } = gateway({ audit });
    const result = target.resolve(request());
    expect(result).toMatchObject({
      resultStatus: "FAILED",
      reasonCodes: ["AUDIT_UNAVAILABLE"],
      auditRef: null,
      mayInvokeImplementation: false
    });
    expect(audit.events()).toHaveLength(0);
  });

  it("rejects malformed ingress without storing the payload body in audit", () => {
    const { gateway: target, audit } = gateway();
    const result = target.resolve({ capabilityRequestId: "malformed-001", secret: "must-not-appear" });
    expect(result.reasonCodes).toEqual(["CAPABILITY_INPUT_INVALID"]);
    expect(JSON.stringify(audit.events())).not.toContain("must-not-appear");
  });
});

describe("S2 capability gateway rejection paths", () => {
  it("rejects invalid runtime state contracts", () => {
    const { gateway: target } = gateway({ runtimeStateResolver: { resolve: () => ({ invalid: true }) } });
    expect(target.resolve(request()).reasonCodes).toEqual(["CAPABILITY_CONTRACT_INVALID"]);
  });

  it("rejects a disabled feature flag even when status is test-enabled", () => {
    const { gateway: target } = gateway({ runtimeStateResolver: resolver({ featureEnabled: false }) });
    expect(target.resolve(request()).reasonCodes).toEqual(["CAPABILITY_NOT_EXECUTABLE"]);
  });

  it("rejects an environment outside the implementation allowlist", () => {
    const { gateway: target } = gateway({ runtimeStateResolver: resolver({ allowedEnvironments: ["design"] }) });
    expect(target.resolve(request()).reasonCodes).toEqual(["CAPABILITY_NOT_EXECUTABLE"]);
  });

  it.each([
    ["tenantId", "tenant-other", "SYSTEM_HARD_BLOCK", "TENANT_MISSING_OR_MISMATCH"],
    ["dataSpaceId", "dataspace-other", "SYSTEM_HARD_BLOCK", "DATA_SPACE_MISSING_OR_MISMATCH"]
  ])("hard-blocks resource %s boundary mismatch", (field, value, decision, reasonCode) => {
    const base = request();
    const resource = { ...base.resourceRefs[0], [field]: value };
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    const result = target.resolve({ ...base, resourceRefs: [resource] });
    expect(result.decision).toBe(decision);
    expect(result.reasonCodes).toEqual([reasonCode]);
  });

  it("rejects purpose and action drift", () => {
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    expect(target.resolve(request({ purpose: "review" })).reasonCodes).toEqual(["PURPOSE_NOT_ALLOWED"]);
    expect(target.resolve(request({ actionClass: "draft" })).reasonCodes).toEqual(["ACTION_NOT_ALLOWED"]);
  });

  it("rejects an authorization decision bound to another actor", () => {
    const base = request();
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    const result = target.resolve({
      ...base,
      authorizationDecision: { ...base.authorizationDecision, actorId: "actor-other" }
    });
    expect(result.reasonCodes).toEqual(["AUTHORIZATION_INDETERMINATE"]);
  });

  it.each([
    ["deny", "DENY", "ACTION_NOT_ALLOWED"],
    ["step_up_required", "WAITING", "STEP_UP_REQUIRED"],
    ["review_required", "REVIEW_REQUIRED", "REVIEW_REQUIRED"],
    ["context_refresh_required", "WAITING", "CONTEXT_REFRESH_REQUIRED"],
    ["indeterminate", "DENY", "AUTHORIZATION_INDETERMINATE"]
  ])("maps authorization result %s to a closed path", (authorizationResult, decision, reasonCode) => {
    const base = request();
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    const result = target.resolve({
      ...base,
      authorizationDecision: { ...base.authorizationDecision, result: authorizationResult }
    });
    expect(result.decision).toBe(decision);
    expect(result.reasonCodes).toEqual([reasonCode]);
    expect(result.mayInvokeImplementation).toBe(false);
  });

  it.each([
    ["SYSTEM_HARD_BLOCK", "SYSTEM_HARD_BLOCK"],
    ["AGENT_PROHIBITED", "DENY"]
  ])("enforces prohibition class %s", (prohibition, decision) => {
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    const result = target.resolve(request({ risk: { phc: "PHC_1", prohibition } }));
    expect(result.decision).toBe(decision);
    expect(result.reasonCodes).toEqual(["PROHIBITED_ACTION"]);
  });

  it("rejects PHC outside the capability contract", () => {
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    expect(target.resolve(request({ risk: { phc: "PHC_4", prohibition: "NONE" } })).reasonCodes)
      .toEqual(["ACTION_NOT_ALLOWED"]);
  });

  it("requires human review for sensitive evidence inspection", () => {
    const capabilityRef = { capabilityId: "hr.onboarding.source_evidence.inspect", capabilityVersion: "1.0.0" };
    const base = request({
      capabilityRef,
      inputEnvelope: inputEnvelope("EvidenceInspectionQueryV1", {
        objectRef: "case-demo-001",
        fieldOrPropositionRefs: ["field-start-date"],
        fieldSetRef: "field-set-safe"
      }),
      resourceRefs: [{
        resourceType: "OnboardingCase",
        resourceId: "case-demo-001",
        tenantId: "tenant-demo-001",
        dataSpaceId: "dataspace-demo-hr",
        sensitivity: "SYNTHETIC_SENSITIVE"
      }]
    });
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    const result = target.resolve({
      ...base,
      authorizationDecision: { ...base.authorizationDecision, capabilityRef }
    });
    expect(result).toMatchObject({ decision: "REVIEW_REQUIRED", reasonCodes: ["REVIEW_REQUIRED"] });
  });

  it("rejects schema mismatch, unknown fields, and payload digest mismatch", () => {
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    expect(target.resolve(request({ inputEnvelope: inputEnvelope("RiskCollectionQueryV1") })).reasonCodes)
      .toEqual(["CAPABILITY_INPUT_INVALID"]);
    const payload = { onboardingCaseRef: "case-demo-001", fieldSetRef: "safe", unexpected: true };
    expect(target.resolve(request({ inputEnvelope: inputEnvelope("CaseRefQueryV1", payload) })).reasonCodes)
      .toEqual(["CAPABILITY_INPUT_INVALID"]);
    expect(target.resolve(request({
      inputEnvelope: { ...inputEnvelope(), inputPayloadDigest: "sha256:wrong" }
    })).reasonCodes).toEqual(["CAPABILITY_INPUT_INVALID"]);
  });

  it("rejects an input envelope bound to another capability request", () => {
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    expect(target.resolve(request({
      inputEnvelope: { ...inputEnvelope(), capabilityRequestRef: "cap-request-other" }
    })).reasonCodes).toEqual(["CAPABILITY_INPUT_INVALID"]);
  });

  it("rejects a missing implementation binding after all policy gates pass", () => {
    const { gateway: target } = gateway({ runtimeStateResolver: resolver({ implementationBinding: null }) });
    expect(target.resolve(request()).reasonCodes).toEqual(["IMPLEMENTATION_NOT_AVAILABLE"]);
  });

  it("rejects an implementation binding that claims another capability", () => {
    const runtimeStateResolver: CapabilityRuntimeStateResolver = {
      resolve: (entry) => {
        const state = activeState(entry);
        return {
          ...state,
          implementationBinding: {
            ...state.implementationBinding!,
            implementedCapabilityId: "hr.onboarding.case.list"
          }
        };
      }
    };
    const { gateway: target } = gateway({ runtimeStateResolver });
    expect(target.resolve(request()).reasonCodes).toEqual(["IMPLEMENTATION_NOT_AVAILABLE"]);
  });

  it("rejects a missing physical tool binding", () => {
    const runtimeStateResolver: CapabilityRuntimeStateResolver = {
      resolve: (entry) => {
        const state = activeState(entry);
        return {
          ...state,
          implementationBinding: {
            ...state.implementationBinding!,
            mode: "PHYSICAL_TOOL"
          }
        };
      }
    };
    const { gateway: target } = gateway({ runtimeStateResolver });
    expect(target.resolve(request()).reasonCodes).toEqual(["TOOL_BINDING_NOT_AVAILABLE"]);
  });

  it("rejects a missing connector binding after a valid physical tool binding", () => {
    const runtimeStateResolver: CapabilityRuntimeStateResolver = {
      resolve: (entry) => {
        const binding = activeState(entry).implementationBinding!;
        return {
          ...activeState(entry),
          implementationBinding: {
            ...binding,
            mode: "CONNECTOR_ADAPTER",
            physicalToolBinding: {
              bindingRef: "tool-binding-synthetic",
              runtimeProvider: "synthetic-runtime",
              toolName: "synthetic-tool",
              implementedCapabilityId: entry.capabilityId,
              supportedCapabilityVersions: [entry.capabilityVersion],
              allowedEnvironments: ["test"],
              scopePolicy: "REQUEST_TENANT_AND_DATA_SPACE",
              credentialRef: "credential-ref-not-secret",
              inputAdapterVersion: "1.0.0",
              outputAdapterVersion: "1.0.0",
              timeoutMs: 1000,
              maxAttempts: 1,
              retryAllowed: false,
              circuitPolicyRef: "circuit-test-v1",
              sideEffectClass: entry.sideEffectClass,
              receiptSupport: false,
              auditSupport: true,
              healthStatus: "HEALTHY",
              approvedBy: "root",
              approvalRef: "approval-synthetic-test"
            }
          }
        };
      }
    };
    const { gateway: target } = gateway({ runtimeStateResolver });
    expect(target.resolve(request()).reasonCodes).toEqual(["CONNECTOR_BINDING_NOT_AVAILABLE"]);
  });

  it("can admit a fully valid synthetic test binding without invoking it", () => {
    const { gateway: target, audit } = gateway({ runtimeStateResolver: resolver() });
    const result = target.resolve(request());
    expect(result).toMatchObject({
      decision: "ALLOW_TO_IMPLEMENTATION",
      resultStatus: "SUCCESS",
      reasonCodes: [],
      mayInvokeImplementation: true,
      implementationInvoked: false,
      externalSideEffect: false
    });
    expect(audit.events().at(-1)?.eventType).toBe("capability_gateway_admission_allowed");
    expect(audit.events().at(-1)).toMatchObject({
      actorId: "hr-user-demo-001",
      activeTeamId: "hr-onboarding-team-demo",
      teamMembershipRef: "membership-demo-team"
    });
  });
});

describe("S2 collection authorization admission", () => {
  const caseListPayload = {
    filterSpecRef: "filter-approved",
    pageSize: 20,
    pageToken: "cursor-001"
  };

  function collectionRequest(cursorOverrides: Record<string, unknown> = {}) {
    const capabilityRef = { capabilityId: "hr.onboarding.case.list", capabilityVersion: "1.0.0" };
    const base = request({
      capabilityRef,
      inputEnvelope: inputEnvelope("CaseCollectionQueryV1", caseListPayload),
      collectionAdmission: {
        predicateRef: "predicate-approved",
        fieldProjectionRef: "projection-approved",
        grantVersion: "grant-v1",
        queryDigest: "query-digest-001",
        sortSpecRef: "sort-approved",
        snapshotAt: "2026-09-21T01:59:30.000Z",
        countDisclosureAllowed: false,
        cursor: {
          tenantId: "tenant-demo-001",
          dataSpaceId: "dataspace-demo-hr",
          actorId: "hr-user-demo-001",
          purpose: "onboarding_operation",
          capabilityId: capabilityRef.capabilityId,
          capabilityVersion: capabilityRef.capabilityVersion,
          grantVersion: "grant-v1",
          queryDigest: "query-digest-001",
          predicateRef: "predicate-approved",
          fieldProjectionRef: "projection-approved",
          sortSpecRef: "sort-approved",
          snapshotAt: "2026-09-21T01:59:30.000Z",
          expiresAt: "2030-09-21T02:00:00.000Z",
          integrityValid: true,
          ...cursorOverrides
        }
      }
    });
    return {
      ...base,
      authorizationDecision: { ...base.authorizationDecision, capabilityRef }
    };
  }

  it("rejects a collection without predicate and projection admission", () => {
    const value = collectionRequest();
    delete (value as { collectionAdmission?: unknown }).collectionAdmission;
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    expect(target.resolve(value).reasonCodes).toEqual(["ACTION_NOT_ALLOWED"]);
  });

  it("rejects a collection admission bound to a stale grant decision", () => {
    const value = collectionRequest();
    const admission = (value as typeof value & {
      collectionAdmission: { grantVersion: string; cursor: { grantVersion: string } };
    }).collectionAdmission;
    admission.grantVersion = "grant-stale";
    admission.cursor.grantVersion = "grant-stale";
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    expect(target.resolve(value).reasonCodes).toEqual(["ACTION_NOT_ALLOWED"]);
  });

  it.each([
    ["tenantId", "tenant-other"],
    ["dataSpaceId", "dataspace-other"],
    ["actorId", "actor-other"],
    ["purpose", "review"],
    ["capabilityId", "hr.onboarding.risk.list"],
    ["capabilityVersion", "2.0.0"],
    ["grantVersion", "grant-old"],
    ["queryDigest", "query-other"],
    ["predicateRef", "predicate-other"],
    ["fieldProjectionRef", "projection-other"],
    ["sortSpecRef", "sort-other"],
    ["snapshotAt", "2026-09-20T01:59:30.000Z"],
    ["integrityValid", false],
    ["expiresAt", "2020-09-21T02:00:00.000Z"]
  ])("rejects cursor drift in %s", (field, value) => {
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    expect(target.resolve(collectionRequest({ [field]: value })).reasonCodes)
      .toEqual(["COLLECTION_CURSOR_INVALID"]);
  });

  it("admits a cursor bound to actor, purpose, scope, grant, query and capability", () => {
    const { gateway: target } = gateway({ runtimeStateResolver: resolver() });
    expect(target.resolve(collectionRequest())).toMatchObject({
      decision: "ALLOW_TO_IMPLEMENTATION",
      implementationInvoked: false
    });
  });
});
