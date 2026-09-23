import { describe, expect, it } from "vitest";
import {
  createFeishuTestContext,
  FeishuTestSenderDenied,
  syntheticTrustedFeishuPrincipals
} from "../src/mvp/feishu-test-context.js";
import { validateRequestContext } from "../src/navigation/context-gate.js";

const now = new Date("2026-09-22T03:00:00.000Z");

describe("controlled Feishu synthetic test context", () => {
  it("creates a valid, short-lived context from the trusted sender", () => {
    const context = createFeishuTestContext({
      agentAccountId: "hr-bot-01",
      requesterSenderId: "ou_hr1synthetic",
      trustedPrincipals: syntheticTrustedFeishuPrincipals,
      sessionRef: "feishu-chat-hr1",
      now
    });
    expect(context.channel).toBe("feishu_test");
    expect(context.synthetic).toBe(true);
    expect(context.tenantId).toBe("tenant-hr-001");
    expect(context.actorId).toBe("hr-user-001");
    expect(context.activeTeamId).toBe("hr-onboarding-team-001");
    expect(context.teamMembershipRef).toBe("membership-hr-001-team-001");
    expect(validateRequestContext(context, now).ok).toBe(true);
    expect(validateRequestContext(context, new Date(now.getTime() + 5 * 60_000)).ok).toBe(false);
  });

  it("denies absent, unknown, or malformed runtime identity metadata", () => {
    for (const [agentAccountId, requesterSenderId] of [
      [undefined, "ou_hr1synthetic"],
      ["unknown-bot", "ou_hr1synthetic"],
      ["hr-bot-01", "ou_other"],
      ["hr-bot-04", "ou_hrnonmember"],
      ["feishu:hr-bot-01", "ou_hr1synthetic"],
      ["hr-bot-01", "feishu:ou_hr1synthetic"]
    ]) {
      expect(() => createFeishuTestContext({ agentAccountId, requesterSenderId,
        trustedPrincipals: syntheticTrustedFeishuPrincipals, now }))
        .toThrow(FeishuTestSenderDenied);
    }
  });

  it("maps two bot-and-sender pairs to separate tenants and sessions in one team", () => {
    const hr1 = createFeishuTestContext({ agentAccountId: "hr-bot-01", requesterSenderId: "ou_hr1synthetic",
      trustedPrincipals: syntheticTrustedFeishuPrincipals, sessionRef: "session-hr1", now });
    const hr2 = createFeishuTestContext({ agentAccountId: "hr-bot-02", requesterSenderId: "ou_hr2synthetic",
      trustedPrincipals: syntheticTrustedFeishuPrincipals, sessionRef: "session-hr2", now });
    expect(hr1.tenantId).toBe("tenant-hr-001");
    expect(hr2.tenantId).toBe("tenant-hr-002");
    expect(hr1.actorId).toBe("hr-user-001");
    expect(hr2.actorId).toBe("hr-user-002");
    expect(hr1.sessionId).not.toBe(hr2.sessionId);
    expect(hr1.activeTeamId).toBe(hr2.activeTeamId);
  });

  it("denies sender and bot cross-pairing in both directions", () => {
    expect(() => createFeishuTestContext({ agentAccountId: "hr-bot-02", requesterSenderId: "ou_hr1synthetic",
      trustedPrincipals: syntheticTrustedFeishuPrincipals, now })).toThrow(FeishuTestSenderDenied);
    expect(() => createFeishuTestContext({ agentAccountId: "hr-bot-01", requesterSenderId: "ou_hr2synthetic",
      trustedPrincipals: syntheticTrustedFeishuPrincipals, now })).toThrow(FeishuTestSenderDenied);
  });

  it("denies an ambiguous duplicate bot-and-sender mapping", () => {
    expect(() => createFeishuTestContext({
      agentAccountId: "hr-bot-01",
      requesterSenderId: "ou_hr1synthetic",
      trustedPrincipals: [...syntheticTrustedFeishuPrincipals, syntheticTrustedFeishuPrincipals[0]],
      now
    })).toThrow(FeishuTestSenderDenied);
  });

  it("ignores forged identity and authority fields outside the trusted runtime inputs", () => {
    const context = createFeishuTestContext({
      agentAccountId: "hr-bot-01",
      requesterSenderId: "ou_hr1synthetic",
      trustedPrincipals: syntheticTrustedFeishuPrincipals,
      tenantId: "tenant-forged",
      activeTeamId: "team-forged",
      roles: ["admin"]
    } as unknown as Parameters<typeof createFeishuTestContext>[0]);
    expect(context.tenantId).toBe("tenant-hr-001");
    expect(context.activeTeamId).toBe("hr-onboarding-team-001");
    expect(context.roles).toEqual(["onboarding_hr_operations"]);
  });

  it("does not accept a generic Feishu or forged authentication level", () => {
    const context = createFeishuTestContext({ agentAccountId: "hr-bot-01", requesterSenderId: "ou_hr1synthetic",
      trustedPrincipals: syntheticTrustedFeishuPrincipals, now });
    expect(validateRequestContext({ ...context, channel: "feishu" }, now).ok).toBe(false);
    expect(validateRequestContext({ ...context, authenticationLevel: "test-self-asserted" }, now).ok).toBe(false);
  });
});
