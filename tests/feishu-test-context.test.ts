import { describe, expect, it } from "vitest";
import { createFeishuTestContext, FeishuTestSenderDenied } from "../src/mvp/feishu-test-context.js";
import { validateRequestContext } from "../src/navigation/context-gate.js";

const allowedSenderId = "ou_1234567890abcdef";
const now = new Date("2026-09-22T03:00:00.000Z");

describe("controlled Feishu synthetic test context", () => {
  it("creates a valid, short-lived context from the trusted sender", () => {
    const context = createFeishuTestContext({ requesterSenderId: allowedSenderId, allowedSenderId, now });
    expect(context.channel).toBe("feishu_test");
    expect(context.synthetic).toBe(true);
    expect(context.actorId).toBe("hr-user-demo-001");
    expect(validateRequestContext(context, now).ok).toBe(true);
    expect(validateRequestContext(context, new Date(now.getTime() + 5 * 60_000)).ok).toBe(false);
  });

  it("denies absent, mismatched, or malformed sender configuration", () => {
    for (const requesterSenderId of [undefined, "ou_other", "feishu:ou_1234567890abcdef"]) {
      expect(() => createFeishuTestContext({ requesterSenderId, allowedSenderId, now }))
        .toThrow(FeishuTestSenderDenied);
    }
    expect(() => createFeishuTestContext({ requesterSenderId: allowedSenderId, allowedSenderId: "*", now }))
      .toThrow(FeishuTestSenderDenied);
  });

  it("does not accept a generic Feishu or forged authentication level", () => {
    const context = createFeishuTestContext({ requesterSenderId: allowedSenderId, allowedSenderId, now });
    expect(validateRequestContext({ ...context, channel: "feishu" }, now).ok).toBe(false);
    expect(validateRequestContext({ ...context, authenticationLevel: "test-self-asserted" }, now).ok).toBe(false);
  });
});
