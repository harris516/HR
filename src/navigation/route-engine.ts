import type {
  ChildNavigationResult,
  IntentCandidate,
  NavigationStatus,
  RouteType
} from "../contracts/navigation.js";
import type { AuthorizationDecision } from "./authorization.js";

export interface RouteOutcome {
  routeType: RouteType;
  status: NavigationStatus;
  reasonCodes: string[];
  mayCallCapability: boolean;
}

export function routeForbiddenIntent(intent: IntentCandidate): RouteOutcome | undefined {
  if (intent.intentId === "CROSS_SCOPE_REQUEST") {
    return { routeType: "SYSTEM_HARD_BLOCK", status: "blocked", reasonCodes: ["SYSTEM_HARD_BLOCK"], mayCallCapability: false };
  }
  if (intent.intentClass === "forbidden_request") {
    const reason = intent.intentId === "EXTERNAL_SEND_REQUEST"
      ? "EXTERNAL_EFFECT_PROHIBITED"
      : intent.requestedActionClass === "commit"
        ? "FORMAL_COMMIT_PROHIBITED"
        : "PROHIBITED_ACTION";
    return { routeType: "DENY", status: "completed", reasonCodes: [reason], mayCallCapability: false };
  }
  if (intent.intentClass === "controlled_request") {
    return { routeType: "HUMAN_HANDOFF", status: "waiting_for_human", reasonCodes: ["REVIEW_REQUIRED"], mayCallCapability: false };
  }
  if (intent.intentClass === "out_of_scope") {
    return { routeType: "HUMAN_HANDOFF", status: "completed", reasonCodes: ["INTENT_OUT_OF_SCOPE"], mayCallCapability: false };
  }
  if (intent.intentClass === "unknown") {
    return { routeType: "CLARIFY", status: "waiting_for_human", reasonCodes: ["INTENT_UNKNOWN"], mayCallCapability: false };
  }
  return undefined;
}

export function routeAuthorization(decision: AuthorizationDecision): RouteOutcome | undefined {
  if (decision.result === "allow") return undefined;
  if (decision.result === "step_up_required" || decision.result === "review_required" || decision.result === "context_refresh_required") {
    return {
      routeType: "HUMAN_HANDOFF",
      status: "waiting_for_human",
      reasonCodes: [decision.reasonCode ?? "REVIEW_REQUIRED"],
      mayCallCapability: false
    };
  }
  return {
    routeType: "DENY",
    status: "completed",
    reasonCodes: [decision.reasonCode ?? "ACTION_NOT_ALLOWED"],
    mayCallCapability: false
  };
}

export function routeAllowedIntent(intent: IntentCandidate): RouteOutcome {
  const routeType: RouteType = intent.requestedActionClass === "read"
    ? "READ"
    : intent.requestedActionClass === "analyze"
      ? "ANALYZE"
      : "DRAFT";
  return { routeType, status: "completed", reasonCodes: [], mayCallCapability: true };
}

export function toChildResult(
  taskId: string,
  intent: IntentCandidate,
  outcome: RouteOutcome,
  capabilityCalled: boolean,
  resultPayload?: Record<string, unknown>
): ChildNavigationResult {
  return {
    taskId,
    intentId: intent.intentId,
    routeType: outcome.routeType,
    status: outcome.status,
    reasonCodes: outcome.reasonCodes,
    capabilityCalled,
    ...(resultPayload === undefined ? {} : { resultPayload })
  };
}
