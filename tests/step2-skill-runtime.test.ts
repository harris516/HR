import { describe, expect, it } from "vitest";
import { InMemoryCapabilityGatewayAuditSink } from "../src/audit/capability-audit.js";
import { CapabilityGateway } from "../src/capabilities/gateway.js";
import { capabilityRegistry } from "../src/capabilities/registry.js";
import {
  createFeishuTestContext,
  syntheticTrustedFeishuPrincipals
} from "../src/mvp/feishu-test-context.js";
import { Step2SyntheticSkillRuntime } from "../src/skills/step2-runtime.js";
import {
  step2SyntheticActivationProfile,
  validateStep2SyntheticActivationProfile
} from "../src/skills/step2-activation-profile.js";

const now = new Date("2026-09-24T01:00:00.000Z");

function context(accountId = "hr-bot-01", senderId = "ou_hr1synthetic") {
  return createFeishuTestContext({
    agentAccountId: accountId,
    requesterSenderId: senderId,
    trustedPrincipals: syntheticTrustedFeishuPrincipals,
    now
  });
}

function runtime(auditAvailability?: { skill?: boolean; gateway?: boolean; execution?: boolean }) {
  let id = 0;
  return new Step2SyntheticSkillRuntime({
    allowSyntheticTestExecution: true,
    now: () => now,
    idFactory: () => `step2-test-${++id}`,
    ...(auditAvailability === undefined ? {} : { auditAvailability })
  });
}

describe("Step 2 synthetic Skill runtime activation", () => {
  it("keeps the base Capability Registry closed and activates exactly the reviewed safe overlay", () => {
    expect(capabilityRegistry.capabilities).toHaveLength(18);
    expect(capabilityRegistry.capabilities.every((entry) =>
      entry.status === "PLANNED_TEST_STUB" && !entry.featureFlag.enabled &&
      entry.implementationBindingRef === null && entry.physicalToolBindingRefs.length === 0 &&
      entry.connectorBindingRefs.length === 0)).toBe(true);
    expect(validateStep2SyntheticActivationProfile(step2SyntheticActivationProfile)).toMatchObject({
      environment: "test",
      syntheticOnly: true,
      requestContextVersion: "2",
      formalStateChangeAllowed: false,
      outboundMessageAllowed: false,
      externalSideEffectAllowed: false
    });
    expect(step2SyntheticActivationProfile.skillIds).toHaveLength(6);
    expect(step2SyntheticActivationProfile.workflowIds).toHaveLength(14);
    expect(step2SyntheticActivationProfile.capabilityIds).toHaveLength(18);
  });

  it("leaves an ordinary Gateway default-closed", () => {
    const gateway = new CapabilityGateway({
      auditSink: new InMemoryCapabilityGatewayAuditSink(),
      now: () => now
    });
    expect(gateway).toBeDefined();
    expect(capabilityRegistry.capabilities.every((entry) => !entry.featureFlag.enabled)).toBe(true);
  });
});

