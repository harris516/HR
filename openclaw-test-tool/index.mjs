import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { createFeishuTestContext, resolveTrustedFeishuPrincipal } from "./lib/mvp/feishu-test-context.js";
import { SyntheticCaseStore } from "./lib/mvp/synthetic-case-store.js";
import { createSyntheticReadyCard } from "./lib/mvp/synthetic-ready-card.js";
import { Step2SyntheticSkillRuntime } from "./lib/skills/step2-runtime.js";
import { evaluateCaseIntakeRouting } from "./lib/skills/case-intake-routing-contract.js";

const legacyToolName = "aibang_hr_onboarding_test_ready_card";
const runtimeToolNames = {
  taskNavigation: "aibang_hr_onboarding_task_navigation",
  caseIntake: "aibang_hr_onboarding_case_intake",
  requirementTracking: "aibang_hr_onboarding_requirement_tracking",
  statusControl: "aibang_hr_onboarding_status_control",
  coordination: "aibang_hr_onboarding_coordination",
  delivery: "aibang_hr_onboarding_delivery"
};

const legacyParameters = Type.Object({
  caseRef: Type.String({ minLength: 1, maxLength: 128, description: "Synthetic case reference from the test seed." })
}, { additionalProperties: false });

const ref = () => Type.String({ minLength: 1, maxLength: 128 });
const version = () => Type.Integer({ minimum: 0 });
const language = () => Type.Optional(Type.String({ minLength: 2, maxLength: 16 }));
const pageSize = () => Type.Optional(Type.Integer({ minimum: 1, maximum: 50 }));

const taskNavigationParameters = Type.Object({ requestText: Type.String({ minLength: 1, maxLength: 2000 }) }, { additionalProperties: false });
const caseIntakeParameters = Type.Union([
  Type.Object({ workflowId: Type.Literal("case_intake_candidate"), handoffRef: ref(), expectedSourceVersion: Type.Optional(ref()), language: language() }, { additionalProperties: false }),
  Type.Object({ workflowId: Type.Literal("synthetic_case_create_from_accepted_offer"), candidateDisplayName: Type.String({ minLength: 1, maxLength: 128 }), offerAccepted: Type.Literal(true), plannedStartAt: Type.Optional(Type.Union([Type.String({ format: "date-time" }), Type.Null()])), language: language() }, { additionalProperties: false })
]);
const requirementTrackingParameters = Type.Union([
  Type.Object({ workflowId: Type.Literal("requirement_completion_candidate"), caseRef: ref(), requirementRef: ref(), expectedCaseVersion: Type.Optional(version()), expectedRequirementVersion: Type.Optional(version()) }, { additionalProperties: false }),
  Type.Object({ workflowId: Type.Literal("synthetic_requirement_completion_update"), caseRef: Type.Optional(ref()), candidateDisplayName: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })), requirementKind: Type.Union([Type.Literal("DOCUMENTS"), Type.Literal("IT_ACCOUNT"), Type.Literal("DEVICE")]), language: language() }, { additionalProperties: false })
]);
const statusControlParameters = Type.Union([
  Type.Object({ workflowId: Type.Literal("case_workbench_read"), pageSize: pageSize() }, { additionalProperties: false }),
  Type.Object({ workflowId: Type.Literal("case_status_inspection"), caseRef: ref(), expectedCaseVersion: Type.Optional(version()) }, { additionalProperties: false }),
  Type.Object({ workflowId: Type.Literal("risk_workbox"), caseRef: ref(), pageSize: pageSize() }, { additionalProperties: false })
]);
const coordinationParameters = Type.Union([
  Type.Object({ workflowId: Type.Literal("responsibility_reminder_draft"), caseRef: ref(), expectedCaseVersion: Type.Optional(version()), language: language() }, { additionalProperties: false }),
  Type.Object({ workflowId: Type.Literal("responsibility_escalation_draft"), caseRef: ref(), expectedCaseVersion: Type.Optional(version()), language: language() }, { additionalProperties: false }),
  Type.Object({ workflowId: Type.Literal("practice_review_draft"), caseRef: ref(), expectedCaseVersion: Type.Optional(version()), language: language() }, { additionalProperties: false })
]);
const deliveryParameters = Type.Union([
  Type.Object({ workflowId: Type.Literal("day1_ready_card_candidate"), caseRef: ref(), expectedCaseVersion: Type.Optional(version()), language: language() }, { additionalProperties: false }),
  Type.Object({ workflowId: Type.Literal("readiness_revalidation"), caseRef: ref(), expectedCaseVersion: Type.Optional(version()), previousEvaluationRef: ref(), invalidationTriggerRef: ref() }, { additionalProperties: false }),
  Type.Object({ workflowId: Type.Literal("artifact_center_read"), caseRef: ref(), pageSize: pageSize() }, { additionalProperties: false })
]);

