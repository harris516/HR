import { randomUUID } from "node:crypto";
import type { RequestContext } from "../contracts/navigation.js";

export class FeishuTestSenderDenied extends Error {
  constructor() {
    super("TEST_SENDER_NOT_ALLOWED");
    this.name = "FeishuTestSenderDenied";
  }
}

/** Build scope only from host-supplied sender metadata, never from model arguments. */
export function createFeishuTestContext(options: {
  requesterSenderId: unknown;
  allowedSenderId: string;
  now?: Date;
}): RequestContext {
  if (typeof options.requesterSenderId !== "string" ||
    !/^ou_[a-zA-Z0-9]+$/.test(options.allowedSenderId) ||
    options.requesterSenderId !== options.allowedSenderId) {
    throw new FeishuTestSenderDenied();
  }
  const now = options.now ?? new Date();
  const requestRef = randomUUID();
  return {
    requestId: `test-feishu-${requestRef}`,
    tenantId: "tenant-demo-001",
    dataSpaceId: "dataspace-demo-hr",
    actorType: "user",
    actorId: "hr-user-demo-001",
    authenticationLevel: "test-feishu-verified",
    roles: ["onboarding_hr_operations"],
    scopeGrantRefs: ["scope-mvp-synthetic-feishu-read"],
    authorityGrantRefs: [],
    channel: "feishu_test",
    sessionId: `test-feishu-session-${requestRef}`,
    correlationId: `test-feishu-correlation-${requestRef}`,
    receivedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
    dataAccessPurpose: "onboarding_operation",
    environment: "test",
    contextVersion: "1",
    integrityRef: `test-feishu-runtime-${requestRef}`,
    synthetic: true
  };
}
