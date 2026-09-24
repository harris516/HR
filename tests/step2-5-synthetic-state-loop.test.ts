import { mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
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

function runtime(databasePath: string, audit = true): Step2SyntheticSkillRuntime {
  let id = 0;
  return new Step2SyntheticSkillRuntime({
    allowSyntheticTestExecution: true,
    databasePath,
    repositoryRoot: resolve("."),
    trustedTeamMemberships: syntheticTrustedFeishuPrincipals,
    now: () => fixedNow,
    idFactory: () => `step25-${++id}`,
    auditAvailability: { execution: audit }
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
      offerRef: `offer-${mutationId}`,
      candidateRef: `candidate-${mutationId}`,
      candidateDisplayName,
      plannedStartAt,
      sourceVersionRef: "synthetic-offer-v1"
    }
  });
}

function complete(databasePath: string, context: RequestContext, caseRef: string,
  kind: "DOCUMENTS" | "IT_ACCOUNT" | "DEVICE", caseVersion: number,
  requirementVersion = 1, mutationId = `mutation-${kind.toLowerCase()}`) {
  return runtime(databasePath).run({
    skillId: "onboarding_requirement_tracking_pack",
    workflowId: "synthetic_requirement_completion_update",
    trustedInvocationId: mutationId,
    requestContext: context,
    businessInput: {
      caseRef, requirementKind: kind, expectedCaseVersion: caseVersion,
      expectedRequirementVersion: requirementVersion,
      evidenceRef: `synthetic-evidence-${kind.toLowerCase()}`,
      evidenceValidationRef: `synthetic-validation-${kind.toLowerCase()}`,
      sourceVersionRef: `synthetic-update-${kind.toLowerCase()}-v1`
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
    unlinkSync(join(directory, "synthetic.sqlite"));
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
        status: "completed", version: 2, evidenceValidationRef: `synthetic-validation-${kind.toLowerCase()}`
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
    complete(databasePath, principal(), created.caseRef, "DOCUMENTS", 1);
    expect(() => complete(databasePath, principal(), created.caseRef, "DEVICE", 1))
      .toThrowError(SyntheticCaseStoreError);
  });

  it("13 rejects a stale requirement version", () => {
    const { databasePath } = database();
    const created = createCase(databasePath).mutationOutput!.receipt!.case;
    expect(() => complete(databasePath, principal(), created.caseRef, "DEVICE", 1, 2))
      .toThrowError(SyntheticCaseStoreError);
  });

  it("14 denies a principal without synthetic team write scope", () => {
    const { databasePath } = database();
    const readOnly = principal("hr-bot-03", "ou_hr3synthetic");
    const result = createCase(databasePath, readOnly, "readonly-create");
    expect(result.mutationOutput).toMatchObject({ decision: "DENY", implementationCallCount: 0 });
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
      businessInput: { caseRef: created.caseRef, expectedCaseVersion: 2 } });
    expect(result.result).toMatchObject({ status: "COMPLETED", implementationCallCount: 3 });
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
});