function isTrustedToolContext(toolContext, trustedPrincipals) {
  if (toolContext.agentId !== "aibang-hr-onboarding-agent" ||
    toolContext.messageChannel !== "feishu" || !Array.isArray(trustedPrincipals)) return false;
  try {
    resolveTrustedFeishuPrincipal({
      agentAccountId: toolContext.agentAccountId,
      requesterSenderId: toolContext.requesterSenderId,
      trustedPrincipals
    });
    return true;
  } catch {
    return false;
  }
}

function runtimeTool(tool, { name, description, parameters, skillId, workflowId }) {
  return tool({
    name,
    description,
    parameters,
    optional: true,
    factory({ api, toolContext }) {
      const config = api.pluginConfig ?? {};
      if (!isTrustedToolContext(toolContext, config.trustedPrincipals)) return null;
      return {
        name,
        description,
        parameters,
        async execute(_id, params) {
          try {
            const requestContext = createFeishuTestContext({
              agentAccountId: toolContext.agentAccountId,
              requesterSenderId: toolContext.requesterSenderId,
              trustedPrincipals: config.trustedPrincipals
            });
            const runtime = new Step2SyntheticSkillRuntime({
              allowSyntheticTestExecution: true,
              databasePath: config.databasePath,
              repositoryRoot: config.repositoryRoot,
              trustedTeamMemberships: config.trustedPrincipals
            });
            const selectedWorkflowId = typeof workflowId === "function" ? workflowId(params) : workflowId;
            const businessInput = { ...params };
            delete businessInput.workflowId;
            const result = runtime.run({ skillId, workflowId: selectedWorkflowId, requestContext,
              trustedInvocationId: _id, businessInput });
            const navigationDecision = selectedWorkflowId === "navigation_route_handoff"
              ? evaluateCaseIntakeRouting(businessInput.requestText)
              : undefined;
            return { content: [{ type: "text", text: JSON.stringify({ ...result,
              ...(navigationDecision === undefined ? {} : { navigationDecision }) }) }] };
          } catch (error) {
            api.logger.warn(`Step 2 Skill runtime stopped: ${error instanceof Error ? error.name : "unknown"}`);
            return { content: [{ type: "text", text: "无法完成该合成入职任务；请核对案例、版本或测试配置。未执行正式状态变更。" }], isError: true };
          }
        }
      };
    }
  });
}

