import { describe, expect, it } from "vitest";
import { InMemoryNavigationAuditSink } from "../src/audit/navigation-audit.js";
import type { RequestContext, SubjectClue } from "../src/contracts/navigation.js";
import type { ScopeGrant } from "../src/navigation/authorization.js";
import { InvalidNavigationTransitionError, transitionTask } from "../src/navigation/lifecycle.js";
import { NavigationEngine } from "../src/navigation/navigation-engine.js";
import type { SyntheticCaseRecord } from "../src/navigation/subject-resolution.js";

const fixedNow = new Date("2026-09-21T02:00:00.000Z");

function baseContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: "req-synthetic-001",
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    actorType: "user",
    actorId: "hr-user-demo-001",
    authenticationLevel: "test-verified",
    roles: ["onboarding_hr_operations"],
    scopeGrantRefs: ["scope-synthetic-a2"],
    authorityGrantRefs: [],
    channel: "test_harness",
    sessionId: "session-synthetic-001",
    correlationId: "corr-synthetic-001",
    receivedAt: "2026-09-21T01:59:00.000Z",
    expiresAt: "2030-09-21T02:00:00.000Z",
    dataAccessPurpose: "onboarding_operation",
    environment: "test",
    contextVersion: "1",
    integrityRef: "test-integrity-001",
    synthetic: true,
    ...overrides
  };
}

function baseCases(): SyntheticCaseRecord[] {
  return [{
    synthetic: true,
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    caseId: "case-demo-001",
    offerRef: "offer-demo-001",
    candidateRef: "candidate-demo-001",
    displayName: "张三",
    accessible: true,
    version: "case-v1",
    sourceAvailability: "fresh"
  }];
}

function allowGrant(overrides: Partial<ScopeGrant> = {}): ScopeGrant {
  return {
    grantRef: "scope-synthetic-a2",
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    actions: ["read", "analyze", "draft"],
    resourceIds: ["*"],
    result: "allow",
    ...overrides
  };
}

function createEngine(options: {
  cases?: SyntheticCaseRecord[];
  grants?: ScopeGrant[];
  capabilities?: string[];
  auditAvailable?: boolean;
} = {}): { engine: NavigationEngine; audit: InMemoryNavigationAuditSink } {
  const audit = new InMemoryNavigationAuditSink(options.auditAvailable ?? true);
  const engine = new NavigationEngine({
    cases: options.cases ?? baseCases(),
    grants: options.grants ?? [allowGrant()],
    capabilities: new Set(options.capabilities ?? ["read_stub", "analyze_stub", "draft_stub"]),
    auditSink: audit,
    now: () => fixedNow
  });
  return { engine, audit };
}

function request(
  text: string,
  context: unknown = baseContext(),
  subjectClues: SubjectClue[] = [{ type: "case_id", value: "case-demo-001" }]
): unknown {
  return { context, input: { text, subjectClues } };
}

