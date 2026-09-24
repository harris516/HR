import { existsSync, mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RequestContext } from "../src/contracts/navigation.js";
import { createFeishuTestContext, syntheticTrustedFeishuPrincipals } from "../src/mvp/feishu-test-context.js";
import { SyntheticCaseStore, SyntheticCaseStoreError } from "../src/mvp/synthetic-case-store.js";
import { createSyntheticReadyCard } from "../src/mvp/synthetic-ready-card.js";
import { Step2SyntheticSkillRuntime } from "../src/skills/step2-runtime.js";

const fixedNow = new Date("2026-09-24T03:00:00.000Z");
const directories: string[] = [];

function database(): { directory: string; databasePath: string } {
  const directory = mkdtempSync(join(tmpdir(), "hr-step25-"));
  directories.push(directory);
  return { directory, databasePath: join(directory, "synthetic.sqlite") };
}

function principal(bot = "hr-bot-01", sender = "ou_hr1synthetic"): RequestContext {
  return createFeishuTestContext({ agentAccountId: bot, requesterSenderId: sender,
    trustedPrincipals: syntheticTrustedFeishuPrincipals, now: fixedNow });
}

function runtime(databasePath: string, auditAvailability: {
  skill?: boolean; gateway?: boolean; execution?: boolean;
} = {}): Step2SyntheticSkillRuntime {
  let id = 0;
  return new Step2SyntheticSkillRuntime({
    allowSyntheticTestExecution: true,
    databasePath,
    repositoryRoot: resolve("."),
    trustedTeamMemberships: syntheticTrustedFeishuPrincipals,
    now: () => fixedNow,
    idFactory: () => `step25-${++id}`,
    auditAvailability
  });
}

function createCase(databasePath: string, context = principal(), mutationId = "mutation-create-001",
  candidateDisplayName = "测试新员工甲", plannedStartAt: string | null | undefined = null) {
  return runtime(databasePath).run({
    skillId: "onboarding_case_intake_pack",
    workflowId: "synthetic_case_create_from_accepted_offer",
    trustedInvocationId: mutationId,
    requestContext: context,
    businessInput: {
      candidateDisplayName,
      offerAccepted: true,
      plannedStartAt
    }
  });
}

function complete(databasePath: string, context: RequestContext, caseRef: string,
  kind: "DOCUMENTS" | "IT_ACCOUNT" | "DEVICE", _caseVersion: number,
  _requirementVersion = 1, mutationId = `mutation-${kind.toLowerCase()}`) {
  return runtime(databasePath).run({
    skillId: "onboarding_requirement_tracking_pack",
    workflowId: "synthetic_requirement_completion_update",
    trustedInvocationId: mutationId,
    requestContext: context,
    businessInput: {
      caseRef, requirementKind: kind
    }
  });
}

function open(databasePath: string, auditAvailable = true): SyntheticCaseStore {
  return new SyntheticCaseStore({ databasePath, repositoryRoot: resolve("."),
    allowSyntheticTestStorage: true, trustedTeamMemberships: syntheticTrustedFeishuPrincipals,
    now: () => fixedNow, auditAvailable: () => auditAvailable });
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    const databasePath = join(directory, "synthetic.sqlite");
    if (existsSync(databasePath)) unlinkSync(databasePath);
    rmdirSync(directory);
  }
});

