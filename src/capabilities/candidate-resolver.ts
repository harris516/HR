import type { CapabilityRef } from "../contracts/capability.js";
import type { IntentId } from "../contracts/navigation.js";

const intentCapabilityMap: Partial<Record<IntentId, CapabilityRef>> = {
  LIST_ONBOARDING_CASES: { capabilityId: "hr.onboarding.case.list", capabilityVersion: "1.0.0" },
  LIST_RISK_CASES: { capabilityId: "hr.onboarding.risk.list", capabilityVersion: "1.0.0" },
  GET_CASE_STATUS: { capabilityId: "hr.onboarding.case.status.read", capabilityVersion: "1.0.0" },
  CHECK_REQUIREMENT_STATUS: { capabilityId: "hr.onboarding.requirement.status.read", capabilityVersion: "1.0.0" },
  DAY1_READY_CHECK: { capabilityId: "hr.onboarding.readiness.evaluate", capabilityVersion: "1.0.0" },
  CREATE_REMINDER_DRAFT: { capabilityId: "hr.onboarding.reminder.draft", capabilityVersion: "1.0.0" },
  CREATE_ESCALATION_DRAFT: { capabilityId: "hr.onboarding.escalation.draft", capabilityVersion: "1.0.0" },
  CREATE_REVIEW_DRAFT: { capabilityId: "hr.onboarding.review_request.draft", capabilityVersion: "1.0.0" },
  REVALIDATE_READY: { capabilityId: "hr.onboarding.readiness.revalidate", capabilityVersion: "1.0.0" }
};

export type CandidateResolution =
  | { resolved: true; capabilityRef: CapabilityRef }
  | { resolved: false; reasonCode: "CAPABILITY_NOT_REGISTERED" };

export function resolveCapabilityCandidate(intentId: IntentId): CandidateResolution {
  const capabilityRef = intentCapabilityMap[intentId];
  return capabilityRef === undefined
    ? { resolved: false, reasonCode: "CAPABILITY_NOT_REGISTERED" }
    : { resolved: true, capabilityRef };
}

