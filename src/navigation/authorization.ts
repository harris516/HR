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
  result: Exclude<AuthorizationResult, "context_refresh_required" | "indeterminate">;
}

export interface AuthorizationDecision {
  authorizationDecisionId: string;
  result: AuthorizationResult;
  reasonCode?: string;
  policyVersion: "synthetic-auth-v1";
  enforcementPoint: "navigation_precheck";
}

export function authorizationPrecheck(
  context: RequestContext,
  intent: IntentCandidate,
  resourceId: string | undefined,
  grants: ScopeGrant[],
  id: () => string
): AuthorizationDecision {
  const base = {
    authorizationDecisionId: `auth-${id()}`,
    policyVersion: "synthetic-auth-v1" as const,
    enforcementPoint: "navigation_precheck" as const
  };

  const referenced = grants.filter((grant) => context.scopeGrantRefs.includes(grant.grantRef));
  if (referenced.length === 0) {
    return { ...base, result: "indeterminate", reasonCode: "AUTHORIZATION_INDETERMINATE" };
  }

  const boundaryMismatch = referenced.some(
    (grant) => grant.tenantId !== context.tenantId || grant.dataSpaceId !== context.dataSpaceId
  );
  if (boundaryMismatch) {
    return { ...base, result: "deny", reasonCode: "DATA_SPACE_MISSING_OR_MISMATCH" };
  }

  const applicable = referenced.find((grant) => {
    const resourceAllowed = grant.resourceIds.includes("*") ||
      (resourceId !== undefined && grant.resourceIds.includes(resourceId));
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
  if (applicable.result === "deny") {
    return { ...base, result: "deny", reasonCode: "ACTION_NOT_ALLOWED" };
  }
  return { ...base, result: "allow" };
}