describe("Step 2.5 persistent synthetic business state loop", () => {
  it("1 creates one persistent TEAM_SHARED case and three requirements", () => {
    const { databasePath } = database();
    const result = createCase(databasePath);
    expect(result.mutationOutput?.receipt?.case).toMatchObject({ scopeType: "TEAM_SHARED", caseVersion: 1 });
    expect(result.mutationOutput?.receipt?.case.requirements).toHaveLength(3);
  });

  it("2 accepts a missing planned start date without fabricating one", () => {
    const { databasePath } = database();
    expect(createCase(databasePath).mutationOutput?.receipt?.case.plannedStartAt).toBeNull();
  });

  it("3 preserves a supplied planned start date", () => {
    const { databasePath } = database();
    const date = "2026-10-01T09:00:00.000+08:00";
    expect(createCase(databasePath, principal(), "create-date", "测试新员工乙", date)
      .mutationOutput?.receipt?.case.plannedStartAt).toBe(date);
  });

  it.each(["DOCUMENTS", "IT_ACCOUNT", "DEVICE"] as const)(
    "4-6 persists %s completion with evidence and versions", (kind) => {
      const { databasePath } = database();
      const created = createCase(databasePath, principal(), `create-${kind}`)
        .mutationOutput!.receipt!.case;
      const updated = complete(databasePath, principal(), created.caseRef, kind, 1)
        .mutationOutput!.receipt!.case;
      expect(updated.caseVersion).toBe(2);
      expect(updated.requirements.find((item) => item.kind === kind)).toMatchObject({
        status: "completed", version: 2, evidenceValidationRef: null,
        sourceType: "SYNTHETIC_HR_MANUAL_STATEMENT", sourceActorId: principal().actorId
      });
    });

  it("7 reports only a readiness candidate after all three completions", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    complete(databasePath, principal(), created.caseRef, "DOCUMENTS", 1);
    complete(databasePath, principal(), created.caseRef, "IT_ACCOUNT", 2);
    complete(databasePath, principal(), created.caseRef, "DEVICE", 3);
    const store = open(databasePath);
    const card = createSyntheticReadyCard(store, principal(), created.caseRef);
    store.close();
    expect(card).toMatchObject({ suggestedReadinessStatus: "READY_CANDIDATE",
      formalReadinessStatus: null, confirmationStatus: "not_confirmed", sendStatus: "NOT_SENT" });
  });

  it("8 reopens the database and reads the latest state", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    complete(databasePath, principal(), created.caseRef, "DOCUMENTS", 1);
    const store = open(databasePath);
    expect(store.getCase(principal(), created.caseRef)?.caseVersion).toBe(2);
    store.close();
  });

  it("9 returns an idempotent replay for the same create mutation", () => {
    const { databasePath } = database();
    const first = createCase(databasePath, principal(), "same-create").mutationOutput!.receipt!;
    const second = createCase(databasePath, principal(), "same-create").mutationOutput!.receipt!;
    expect(second).toMatchObject({ case: { caseRef: first.case.caseRef }, idempotentReplay: true });
  });

  it("10 rejects a reused mutation ID with a changed payload", () => {
    const { databasePath } = database();
    createCase(databasePath, principal(), "digest-conflict", "测试甲");
    expect(() => createCase(databasePath, principal(), "digest-conflict", "测试乙"))
      .toThrowError(SyntheticCaseStoreError);
  });

  it("11 returns an idempotent replay for the same completion mutation", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    const first = complete(databasePath, principal(), created.caseRef, "DEVICE", 1, 1, "same-update");
    const second = complete(databasePath, principal(), created.caseRef, "DEVICE", 1, 1, "same-update");
    expect(first.mutationOutput?.receipt?.case.caseVersion).toBe(2);
    expect(second.mutationOutput?.receipt?.idempotentReplay).toBe(true);
  });

  it("12 rejects a stale case version", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    const store = open(databasePath);
    store.completeRequirement(principal(), {
      mutationId: "first-direct-update", caseRef: created.caseRef, kind: "DOCUMENTS",
      expectedCaseVersion: 1, expectedRequirementVersion: 1,
      evidenceRef: "runtime-evidence-1", evidenceValidationRef: null,
      sourceVersionRef: "runtime-manual-source-1", sourceType: "SYNTHETIC_HR_MANUAL_STATEMENT",
      sourceActorId: principal().actorId
    });
    expect(() => store.completeRequirement(principal(), {
      mutationId: "stale-case-update", caseRef: created.caseRef, kind: "DEVICE",
      expectedCaseVersion: 1, expectedRequirementVersion: 1,
      evidenceRef: "runtime-evidence-2", evidenceValidationRef: null,
      sourceVersionRef: "runtime-manual-source-2", sourceType: "SYNTHETIC_HR_MANUAL_STATEMENT",
      sourceActorId: principal().actorId
    })).toThrowError(SyntheticCaseStoreError);
    store.close();
  });

  it("13 rejects a stale requirement version", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    const store = open(databasePath);
    expect(() => store.completeRequirement(principal(), {
      mutationId: "stale-requirement-update", caseRef: created.caseRef, kind: "DEVICE",
      expectedCaseVersion: 1, expectedRequirementVersion: 2,
      evidenceRef: "runtime-evidence", evidenceValidationRef: null,
      sourceVersionRef: "runtime-manual-source", sourceType: "SYNTHETIC_HR_MANUAL_STATEMENT",
      sourceActorId: principal().actorId
    })).toThrowError(SyntheticCaseStoreError);
    store.close();
  });

  it("14 denies a principal without synthetic team write scope", () => {
    const { databasePath } = database();
    const readOnly = principal("hr-bot-03", "ou_hr3synthetic");
    expect(() => createCase(databasePath, readOnly, "readonly-create"))
      .toThrowError("SYNTHETIC_MUTATION_NOT_AUTHORIZED");
  });

  it("15 hides the case from a different Team and DataSpace", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    const store = open(databasePath);
    expect(store.getCase(principal("hr-bot-03", "ou_hr3synthetic"), created.caseRef)).toBeNull();
    store.close();
  });

  it("16 rejects forged Team values in RequestContext", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    const forged = { ...principal(), activeTeamId: "hr-onboarding-team-002" };
    const store = open(databasePath);
    expect(store.getCase(forged, created.caseRef)).toBeNull();
    store.close();
  });

  it("17 gives another authorized HR in the same Team continuity", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    const hr2 = principal("hr-bot-02", "ou_hr2synthetic");
    const updated = complete(databasePath, hr2, created.caseRef, "DOCUMENTS", 1);
    expect(updated.mutationOutput?.receipt?.case).toMatchObject({ caseRef: created.caseRef, caseVersion: 2 });
  });

  it("18 resolves a unique candidate name inside the authorized scope", () => {
    const { databasePath } = database();
    createCase(databasePath, principal(), "unique-name", "测试唯一姓名");
    const store = open(databasePath);
    expect(store.resolveCase(principal(), { candidateDisplayName: " 测试唯一姓名 " }).status).toBe("MATCHED");
    store.close();
  });

  it("19 requires clarification when a scoped candidate name is ambiguous", () => {
    const { databasePath } = database();
    createCase(databasePath, principal(), "ambiguous-a", "同名测试员工");
    createCase(databasePath, principal(), "ambiguous-b", "同名测试员工");
    const store = open(databasePath);
    expect(store.resolveCase(principal(), { candidateDisplayName: "同名测试员工" }))
      .toMatchObject({ status: "AMBIGUOUS", case: null, candidateCount: 2 });
    store.close();
  });

  it("20 does not leak a candidate name from another scope", () => {
    const { databasePath } = database();
    createCase(databasePath, principal(), "hidden-name", "仅本团队可见");
    const store = open(databasePath);
    expect(store.resolveCase(principal("hr-bot-03", "ou_hr3synthetic"),
      { candidateDisplayName: "仅本团队可见" }).status).toBe("NOT_FOUND");
    store.close();
  });

  it("21 rolls back the create when audit is unavailable", () => {
    const { databasePath } = database();
    const store = open(databasePath, false);
    expect(() => store.createAcceptedOfferCase(principal(), {
      mutationId: "audit-fail", offerRef: "offer-audit", candidateRef: "candidate-audit",
      candidateDisplayName: "审计失败测试", sourceVersionRef: "synthetic-v1",
      scopeType: "TEAM_SHARED", teamId: principal().activeTeamId
    })).toThrowError("AUDIT_UNAVAILABLE");
    expect(store.listCases(principal())).toHaveLength(0);
    store.close();
  });

  it("22 writes audit events for create and update", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    complete(databasePath, principal(), created.caseRef, "DOCUMENTS", 1);
    const store = open(databasePath);
    expect(store.listAuditEvents(principal(), created.caseRef).map((event) => event.eventType))
      .toEqual(["synthetic_case_created", "synthetic_requirement_completed"]);
    store.close();
  });

  it("23 serves a status Skill from the persisted snapshot", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    complete(databasePath, principal(), created.caseRef, "DOCUMENTS", 1);
    const result = runtime(databasePath).run({ skillId: "onboarding_status_control_pack",
      workflowId: "case_status_inspection", requestContext: principal(),
      businessInput: { caseRef: created.caseRef } });
    expect(result.result).toMatchObject({ status: "COMPLETED", implementationCallCount: 4 });
    const store = open(databasePath);
    expect(store.listAuditEvents(principal(), created.caseRef).at(-1)?.eventType)
      .toBe("synthetic_workflow_case_status_inspection");
    store.close();
  });

  it("24 never changes formal READY or sends an outbound message", () => {
    const { databasePath } = database();
    const created = createCase(databasePath);
    expect(created).toMatchObject({ formalStateChanged: false, outboundMessageSent: false,
      externalSideEffect: false, realCustomerDataProcessed: false });
    expect(created.mutationOutput?.receipt?.case.formalReadinessStatus).toBeNull();
  });

  it("25 keeps the base 18 Capability registry outside the mutation overlay", async () => {
    const { capabilityRegistry } = await import("../src/capabilities/registry.js");
    expect(capabilityRegistry.capabilities).toHaveLength(18);
    expect(capabilityRegistry.capabilities.some((entry) => entry.capabilityId.includes("synthetic"))).toBe(false);
  });

  it("26 returns independent Skill, Gateway, and persistent execution audit evidence", () => {
    const { databasePath } = database();
    const result = createCase(databasePath);
    expect(result.result.independentCapabilityAudit).toBe(true);
    expect(result.auditRefs.skill.length).toBeGreaterThanOrEqual(2);
    expect(result.auditRefs.gateway.length).toBeGreaterThanOrEqual(2);
    expect(result.auditRefs.execution).toEqual([result.mutationOutput!.receipt!.eventRef]);
    expect(new Set([...result.auditRefs.skill, ...result.auditRefs.gateway,
      ...result.auditRefs.execution]).size).toBe(
      result.auditRefs.skill.length + result.auditRefs.gateway.length + result.auditRefs.execution.length);
  });

  it("27 fails closed before mutation when Skill audit is unavailable", () => {
    const { databasePath } = database();
    expect(() => runtime(databasePath, { skill: false }).run({
      skillId: "onboarding_case_intake_pack",
      workflowId: "synthetic_case_create_from_accepted_offer",
      trustedInvocationId: "skill-audit-fail",
      requestContext: principal(),
      businessInput: { candidateDisplayName: "Skill 审计失败", offerAccepted: true }
    })).toThrowError("SKILL_AUDIT_UNAVAILABLE");
    const store = open(databasePath);
    expect(store.listCases(principal())).toHaveLength(0);
    store.close();
  });

  it("28 fails closed before mutation when Gateway audit is unavailable", () => {
    const { databasePath } = database();
    expect(() => runtime(databasePath, { gateway: false }).run({
      skillId: "onboarding_case_intake_pack",
      workflowId: "synthetic_case_create_from_accepted_offer",
      trustedInvocationId: "gateway-audit-fail",
      requestContext: principal(),
      businessInput: { candidateDisplayName: "Gateway 审计失败", offerAccepted: true }
    })).toThrowError("GATEWAY_AUDIT_UNAVAILABLE");
    const store = open(databasePath);
    expect(store.listCases(principal())).toHaveLength(0);
    store.close();
  });

  it("29 rolls back mutation when persistent execution audit is unavailable", () => {
    const { databasePath } = database();
    expect(() => runtime(databasePath, { execution: false }).run({
      skillId: "onboarding_case_intake_pack",
      workflowId: "synthetic_case_create_from_accepted_offer",
      trustedInvocationId: "execution-audit-fail",
      requestContext: principal(),
      businessInput: { candidateDisplayName: "执行审计失败", offerAccepted: true }
    })).toThrowError("AUDIT_UNAVAILABLE");
    const store = open(databasePath);
    expect(store.listCases(principal())).toHaveLength(0);
    store.close();
  });

  it.each(["expectedCaseVersion", "expectedRequirementVersion"])(
    "30-31 strictly rejects model-visible %s", (field) => {
      const { databasePath } = database();
      const created = createCase(databasePath).mutationOutput!.receipt!.case;
      expect(() => runtime(databasePath).run({
        skillId: "onboarding_requirement_tracking_pack",
        workflowId: "synthetic_requirement_completion_update",
        trustedInvocationId: `reject-${field}`,
        requestContext: principal(),
        businessInput: { caseRef: created.caseRef, requirementKind: "DOCUMENTS", [field]: 1 }
      })).toThrow();
    });

  it.each(["evidenceRef", "evidenceValidationRef", "sourceVersionRef"])(
    "32-34 strictly rejects model-visible system provenance field %s", (field) => {
      const { databasePath } = database();
      const created = createCase(databasePath).mutationOutput!.receipt!.case;
      expect(() => runtime(databasePath).run({
        skillId: "onboarding_requirement_tracking_pack",
        workflowId: "synthetic_requirement_completion_update",
        trustedInvocationId: `reject-${field}`,
        requestContext: principal(),
        businessInput: { caseRef: created.caseRef, requirementKind: "DOCUMENTS", [field]: "forged" }
      })).toThrow();
    });

  it.each(["offerRef", "candidateRef", "sourceVersionRef"])(
    "35-37 strictly rejects model-visible Case system reference %s", (field) => {
      const { databasePath } = database();
      expect(() => runtime(databasePath).run({
        skillId: "onboarding_case_intake_pack",
        workflowId: "synthetic_case_create_from_accepted_offer",
        trustedInvocationId: `reject-create-${field}`,
        requestContext: principal(),
        businessInput: { candidateDisplayName: "伪造引用测试", [field]: "forged" }
      })).toThrow();
    });

  it("38 reads current Case and Requirement versions internally before updating", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    const first = complete(databasePath, principal(), created.caseRef, "DOCUMENTS", 999)
      .mutationOutput!.receipt!.case;
    const second = complete(databasePath, principal(), created.caseRef, "IT_ACCOUNT", 0)
      .mutationOutput!.receipt!.case;
    expect(first.caseVersion).toBe(2);
    expect(second.caseVersion).toBe(3);
  });

  it("39 keeps the store transaction fail-closed for a concurrent stale snapshot", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    const firstStore = open(databasePath);
    const secondStore = open(databasePath);
    const stale = secondStore.getCase(principal(), created.caseRef)!;
    firstStore.completeRequirement(principal(), {
      mutationId: "concurrent-first", caseRef: created.caseRef, kind: "DOCUMENTS",
      expectedCaseVersion: stale.caseVersion, expectedRequirementVersion: 1,
      evidenceRef: "manual-first", evidenceValidationRef: null,
      sourceVersionRef: "manual-source-first", sourceType: "SYNTHETIC_HR_MANUAL_STATEMENT",
      sourceActorId: principal().actorId
    });
    expect(() => secondStore.completeRequirement(principal(), {
      mutationId: "concurrent-stale", caseRef: created.caseRef, kind: "IT_ACCOUNT",
      expectedCaseVersion: stale.caseVersion, expectedRequirementVersion: 1,
      evidenceRef: "manual-stale", evidenceValidationRef: null,
      sourceVersionRef: "manual-source-stale", sourceType: "SYNTHETIC_HR_MANUAL_STATEMENT",
      sourceActorId: principal().actorId
    })).toThrowError("OBJECT_VERSION_CONFLICT");
    firstStore.close();
    secondStore.close();
  });

  it("40 records HR manual statement provenance without external validation", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    const updated = complete(databasePath, principal(), created.caseRef, "DEVICE", 1)
      .mutationOutput!.receipt!.case;
    expect(updated.requirements.find((item) => item.kind === "DEVICE")).toMatchObject({
      sourceType: "SYNTHETIC_HR_MANUAL_STATEMENT",
      sourceActorId: principal().actorId,
      evidenceValidationRef: null
    });
  });

  it("41 omits a missing planned start from the persistent case.list projection", () => {
    const { databasePath } = database();
    const created = createCase(databasePath, principal(), "projection-null", "Mark", null)
      .mutationOutput!.receipt!.case;
    complete(databasePath, principal(), created.caseRef, "DOCUMENTS", 1);
    complete(databasePath, principal(), created.caseRef, "IT_ACCOUNT", 2);
    complete(databasePath, principal(), created.caseRef, "DEVICE", 3);

    const output = runtime(databasePath).run({
      skillId: "onboarding_status_control_pack",
      workflowId: "case_workbench_read",
      requestContext: principal(),
      businessInput: { pageSize: 20 }
    });
    const payload = output.result.stepResults[0]!.executionOutcome!.outputPayload as {
      items: Array<Record<string, unknown>>;
    };
    const item = payload.items.find((candidate) => candidate.caseRef === created.caseRef)!;
    expect(output.result.status).toBe("COMPLETED");
    expect(item.caseVersion).toBe(4);
    expect(Object.prototype.hasOwnProperty.call(item, "plannedStartDateCandidate")).toBe(false);
    expect(output).toMatchObject({ formalStateChanged: false, externalSideEffect: false });

    const store = open(databasePath);
    expect(store.getCase(principal(), created.caseRef)).toMatchObject({
      caseVersion: 4,
      plannedStartAt: null
    });
    store.close();
  });

  it("42 preserves a valid planned start in the persistent case.list projection", () => {
    const { databasePath } = database();
    const plannedStartAt = "2026-10-01T01:00:00.000Z";
    const created = createCase(databasePath, principal(), "projection-date", "Lisa", plannedStartAt)
      .mutationOutput!.receipt!.case;
    const output = runtime(databasePath).run({
      skillId: "onboarding_status_control_pack",
      workflowId: "case_workbench_read",
      requestContext: principal(),
      businessInput: { pageSize: 20 }
    });
    const payload = output.result.stepResults[0]!.executionOutcome!.outputPayload as {
      items: Array<Record<string, unknown>>;
    };
    expect(payload.items.find((candidate) => candidate.caseRef === created.caseRef))
      .toMatchObject({ plannedStartDateCandidate: plannedStartAt, caseVersion: 1 });
  });

  it("43 resolves Mark and reads the persistent Version-4 Case plus all Requirement statuses", () => {
    const { databasePath } = database();
    const created = createCase(databasePath, principal(), "turn-e-create", "Mark", null)
      .mutationOutput!.receipt!.case;
    complete(databasePath, principal(), created.caseRef, "DOCUMENTS", 1, 1, "turn-e-documents");
    complete(databasePath, principal(), created.caseRef, "IT_ACCOUNT", 2, 1, "turn-e-account");
    complete(databasePath, principal(), created.caseRef, "DEVICE", 3, 1, "turn-e-device");

    const output = runtime(databasePath).run({
      skillId: "onboarding_status_control_pack",
      workflowId: "case_status_inspection",
      requestContext: principal(),
      businessInput: { candidateDisplayName: "Mark" }
    });
    const caseStatus = output.result.stepResults.find((step) =>
      step.capabilityRef.capabilityId === "hr.onboarding.case.status.read")!
      .executionOutcome!.outputPayload as Record<string, unknown>;
    const requirementStatus = output.result.stepResults.find((step) =>
      step.capabilityRef.capabilityId === "hr.onboarding.requirement.status.read")!
      .executionOutcome!.outputPayload as {
        caseVersion: number;
        requirements: Array<{ requirementType: string; formalStatus: string }>;
      };

    expect(output.result).toMatchObject({
      status: "COMPLETED",
      capabilityRequestCount: 4,
      implementationCallCount: 4
    });
    expect(caseStatus).toMatchObject({
      caseVersion: 4,
      suggestedReadiness: "READY",
      formalReadiness: null
    });
    expect(requirementStatus.caseVersion).toBe(4);
    expect(Object.fromEntries(requirementStatus.requirements.map((item) =>
      [item.requirementType, item.formalStatus]))).toEqual({
      DOCUMENTS: "completed",
      IT_ACCOUNT: "completed",
      DEVICE: "completed"
    });
    expect(output).toMatchObject({
      formalStateChanged: false,
      outboundMessageSent: false,
      externalSideEffect: false
    });

    const store = open(databasePath);
    expect(store.getCase(principal(), created.caseRef)).toMatchObject({
      caseVersion: 4,
      plannedStartAt: null,
      formalReadinessStatus: null
    });
    store.close();
  });

  it("44 fails closed when the candidate is not found in the authorized scope", () => {
    const { databasePath } = database();
    createCase(databasePath, principal(), "not-found-base", "Mark");
    expect(() => runtime(databasePath).run({
      skillId: "onboarding_status_control_pack",
      workflowId: "case_status_inspection",
      requestContext: principal(),
      businessInput: { candidateDisplayName: "Lisa" }
    })).toThrowError("CASE_NOT_FOUND");
  });

  it("45 fails closed when two scoped Cases share the candidate name", () => {
    const { databasePath } = database();
    createCase(databasePath, principal(), "ambiguous-status-a", "Mark");
    createCase(databasePath, principal(), "ambiguous-status-b", "Mark");
    expect(() => runtime(databasePath).run({
      skillId: "onboarding_status_control_pack",
      workflowId: "case_status_inspection",
      requestContext: principal(),
      businessInput: { candidateDisplayName: "Mark" }
    })).toThrowError("CASE_REFERENCE_AMBIGUOUS");
  });

  it("46 excludes another Team and Tenant from status candidate resolution", () => {
    const { databasePath } = database();
    createCase(databasePath, principal(), "cross-scope-status", "Mark");
    expect(() => runtime(databasePath).run({
      skillId: "onboarding_status_control_pack",
      workflowId: "case_status_inspection",
      requestContext: principal("hr-bot-03", "ou_hr3synthetic"),
      businessInput: { candidateDisplayName: "Mark" }
    })).toThrowError("CASE_NOT_FOUND");
  });

  it("47 resolves Mark and delivers a Version-4 Ready Card draft without formal or external effects", () => {
    const { databasePath } = database();
    const created = createCase(databasePath, principal(), "turn-f-create", "Mark", null)
      .mutationOutput!.receipt!.case;
    complete(databasePath, principal(), created.caseRef, "DOCUMENTS", 1, 1, "turn-f-documents");
    complete(databasePath, principal(), created.caseRef, "IT_ACCOUNT", 2, 1, "turn-f-account");
    complete(databasePath, principal(), created.caseRef, "DEVICE", 3, 1, "turn-f-device");

    const output = runtime(databasePath).run({
      skillId: "onboarding_delivery_pack",
      workflowId: "day1_ready_card_candidate",
      requestContext: principal(),
      businessInput: { candidateDisplayName: "Mark", language: "zh-CN" }
    });
    const evaluation = output.result.stepResults.find((step) =>
      step.capabilityRef.capabilityId === "hr.onboarding.readiness.evaluate")!
      .executionOutcome!.outputPayload as Record<string, unknown>;
    const card = output.result.stepResults.find((step) =>
      step.capabilityRef.capabilityId === "hr.onboarding.ready_card.draft")!
      .executionOutcome!.outputPayload as Record<string, unknown>;

    expect(output.result).toMatchObject({
      status: "COMPLETED",
      capabilityRequestCount: 2,
      implementationCallCount: 2
    });
    expect(evaluation).toMatchObject({
      caseRef: created.caseRef,
      caseVersion: 4,
      result: "ELIGIBLE",
      blockingRequirementRefs: [],
      unknownRefs: [],
      conflictRefs: [],
      formalReadinessChanged: false
    });
    expect(card).toMatchObject({
      artifactType: "DAY1_READY_CARD_DRAFT",
      artifactStatus: "DRAFT",
      sendStatus: "NOT_SENT",
      formalStateChanged: false,
      externalSideEffect: false
    });
    expect(output).toMatchObject({
      formalStateChanged: false,
      outboundMessageSent: false,
      externalSideEffect: false
    });

    const store = open(databasePath);
    expect(store.getCase(principal(), created.caseRef)).toMatchObject({
      caseVersion: 4,
      plannedStartAt: null,
      formalReadinessStatus: null
    });
    store.close();
  });
});
