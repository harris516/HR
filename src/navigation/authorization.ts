import type {
  ActionClass,
  IntentCandidate,
  RequestContext
} from "../contracts/navigation.js";

export type AuthorizationResult =
  | "allow"
  | "deny"
  | "step_up_required"
  | "review_required"
  | "context_refresh_required"
  | "indeterminate";

export interface ScopeGrant {
  grantRef: string;
  tenantId: string;
  dataSpaceId: string;
  actions: ActionClass[];
  resourceIds: string[];
  result: AuthorizationResult;
}

export interface AuthorizationDecision {
  authorizationDecisionId: string;
  result: AuthorizationResult;
  reasonCode?: string;
  policyVersion: "synthetic-auth-v1";
  enforcementPoint: "navigation_precheck";
}

export interface AuthorizationPrecheckInput {
  context: RequestContext;
  intent: IntentCandidate;
  resource: {
    resourceType: "OnboardingCase" | "OnboardingCaseCollection";
    resourceId: string;
    sensitivity: "synthetic";
    expectedVersion?: string;
  };
  capability: {
    capabilityId: "read_stub" | "analyze_stub" | "draft_stub";
    capabilityVersion: "stub-v1";
  };
  risk: {
    phc: "PHC_1";
    prohibition: "none";
  };
  grants: ScopeGrant[];
}

export function authorizationPrecheck(
  input: AuthorizationPrecheckInput,
  id: () => string
): AuthorizationDecision {
  const { context, intent, resource, capability, grants } = input;
  const base = {
    authorizationDecisionId: `auth-${id()}`,
    policyVersion: "synthetic-auth-v1" as const,
    enforcementPoint: "navigation_precheck" as const
  };

  if (intent.capabilityCandidate !== capability.capabilityId) {
    return { ...base, result: "deny", reasonCode: "CAPABILITY_NOT_AVAILABLE" };
  }
  if (context.riskSignals?.includes("step_up_required") === true) {
    return { ...base, result: "step_up_required", reasonCode: "STEP_UP_REQUIRED" };
  }

  const referenced = grants.filter((grant) => context.scopeGrantRefs.includes(grant.grantRef));
  if (referenced.length === 0) {
    return { ...base, result: "indeterminate", reasonCode: "AUTHORIZATION_INDETERMINATE" };
  }

  if (referenced.some((grant) => grant.tenantId !== context.tenantId)) {
    return { ...base, result: "deny", reasonCode: "TENANT_MISSING_OR_MISMATCH" };
  }
  if (referenced.some((grant) => grant.dataSpaceId !== context.dataSpaceId)) {
    return { ...base, result: "deny", reasonCode: "DATA_SPACE_MISSING_OR_MISMATCH" };
  }

  const applicable = referenced.find((grant) => {
    const resourceAllowed = grant.resourceIds.includes("*") || grant.resourceIds.includes(resource.resourceId);
    return grant.actions.includes(intent.requestedActionClass) && resourceAllowed;
  });
  if (applicable === undefined) {
    return { ...base, result: "deny", reasonCode: "ACTION_NOT_ALLOWED" };
  }
  if (applicable.result === "step_up_required") {
    return { ...base, result: "step_up_required", reasonCode: "STEP_UP_REQUIRED" };
  }
  if (applicable.result === "review_required") {
    return { ...base, result: "review_required", reasonCode: "REVIEW_REQUIRED" };
  }
  if (applicable.result === "context_refresh_required") {
    return { ...base, result: "context_refresh_required", reasonCode: "CONTEXT_REFRESH_REQUIRED" };
  }
  if (applicable.result === "indeterminate") {
    return { ...base, result: "indeterminate", reasonCode: "AUTHORIZATION_INDETERMINATE" };
  }
  if (applicable.result === "deny") {
    return { ...base, result: "deny", reasonCode: "ACTION_NOT_ALLOWED" };
  }
  return { ...base, result: "allow" };
}
