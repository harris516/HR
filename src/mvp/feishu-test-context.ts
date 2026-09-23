import { randomUUID } from "node:crypto";
import type { RequestContext } from "../contracts/navigation.js";

export class FeishuTestSenderDenied extends Error {
  constructor() {
    super("TEST_SENDER_NOT_ALLOWED");
    this.name = "FeishuTestSenderDenied";
  }
}

export interface TrustedFeishuPrincipal {
  senderId: string;
  tenantId: string;
  dataSpaceId: string;
  actorId: string;
  activeTeamId: string;
  teamMembershipRef: string;
  roles: string[];
  scopeGrantRefs: string[];
}

export const syntheticTrustedFeishuPrincipals = [
  {
    senderId: "ou_hr1synthetic",
    tenantId: "tenant-hr-001",
    dataSpaceId: "dataspace-team-hr-onboarding-001",
    actorId: "hr-user-001",
    activeTeamId: "hr-onboarding-team-001",
    teamMembershipRef: "membership-hr-001-team-001",
    roles: ["onboarding_hr_operations"],
    scopeGrantRefs: ["scope-mvp-synthetic-team-read", "scope-mvp-synthetic-team-write"]
  },
  {
    senderId: "ou_hr2synthetic",
    tenantId: "tenant-hr-002",
    dataSpaceId: "dataspace-team-hr-onboarding-001",
    actorId: "hr-user-002",
    activeTeamId: "hr-onboarding-team-001",
    teamMembershipRef: "membership-hr-002-team-001",
    roles: ["onboarding_hr_operations"],
    scopeGrantRefs: ["scope-mvp-synthetic-team-read"]
  },
  {
    senderId: "ou_hr3synthetic",
    tenantId: "tenant-hr-003",
    dataSpaceId: "dataspace-team-other-001",
    actorId: "hr-user-003",
    activeTeamId: "hr-onboarding-team-002",
    teamMembershipRef: "membership-hr-003-team-002",
    roles: ["onboarding_hr_operations"],
    scopeGrantRefs: ["scope-mvp-synthetic-team-read"]
  },
  {
    senderId: "ou_hrnonmember",
    tenantId: "tenant-hr-004",
    dataSpaceId: "dataspace-team-hr-onboarding-001",
    actorId: "hr-user-004",
    activeTeamId: "hr-onboarding-team-001",
    teamMembershipRef: "",
    roles: ["onboarding_hr_operations"],
    scopeGrantRefs: []
  }
] as const satisfies readonly TrustedFeishuPrincipal[];

/** Build scope only from host-supplied sender metadata, never from model arguments. */
export function createFeishuTestContext(options: {
  requesterSenderId: unknown;
  trustedPrincipals: readonly TrustedFeishuPrincipal[];
  sessionRef?: string;
  now?: Date;
}): RequestContext {
  if (typeof options.requesterSenderId !== "string" || !/^ou_[a-zA-Z0-9]+$/.test(options.requesterSenderId)) {
    throw new FeishuTestSenderDenied();
  }
  const principal = options.trustedPrincipals.find((candidate) => candidate.senderId === options.requesterSenderId);
  if (principal === undefined || !/^ou_[a-zA-Z0-9]+$/.test(principal.senderId) ||
    [principal.tenantId, principal.dataSpaceId, principal.actorId, principal.activeTeamId,
      principal.teamMembershipRef].some((value) => value.length === 0) ||
    principal.roles.length === 0 || principal.scopeGrantRefs.length === 0) {
    throw new FeishuTestSenderDenied();
  }
  const now = options.now ?? new Date();
  const requestRef = randomUUID();
  return {
    requestId: `test-feishu-${requestRef}`,
    tenantId: principal.tenantId,
    dataSpaceId: principal.dataSpaceId,
    activeTeamId: principal.activeTeamId,
    teamMembershipRef: principal.teamMembershipRef,
    actorType: "user",
    actorId: principal.actorId,
    authenticationLevel: "test-feishu-verified",
    roles: [...principal.roles],
    scopeGrantRefs: [...principal.scopeGrantRefs],
    authorityGrantRefs: [],
    channel: "feishu_test",
    sessionId: options.sessionRef ?? `test-feishu-session-${requestRef}`,
    correlationId: `test-feishu-correlation-${requestRef}`,
    receivedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
    dataAccessPurpose: "onboarding_operation",
    environment: "test",
    contextVersion: "2",
    integrityRef: `test-feishu-runtime-${requestRef}`,
    synthetic: true
  };
}
