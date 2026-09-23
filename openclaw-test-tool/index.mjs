import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { createFeishuTestContext, resolveTrustedFeishuPrincipal } from "./lib/mvp/feishu-test-context.js";
import { SyntheticCaseStore } from "./lib/mvp/synthetic-case-store.js";
import { createSyntheticReadyCard } from "./lib/mvp/synthetic-ready-card.js";

const toolName = "aibang_hr_onboarding_test_ready_card";

const parameters = Type.Object({
  caseRef: Type.String({ minLength: 1, maxLength: 128, description: "Synthetic case reference from the test seed." })
}, { additionalProperties: false });

export default defineToolPlugin({
  id: "aibang-hr-onboarding-test",
  name: "Aibang HR Onboarding Synthetic Test",
  description: "Read one synthetic onboarding case and draft a Ready review card.",
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
  tools: (tool) => [tool({
    name: toolName,
    description: "Read a synthetic onboarding case and return a Day-1 Ready suggestion card for HR review. No formal Ready change or proactive message.",
    parameters,
    optional: true,
    factory({ api, toolContext }) {
      const config = api.pluginConfig ?? {};
      if (toolContext.agentId !== "aibang-hr-onboarding-agent" ||
        toolContext.messageChannel !== "feishu" ||
        !Array.isArray(config.trustedPrincipals)) return null;
      try {
        resolveTrustedFeishuPrincipal({
          agentAccountId: toolContext.agentAccountId,
          requesterSenderId: toolContext.requesterSenderId,
          trustedPrincipals: config.trustedPrincipals
        });
      } catch {
        return null;
      }
      return {
        name: toolName,
        description: "Read a synthetic onboarding case and return a Day-1 Ready suggestion card for HR review. No formal Ready change or proactive message.",
        parameters,
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