export default defineToolPlugin({
  id: "aibang-hr-onboarding-test",
  name: "Aibang HR Onboarding Synthetic Skill Runtime",
  description: "Run controlled synthetic HR onboarding Skills and retain the deprecated Step 1 compatibility tool.",
  configSchema: Type.Object({
    trustedPrincipals: Type.Array(Type.Object({
      accountId: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9_-]*$" }),
      senderId: Type.String({ pattern: "^ou_[A-Za-z0-9]+$" }),
      tenantId: Type.String({ minLength: 1 }),
      dataSpaceId: Type.String({ minLength: 1 }),
      actorId: Type.String({ minLength: 1 }),
      activeTeamId: Type.String({ minLength: 1 }),
      teamMembershipRef: Type.String({ minLength: 1 }),
      roles: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
      scopeGrantRefs: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })
    }, { additionalProperties: false }), { minItems: 1 }),
    databasePath: Type.String({ pattern: "^/" }),
    repositoryRoot: Type.String({ pattern: "^/" })
  }, { additionalProperties: false }),
  tools: (tool) => [
    runtimeTool(tool, {
      name: runtimeToolNames.taskNavigation,
      description: "Identify a synthetic onboarding request and return a controlled Skill/workflow recommendation. Synthetic test + resolved candidate + accepted Offer + explicit Case creation routes to synthetic_case_create_from_accepted_offer; a missing plannedStartAt does not block that route.",
      parameters: taskNavigationParameters,
      skillId: "onboarding_task_navigation_pack",
      workflowId: "navigation_route_handoff"
    }),
    runtimeTool(tool, {
      name: runtimeToolNames.caseIntake,
      description: "Supports two distinct paths: use workflowId=synthetic_case_create_from_accepted_offer for synthetic test data with an accepted Offer and an explicit request to create a Case (plannedStartAt optional); use case_intake_candidate only to review an existing Handoff and produce an Intake draft.",
      parameters: caseIntakeParameters,
      skillId: "onboarding_case_intake_pack",
      workflowId: (params) => params.workflowId
    }),
    runtimeTool(tool, {
      name: runtimeToolNames.requirementTracking,
      description: "Persist an explicitly requested synthetic requirement completion, or evaluate a completion candidate.",
      parameters: requirementTrackingParameters,
      skillId: "onboarding_requirement_tracking_pack",
      workflowId: (params) => params.workflowId
    }),
    runtimeTool(tool, {
      name: runtimeToolNames.statusControl,
      description: "Read a controlled synthetic onboarding workbench, case status, evidence, audit, or risk view.",
      parameters: statusControlParameters,
      skillId: "onboarding_status_control_pack",
      workflowId: (params) => params.workflowId
    }),
    runtimeTool(tool, {
      name: runtimeToolNames.coordination,
      description: "Create a synthetic reminder, escalation, or review-request draft without sending it.",
      parameters: coordinationParameters,
      skillId: "onboarding_coordination_pack",
      workflowId: (params) => params.workflowId
    }),
    runtimeTool(tool, {
      name: runtimeToolNames.delivery,
      description: "Run controlled synthetic readiness, revalidation, or artifact workflows; formal READY remains unchanged.",
      parameters: deliveryParameters,
      skillId: "onboarding_delivery_pack",
      workflowId: (params) => params.workflowId
    }),
    tool({
    name: legacyToolName,
    description: "Deprecated compatibility-only Step 1 Ready-card tool. Use aibang_hr_onboarding_delivery for new flows.",
    parameters: legacyParameters,
    optional: true,
    factory({ api, toolContext }) {
      const config = api.pluginConfig ?? {};
      if (!isTrustedToolContext(toolContext, config.trustedPrincipals)) return null;
      return {
        name: legacyToolName,
        description: "Deprecated compatibility-only Step 1 Ready-card tool. Use aibang_hr_onboarding_delivery for new flows.",
        parameters: legacyParameters,
        async execute(_id, params) {
          let store;
          try {
            const context = createFeishuTestContext({
              agentAccountId: toolContext.agentAccountId,
              requesterSenderId: toolContext.requesterSenderId,
              trustedPrincipals: config.trustedPrincipals
            });
            store = new SyntheticCaseStore({
              databasePath: config.databasePath,
              repositoryRoot: config.repositoryRoot,
              allowSyntheticTestStorage: true,
              trustedTeamMemberships: config.trustedPrincipals
            });
            const card = createSyntheticReadyCard(store, context, params.caseRef);
            return { content: [{ type: "text", text: JSON.stringify(card) }] };
          } catch (error) {
            api.logger.warn(`Synthetic Ready card tool stopped: ${error instanceof Error ? error.name : "unknown"}`);
            return { content: [{ type: "text", text: "无法读取该合成测试案例；请核对案例编号或测试配置。未执行正式状态变更。" }], isError: true };
          } finally {
            store?.close();
          }
        }
      };
    }
  })]
});
