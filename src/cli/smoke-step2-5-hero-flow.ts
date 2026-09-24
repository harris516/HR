import { mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createFeishuTestContext, syntheticTrustedFeishuPrincipals } from "../mvp/feishu-test-context.js";
import { SyntheticCaseStore } from "../mvp/synthetic-case-store.js";
import { createSyntheticReadyCard } from "../mvp/synthetic-ready-card.js";
import { Step2SyntheticSkillRuntime } from "../skills/step2-runtime.js";

const directory = mkdtempSync(join(tmpdir(), "hr-step25-smoke-"));
const databasePath = join(directory, "synthetic.sqlite");
const now = new Date("2026-09-24T04:00:00.000Z");
const context = createFeishuTestContext({
  agentAccountId: "hr-bot-01",
  requesterSenderId: "ou_hr1synthetic",
  trustedPrincipals: syntheticTrustedFeishuPrincipals,
  now
});

function runtime() {
  return new Step2SyntheticSkillRuntime({
    allowSyntheticTestExecution: true,
    databasePath,
    repositoryRoot: resolve("."),
    trustedTeamMemberships: syntheticTrustedFeishuPrincipals,
    now: () => now
  });
}

try {
  const create = runtime().run({
    skillId: "onboarding_case_intake_pack",
    workflowId: "synthetic_case_create_from_accepted_offer",
    trustedInvocationId: "smoke-turn-a",
    requestContext: context,
    businessInput: { offerRef: "offer-smoke-mark", candidateRef: "candidate-smoke-mark",
      candidateDisplayName: "Mark（合成测试）", sourceVersionRef: "synthetic-offer-smoke-v1" }
  });
  const caseRef = create.mutationOutput?.receipt?.case.caseRef;
  if (caseRef === undefined) throw new Error("Turn A did not create a Case");
  for (const [index, kind] of (["DOCUMENTS", "IT_ACCOUNT", "DEVICE"] as const).entries()) {
    const update = runtime().run({
      skillId: "onboarding_requirement_tracking_pack",
      workflowId: "synthetic_requirement_completion_update",
      trustedInvocationId: `smoke-turn-${String.fromCharCode(98 + index)}`,
      requestContext: context,
      businessInput: { caseRef, requirementKind: kind, expectedCaseVersion: index + 1,
        expectedRequirementVersion: 1, evidenceRef: `synthetic-evidence-${kind.toLowerCase()}`,
        evidenceValidationRef: `synthetic-validation-${kind.toLowerCase()}`,
        sourceVersionRef: `synthetic-update-${kind.toLowerCase()}-v1` }
    });
    if (update.result.status !== "COMPLETED") throw new Error(`Turn ${index + 2} failed`);
  }
  const status = runtime().run({
    skillId: "onboarding_status_control_pack",
    workflowId: "case_status_inspection",
    requestContext: context,
    businessInput: { caseRef, expectedCaseVersion: 4 }
  });
  const delivery = runtime().run({
    skillId: "onboarding_delivery_pack",
    workflowId: "day1_ready_card_candidate",
    requestContext: context,
    businessInput: { caseRef, expectedCaseVersion: 4, language: "zh-CN" }
  });
  const store = new SyntheticCaseStore({ databasePath, repositoryRoot: resolve("."),
    allowSyntheticTestStorage: true, trustedTeamMemberships: syntheticTrustedFeishuPrincipals,
    now: () => now });
  const card = createSyntheticReadyCard(store, context, caseRef);
  const auditEventCount = store.countAuditEvents(context, caseRef);
  store.close();
  if (status.result.status !== "COMPLETED" || delivery.result.status !== "COMPLETED" ||
    card.suggestedReadinessStatus !== "READY_CANDIDATE" || card.formalReadinessStatus !== null) {
    throw new Error("Hero Flow did not close safely");
  }
  console.log(JSON.stringify({ status: "step2_5_hero_flow_passed", caseRef, caseVersion: 4,
    requirementCount: 3, suggestedReadiness: card.suggestedReadinessStatus,
    formalReadiness: card.formalReadinessStatus, confirmationStatus: card.confirmationStatus,
    auditEventCount, outboundMessageSent: false, realCustomerDataProcessed: false }, null, 2));
} finally {
  unlinkSync(databasePath);
  rmdirSync(directory);
}

