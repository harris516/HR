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

  it("denies absent, mismatched, or malformed sender configuration", () => {
    for (const requesterSenderId of [undefined, "ou_other", "ou_hrnonmember", "feishu:ou_hr1synthetic"]) {
      expect(() => createFeishuTestContext({ requesterSenderId, trustedPrincipals: syntheticTrustedFeishuPrincipals, now }))
        .toThrow(FeishuTestSenderDenied);
    }
  });

  it("maps two tenants to one team while keeping their sessions and actors distinct", () => {
    const hr1 = createFeishuTestContext({ requesterSenderId: "ou_hr1synthetic", trustedPrincipals: syntheticTrustedFeishuPrincipals, now });
    const hr2 = createFeishuTestContext({ requesterSenderId: "ou_hr2synthetic", trustedPrincipals: syntheticTrustedFeishuPrincipals, now });
    expect(hr1.tenantId).not.toBe(hr2.tenantId);
    expect(hr1.actorId).not.toBe(hr2.actorId);
    expect(hr1.sessionId).not.toBe(hr2.sessionId);
    expect(hr1.activeTeamId).toBe(hr2.activeTeamId);
  });

  it("does not accept a generic Feishu or forged authentication level", () => {
    const context = createFeishuTestContext({ requesterSenderId: "ou_hr1synthetic", trustedPrincipals: syntheticTrustedFeishuPrincipals, now });
    expect(validateRequestContext({ ...context, channel: "feishu" }, now).ok).toBe(false);
    expect(validateRequestContext({ ...context, authenticationLevel: "test-self-asserted" }, now).ok).toBe(false);
  });
});