describe("task navigation N1-N7 acceptance", () => {
  it("TN-A01 routes an authorized synthetic case status read", () => {
    const { engine, audit } = createEngine();
    const result = engine.navigate(request("查询 case-demo-001 状态"));
    expect(result.aggregateStatus).toBe("all_completed");
    expect(result.childResults[0]).toMatchObject({
      intentId: "GET_CASE_STATUS",
      routeType: "READ",
      status: "completed",
      capabilityCalled: true
    });
    expect(engine.capabilityCallCount).toBe(1);
    expect(audit.events().some((event) => event.eventType === "navigation_finalized")).toBe(true);
  });

  it("TN-A02 splits a safe query from a forbidden formal READY commit", () => {
    const { engine } = createEngine();
    const result = engine.navigate(request("查询 case-demo-001 状态并标记为 READY"));
    expect(result.requestPlanId).toBeDefined();
    expect(result.aggregateStatus).toBe("partially_completed");
    expect(result.childResults).toHaveLength(2);
    expect(result.childResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ intentId: "FORMAL_READY_COMMIT_REQUEST", routeType: "DENY", capabilityCalled: false }),
      expect.objectContaining({ intentId: "GET_CASE_STATUS", routeType: "READ", capabilityCalled: true })
    ]));
    expect(engine.capabilityCallCount).toBe(1);
  });

  it("TN-A03 hard-blocks a context missing tenant without recording an asserted tenant", () => {
    const { engine, audit } = createEngine();
    const invalid = { ...baseContext() } as Record<string, unknown>;
    delete invalid.tenantId;
    const result = engine.navigate(request("查询状态", invalid));
    expect(result.aggregateStatus).toBe("hard_blocked");
    expect(result.childResults[0]?.reasonCodes).toContain("TENANT_MISSING_OR_MISMATCH");
    expect(engine.capabilityCallCount).toBe(0);
    expect(audit.events().every((event) => event.tenantId === undefined)).toBe(true);
  });

  it("TN-A04 creates a tracked clarification path for unknown intent", () => {
    const { engine, audit } = createEngine();
    const result = engine.navigate(request("帮我处理一下", baseContext(), []));
    expect(result.aggregateStatus).toBe("waiting");
    expect(result.childResults[0]).toMatchObject({ routeType: "CLARIFY", status: "waiting_for_human" });
    expect(result.childResults[0]?.reasonCodes).toContain("INTENT_UNKNOWN");
    expect(audit.events().some((event) => event.eventType === "task_created")).toBe(true);
  });

  it("TN-A05 does not auto-bind multiple same-name candidates", () => {
    const duplicate: SyntheticCaseRecord = {
      ...baseCases()[0]!,
      caseId: "case-demo-002",
      offerRef: "offer-demo-002",
      candidateRef: "candidate-demo-002"
    };
    const { engine } = createEngine({ cases: [...baseCases(), duplicate] });
    const result = engine.navigate(request("查询 case 状态", baseContext(), [{ type: "name", value: "张三" }]));
    expect(result.childResults[0]).toMatchObject({ routeType: "RESOLVE_SUBJECT", status: "waiting_for_human" });
    expect(result.childResults[0]?.reasonCodes).toContain("MULTIPLE_SUBJECTS");
    expect(engine.capabilityCallCount).toBe(0);
  });

  it("TN-A06 maps step-up authorization to human handoff", () => {
    const { engine } = createEngine({ grants: [allowGrant({ result: "step_up_required" })] });
    const result = engine.navigate(request("查询 case-demo-001 状态"));
    expect(result.childResults[0]).toMatchObject({ routeType: "HUMAN_HANDOFF", status: "waiting_for_human" });
    expect(result.childResults[0]?.reasonCodes).toContain("STEP_UP_REQUIRED");
    expect(engine.capabilityCallCount).toBe(0);
  });

  it("TN-A07 fails closed when authorization mapping is indeterminate", () => {
    const context = baseContext({ scopeGrantRefs: ["scope-missing"] });
    const { engine } = createEngine({ grants: [] });
    const result = engine.navigate(request("张三明天能正常入职吗", context));
    expect(result.childResults[0]).toMatchObject({ routeType: "DENY", capabilityCalled: false });
    expect(result.childResults[0]?.reasonCodes).toContain("AUTHORIZATION_INDETERMINATE");
  });

  it("TN-A08 denies an unregistered capability without selecting a generic tool", () => {
    const { engine } = createEngine({ capabilities: ["draft_stub"] });
    const result = engine.navigate(request("查询 case-demo-001 状态"));
    expect(result.childResults[0]?.reasonCodes).toContain("CAPABILITY_NOT_AVAILABLE");
    expect(result.childResults[0]?.capabilityCalled).toBe(false);
    expect(engine.capabilityCallCount).toBe(0);
  });

  it("TN-A09 labels an allowed last-known result with source metadata", () => {
    const unavailable = baseCases().map((record) => ({ ...record, sourceAvailability: "unavailable" as const }));
    const { engine } = createEngine({ cases: unavailable });
    const result = engine.navigate(request("查询 case-demo-001 状态"));
    expect(result.childResults[0]?.resultPayload).toMatchObject({
      sourceStatus: "unavailable",
      freshness: "stale",
      observationAge: "synthetic-age",
      provenanceRef: "synthetic-provenance",
      sourcePolicyVersion: "synthetic-source-policy-v1"
    });
  });

  it("TN-A10 stops before capability execution when audit is unavailable", () => {
    const { engine } = createEngine({ auditAvailable: false });
    const result = engine.navigate(request("查询 case-demo-001 状态"));
    expect(result.aggregateStatus).toBe("failed");
    expect(result.childResults[0]?.reasonCodes).toContain("AUDIT_UNAVAILABLE");
    expect(engine.capabilityCallCount).toBe(0);
  });

  it("TN-A11 suppresses exact duplicates and rejects same ID with different payload", () => {
    const { engine } = createEngine();
    const first = request("查询 case-demo-001 状态");
    engine.navigate(first);
    const duplicate = engine.navigate(first);
    expect(duplicate.childResults[0]?.routeType).toBe("READ");
    expect(engine.capabilityCallCount).toBe(1);
    const conflict = engine.navigate(request("帮我处理一下"));
    expect(conflict.aggregateStatus).toBe("failed");
    expect(conflict.childResults[0]?.reasonCodes).toContain("REQUEST_ID_CONFLICT");
    expect(engine.capabilityCallCount).toBe(1);
  });

  it("TN-A12 hard-blocks a cross-DataSpace subject reference without disclosing it", () => {
    const foreign = [{
      ...baseCases()[0]!,
      dataSpaceId: "dataspace-other",
      caseId: "case-foreign-001"
    }];
    const { engine } = createEngine({ cases: foreign });
    const result = engine.navigate(request("查询 case 状态", baseContext(), [{ type: "case_id", value: "case-foreign-001" }]));
    expect(result.aggregateStatus).toBe("hard_blocked");
    expect(result.childResults[0]).toMatchObject({ routeType: "SYSTEM_HARD_BLOCK", capabilityCalled: false });
    expect(result.childResults[0]?.resultPayload).toBeUndefined();
  });

  it("keeps same-name candidates in another tenant outside the current resolution set", () => {
    const foreignSameName: SyntheticCaseRecord = {
      ...baseCases()[0]!,
      tenantId: "tenant-other",
      dataSpaceId: "dataspace-other",
      caseId: "case-foreign-name",
      offerRef: "offer-foreign-name",
      candidateRef: "candidate-foreign-name"
    };
    const { engine } = createEngine({ cases: [...baseCases(), foreignSameName] });
    const result = engine.navigate(request("查询 case 状态", baseContext(), [{ type: "name", value: "张三" }]));
    expect(result.childResults[0]).toMatchObject({ routeType: "READ", capabilityCalled: true });
    expect(result.childResults[0]?.resultPayload).toMatchObject({ caseRef: "case-demo-001" });
  });

  it("keeps draft generation at A2 with no send or formal state change", () => {
    const { engine } = createEngine();
    const result = engine.navigate(request("为 case-demo-001 生成催材料提醒草稿"));
    expect(result.childResults[0]).toMatchObject({ routeType: "DRAFT", capabilityCalled: true });
    expect(result.childResults[0]?.resultPayload).toMatchObject({
      resultKind: "draft",
      formalStateChanged: false,
      externalSideEffect: false
    });
  });

  it("rejects forbidden lifecycle resurrection", () => {
    const task = {
      taskId: "task-test",
      attemptId: "attempt-test",
      taskEnvelopeVersion: "1" as const,
      requestContextRef: "req-test",
      tenantId: "tenant-demo-001",
      dataSpaceId: "dataspace-demo-hr",
      correlationId: "corr-test",
      intent: {
        intentCandidateId: "intent-test",
        requestContextRef: "req-test",
        correlationId: "corr-test",
        intentId: "UNKNOWN_INTENT" as const,
        intentClass: "unknown" as const,
        taskType: "CLARIFICATION_OR_HANDOFF",
        subjectRequirement: "none" as const,
        requestedActionClass: "none" as const,
        reasonCodes: []
      },
      status: "failed" as const,
      reasonCodes: [],
      transitionRecordRefs: []
    };
    expect(() => transitionTask(task, "in_progress", "retry", [], () => "1", fixedNow))
      .toThrow(InvalidNavigationTransitionError);
  });
});