describe("Step 2 controlled Skill execution", () => {
  const workflowCases = [
    ["onboarding_task_navigation_pack", "navigation_route_handoff", { requestText: "查看合成入职事项" }],
    ["onboarding_case_intake_pack", "case_intake_candidate", { handoffRef: "handoff-demo-001", expectedSourceVersion: "ats-offer-v3", language: "zh-CN" }],
    ["onboarding_requirement_tracking_pack", "requirement_completion_candidate", { caseRef: "case-demo-001", expectedCaseVersion: 7, requirementRef: "requirement-equipment-001", expectedRequirementVersion: 3 }],
    ["onboarding_status_control_pack", "case_workbench_read", { pageSize: 20 }],
    ["onboarding_status_control_pack", "case_status_inspection", { caseRef: "case-demo-001" }],
    ["onboarding_status_control_pack", "risk_workbox", { caseRef: "case-demo-001", pageSize: 20 }],
    ["onboarding_coordination_pack", "responsibility_reminder_draft", { caseRef: "case-demo-001", expectedCaseVersion: 7, language: "zh-CN" }],
    ["onboarding_coordination_pack", "responsibility_escalation_draft", { caseRef: "case-demo-001", expectedCaseVersion: 7, language: "zh-CN" }],
    ["onboarding_coordination_pack", "practice_review_draft", { caseRef: "case-demo-001", expectedCaseVersion: 7, language: "zh-CN" }],
    ["onboarding_delivery_pack", "day1_ready_card_candidate", { caseRef: "case-demo-001", language: "zh-CN" }],
    ["onboarding_delivery_pack", "readiness_revalidation", { caseRef: "case-demo-001", expectedCaseVersion: 7, previousEvaluationRef: "evaluation-readiness-001", invalidationTriggerRef: "trigger-source-refresh-001" }],
    ["onboarding_delivery_pack", "artifact_center_read", { caseRef: "case-demo-001", pageSize: 20 }]
  ] as const;

  it.each(workflowCases)("runs the approved %s/%s workflow without generic fallback", (skillId, workflowId, businessInput) => {
    const output = runtime().run({ skillId, workflowId, requestContext: context(), businessInput });
    expect(output.result.status).toBe("COMPLETED");
    expect(output.result.workflowId).toBe(workflowId);
    expect(output.result.unsafeToolFallbackCount).toBe(0);
    expect(output.formalStateChanged).toBe(false);
    expect(output.outboundMessageSent).toBe(false);
    expect(output.externalSideEffect).toBe(false);
    expect(output.realCustomerDataProcessed).toBe(false);
    expect(output.implementationCallCount).toBe(output.result.capabilityRequestCount);
  });

  it("runs the delivery Hero Flow only through two independently audited Gateway steps", () => {
    const output = runtime().run({
      skillId: "onboarding_delivery_pack",
      workflowId: "day1_ready_card_candidate",
      requestContext: context(),
      businessInput: { caseRef: "case-demo-001", language: "zh-CN" }
    });
    expect(output.result).toMatchObject({
      status: "COMPLETED",
      workflowId: "day1_ready_card_candidate",
      capabilityRequestCount: 2,
      implementationCallCount: 2,
      independentCapabilityAudit: true,
      formalStateChanged: false,
      externalSideEffect: false,
      outboundMessageSent: false,
      realCustomerDataProcessed: false,
      unsafeToolFallbackCount: 0
    });
    expect(output.result.stepResults.map((step) => step.capabilityRef.capabilityId)).toEqual([
      "hr.onboarding.readiness.evaluate",
      "hr.onboarding.ready_card.draft"
    ]);
    expect(output.auditRefs.gateway).toHaveLength(4);
    expect(output.auditRefs.execution).toHaveLength(4);
    expect(output.auditRefs.skill.length).toBeGreaterThanOrEqual(4);
    expect(output.implementationCallCount).toBe(2);
  });

  it("runs a second status-inspection Skill path through all four Capability gates", () => {
    const output = runtime().run({
      skillId: "onboarding_status_control_pack",
      workflowId: "case_status_inspection",
      requestContext: context(),
      businessInput: { caseRef: "case-demo-001" }
    });
    expect(output.result.status).toBe("COMPLETED");
    expect(output.result.stepResults).toHaveLength(4);
    expect(output.implementationCallCount).toBe(4);
    expect(output.auditRefs.gateway).toHaveLength(8);
    expect(output.auditRefs.execution).toHaveLength(8);
  });

  it("rejects stale Context v1 before compiling any Skill request", () => {
    expect(() => runtime().run({
      skillId: "onboarding_delivery_pack",
      workflowId: "day1_ready_card_candidate",
      requestContext: { ...context(), contextVersion: "1" },
      businessInput: { caseRef: "case-demo-001", language: "zh-CN" }
    })).toThrow();
  });

  it("rejects Skill/workflow mismatch and arbitrary Capability injection", () => {
    expect(() => runtime().run({
      skillId: "onboarding_status_control_pack",
      workflowId: "day1_ready_card_candidate",
      requestContext: context(),
      businessInput: { caseRef: "case-demo-001", language: "zh-CN" }
    })).toThrow("Skill workflow is unavailable");
    expect(() => runtime().run({
      skillId: "onboarding_delivery_pack",
      workflowId: "day1_ready_card_candidate",
      requestContext: context(),
      businessInput: {
        caseRef: "case-demo-001",
        expectedCaseVersion: 7,
        language: "zh-CN",
        capabilityId: "hr.onboarding.ready.confirm"
      }
    })).toThrow();
  });

  it("rejects attempts to provide Capability requests or authorization decisions at runtime ingress", () => {
    expect(() => runtime().run({
      skillId: "onboarding_delivery_pack",
      workflowId: "day1_ready_card_candidate",
      requestContext: context(),
      businessInput: { caseRef: "case-demo-001", expectedCaseVersion: 7, language: "zh-CN" },
      capabilityRequests: [{ capabilityId: "hr.onboarding.ready.confirm" }],
      authorizationDecision: { result: "allow" }
    })).toThrow();
  });

  it.each([
    ["skill", { skill: false }],
    ["gateway", { gateway: false }],
    ["execution", { execution: false }]
  ] as const)("fails closed when %s audit is unavailable", (_name, auditAvailability) => {
    const output = runtime(auditAvailability).run({
      skillId: "onboarding_delivery_pack",
      workflowId: "day1_ready_card_candidate",
      requestContext: context(),
      businessInput: { caseRef: "case-demo-001", language: "zh-CN" }
    });
    expect(["FAILED", "DENIED"]).toContain(output.result.status);
    expect(output.result.reasonCodes).toContain("AUDIT_UNAVAILABLE");
    expect(output.implementationCallCount).toBe(0);
    expect(output.formalStateChanged).toBe(false);
    expect(output.outboundMessageSent).toBe(false);
    expect(output.externalSideEffect).toBe(false);
  });

  it("keeps different trusted Principals in different Tenant, Actor and Session contexts", () => {
    const hr1 = context("hr-bot-01", "ou_hr1synthetic");
    const hr2 = context("hr-bot-02", "ou_hr2synthetic");
    expect(hr1.tenantId).not.toBe(hr2.tenantId);
    expect(hr1.actorId).not.toBe(hr2.actorId);
    expect(hr1.sessionId).not.toBe(hr2.sessionId);
    expect(hr1.activeTeamId).toBe(hr2.activeTeamId);
  });
});
