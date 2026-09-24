import { createFeishuTestContext, syntheticTrustedFeishuPrincipals } from "../mvp/feishu-test-context.js";
import { Step2SyntheticSkillRuntime } from "../skills/step2-runtime.js";

const now = new Date("2026-09-24T01:00:00.000Z");
let id = 0;
const runtime = new Step2SyntheticSkillRuntime({
  allowSyntheticTestExecution: true,
  now: () => now,
  idFactory: () => `step2-smoke-${++id}`
});
const requestContext = createFeishuTestContext({
  agentAccountId: "hr-bot-01",
  requesterSenderId: "ou_hr1synthetic",
  trustedPrincipals: syntheticTrustedFeishuPrincipals,
  sessionRef: "session-step2-smoke",
  now
});

const hero = runtime.run({
  skillId: "onboarding_delivery_pack",
  workflowId: "day1_ready_card_candidate",
  requestContext,
  businessInput: {
    caseRef: "case-demo-001",
    expectedCaseVersion: 7,
    language: "zh-CN"
  }
});
const secondary = runtime.run({
  skillId: "onboarding_status_control_pack",
  workflowId: "case_status_inspection",
  requestContext,
  businessInput: {
    caseRef: "case-demo-001",
    expectedCaseVersion: 7
  }
});

for (const output of [hero, secondary]) {
  if (output.result.status !== "COMPLETED" ||
    output.implementationCallCount !== output.result.capabilityRequestCount ||
    output.auditRefs.skill.length === 0 || output.auditRefs.gateway.length === 0 ||
    output.auditRefs.execution.length === 0 || output.formalStateChanged ||
    output.outboundMessageSent || output.externalSideEffect ||
    output.realCustomerDataProcessed || output.unsafeToolFallbackCount !== 0) {
    throw new Error("Step 2 Skill runtime smoke failed");
  }
}

console.log(JSON.stringify({
  status: "step2_skill_runtime_smoke_passed",
  activationProfileId: hero.activationProfileId,
  requestContextVersion: requestContext.contextVersion,
  hero: {
    skillId: hero.result.skillRef.skillId,
    workflowId: hero.result.workflowId,
    status: hero.result.status,
    capabilityRequestCount: hero.result.capabilityRequestCount,
    implementationCallCount: hero.implementationCallCount,
    auditEventCounts: {
      skill: hero.auditRefs.skill.length,
      gateway: hero.auditRefs.gateway.length,
      execution: hero.auditRefs.execution.length
    }
  },
  secondary: {
    skillId: secondary.result.skillRef.skillId,
    workflowId: secondary.result.workflowId,
    status: secondary.result.status,
    capabilityRequestCount: secondary.result.capabilityRequestCount,
    implementationCallCount: secondary.implementationCallCount,
    auditEventCounts: {
      skill: secondary.auditRefs.skill.length,
      gateway: secondary.auditRefs.gateway.length,
      execution: secondary.auditRefs.execution.length
    }
  },
  formalStateChanged: false,
  outboundMessageSent: false,
  externalSideEffect: false,
  realCustomerDataProcessed: false,
  unsafeToolFallbackCount: 0
}, null, 2));
