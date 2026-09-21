import type {
  ChildNavigationResult,
  IntentCandidate,
  NavigationRequest,
  NavigationResponse,
  NavigationTask,
  RequestContext,
  RouteType,
  SelectedCaseRef,
  SubjectClue
} from "../contracts/navigation.js";
import { navigationRequestSchema } from "../contracts/navigation.js";
import type {
  NavigationAuditEvent,
  NavigationAuditSink
} from "../audit/navigation-audit.js";
import {
  authorizationPrecheck,
  type ScopeGrant
} from "./authorization.js";
import { validateRequestContext } from "./context-gate.js";
import { classifyIntentCandidates } from "./intent-router.js";
import { transitionTask } from "./lifecycle.js";
import {
  routeAllowedIntent,
  routeAuthorization,
  routeForbiddenIntent,
  toChildResult,
  type RouteOutcome
} from "./route-engine.js";
import {
  resolveSubject,
  type SyntheticCaseRecord
} from "./subject-resolution.js";

export interface NavigationEngineOptions {
  cases: SyntheticCaseRecord[];
  grants: ScopeGrant[];
  capabilities: ReadonlySet<string>;
  auditSink: NavigationAuditSink;
  now?: () => Date;
}

interface SeenRequest {
  fingerprint: string;
  response: NavigationResponse;
}

function stringField(value: unknown, field: string, fallback: string): string {
  if (typeof value !== "object" || value === null) return fallback;
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : fallback;
}

export class NavigationEngine {
  private sequence = 0;
  private readonly seenRequests = new Map<string, SeenRequest>();
  private capabilityCallCountValue = 0;
  private readonly now: () => Date;

  constructor(private readonly options: NavigationEngineOptions) {
    this.now = options.now ?? (() => new Date());
  }

  get capabilityCallCount(): number {
    return this.capabilityCallCountValue;
  }

  navigate(input: unknown): NavigationResponse {
    const parsedRequest = navigationRequestSchema.safeParse(input);
    const rawContext = parsedRequest.success ? parsedRequest.data.context : undefined;
    const requestId = stringField(rawContext, "requestId", "untrusted-request");
    const correlationId = stringField(rawContext, "correlationId", "untrusted-correlation");

    if (!this.options.auditSink.isAvailable()) {
      return this.ingressFailure(requestId, correlationId, "AUDIT_UNAVAILABLE", "failed");
    }

    this.audit("ingress_received", requestId, correlationId, [], undefined);

    if (!parsedRequest.success) {
      this.audit("request_schema_rejected", requestId, correlationId, ["REQUEST_CONTEXT_INVALID"], undefined);
      return this.ingressFailure(requestId, correlationId, "REQUEST_CONTEXT_INVALID", "all_denied");
    }

    const request: NavigationRequest = parsedRequest.data;
    const contextResult = validateRequestContext(request.context, this.now());
    if (!contextResult.ok) {
      this.audit("context_rejected", requestId, correlationId, [contextResult.reasonCode], undefined);
      return this.ingressFailure(
        requestId,
        correlationId,
        contextResult.reasonCode,
        contextResult.hardBlock ? "hard_blocked" : "all_denied",
        contextResult.hardBlock ? "SYSTEM_HARD_BLOCK" : "DENY",
        contextResult.hardBlock ? "blocked" : "completed"
      );
    }

    const context = contextResult.context;
    const fingerprint = JSON.stringify(request);
    const seen = this.seenRequests.get(context.requestId);
    if (seen !== undefined) {
      if (seen.fingerprint !== fingerprint) {
        this.auditForContext("request_id_conflict", context, ["REQUEST_ID_CONFLICT"]);
        return this.ingressFailure(context.requestId, context.correlationId, "REQUEST_ID_CONFLICT", "failed");
      }
      this.auditForContext("duplicate_request_suppressed", context, ["DUPLICATE_REQUEST"]);
      return {
        ...structuredClone(seen.response),
        auditEventCount: this.options.auditSink.events().length
      };
    }

    const intents = classifyIntentCandidates(request.input.text, context, () => this.id());
    const requestPlanId = intents.length > 1 ? `plan-${this.id()}` : undefined;
    const results: ChildNavigationResult[] = [];

    for (const intent of intents) {
      const result = this.processIntent(
        context,
        intent,
        request.input.subjectClues,
        request.input.selectedCaseRef,
        requestPlanId
      );
      results.push(result);
      if (result.routeType === "SYSTEM_HARD_BLOCK") break;
    }

    const response: NavigationResponse = {
      requestId: context.requestId,
      correlationId: context.correlationId,
      ...(requestPlanId === undefined ? {} : { requestPlanId }),
      aggregateStatus: this.aggregate(results),
      childResults: results,
      auditEventCount: this.options.auditSink.events().length
    };
    this.auditForContext("navigation_finalized", context, results.flatMap((result) => result.reasonCodes));
    response.auditEventCount = this.options.auditSink.events().length;
    this.seenRequests.set(context.requestId, { fingerprint, response: structuredClone(response) });
    return response;
  }

  private processIntent(
    context: RequestContext,
    intent: IntentCandidate,
    clues: SubjectClue[],
    selectedCaseRef: SelectedCaseRef | undefined,
    requestPlanId: string | undefined
  ): ChildNavigationResult {
    const task: NavigationTask = {
      taskId: `task-${this.id()}`,
      attemptId: `attempt-${this.id()}`,
      ...(requestPlanId === undefined ? {} : { requestPlanRef: requestPlanId }),
      taskEnvelopeVersion: "1",
      requestContextRef: context.requestId,
      tenantId: context.tenantId,
      dataSpaceId: context.dataSpaceId,
      correlationId: context.correlationId,
      intent,
      status: "created",
      reasonCodes: [],
      transitionRecordRefs: []
    };
    this.auditForTask("task_created", context, task, []);
    this.transition(context, task, "validated", "schema_validated", []);
    this.transition(context, task, "in_progress", "routing_started", []);

    const forbidden = routeForbiddenIntent(intent);
    if (forbidden !== undefined) return this.finalize(context, task, forbidden, false);

    let caseRecord: SyntheticCaseRecord | undefined;
    if (intent.subjectRequirement === "unique_case" || intent.subjectRequirement === "related_object") {
      const resolution = resolveSubject(context, clues, this.options.cases, selectedCaseRef, this.now());
      this.auditForTask(`subject_${resolution.status}`, context, task, []);
      if (resolution.status === "context_mismatch") {
        return this.finalize(context, task, {
          routeType: "SYSTEM_HARD_BLOCK",
          status: "blocked",
          reasonCodes: ["DATA_SPACE_MISSING_OR_MISMATCH"],
          mayCallCapability: false
        }, false);
      }
      if (resolution.status === "access_denied") {
        return this.finalize(context, task, {
          routeType: "DENY",
          status: "completed",
          reasonCodes: ["SUBJECT_ACCESS_DENIED"],
          mayCallCapability: false
        }, false);
      }
      if (resolution.status === "identity_conflict") {
        return this.finalize(context, task, {
          routeType: "HUMAN_HANDOFF",
          status: "waiting_for_human",
          reasonCodes: ["IDENTITY_CONFLICT"],
          mayCallCapability: false
        }, false);
      }
      if (resolution.status === "mapping_unknown" || resolution.status === "stale_mapping") {
        return this.finalize(context, task, {
          routeType: "RESOLVE_SUBJECT",
          status: "waiting_for_source",
          reasonCodes: [resolution.status === "mapping_unknown" ? "MAPPING_UNKNOWN" : "MAPPING_STALE"],
          mayCallCapability: false
        }, false);
      }
      if (resolution.status === "not_found" || resolution.status === "multiple_candidates") {
        return this.finalize(context, task, {
          routeType: "RESOLVE_SUBJECT",
          status: "waiting_for_human",
          reasonCodes: [resolution.status === "not_found" ? "SUBJECT_NOT_FOUND" : "MULTIPLE_SUBJECTS"],
          mayCallCapability: false
        }, false);
      }
      caseRecord = resolution.caseRecord;
      task.onboardingCaseId = caseRecord.caseId;
    }

    const capability = intent.capabilityCandidate;
    if (capability === undefined || !this.options.capabilities.has(capability)) {
      return this.finalize(context, task, {
        routeType: "DENY",
        status: "completed",
        reasonCodes: ["CAPABILITY_NOT_AVAILABLE"],
        mayCallCapability: false
      }, false);
    }

    const resourceId = caseRecord?.caseId ?? "*";
    const authorization = authorizationPrecheck(
      {
        context,
        intent,
        resource: {
          resourceType: caseRecord === undefined ? "OnboardingCaseCollection" : "OnboardingCase",
          resourceId,
          sensitivity: "synthetic",
          ...(caseRecord === undefined ? {} : { expectedVersion: caseRecord.version })
        },
        capability: {
          capabilityId: capability,
          capabilityVersion: "stub-v1"
        },
        risk: {
          phc: "PHC_1",
          prohibition: "none"
        },
        grants: this.options.grants
      },
      () => this.id()
    );
    this.auditForTask(`authorization_${authorization.result}`, context, task, authorization.reasonCode === undefined ? [] : [authorization.reasonCode]);
    const authorizationRoute = routeAuthorization(authorization);
    if (authorizationRoute !== undefined) {
      return this.finalize(context, task, authorizationRoute, false);
    }

    const route = routeAllowedIntent(intent);
    const payload = this.executeMockCapability(context, intent, caseRecord);
    return this.finalize(context, task, route, true, payload);
  }

  private executeMockCapability(
    context: RequestContext,
    intent: IntentCandidate,
    caseRecord: SyntheticCaseRecord | undefined
  ): Record<string, unknown> {
    this.capabilityCallCountValue += 1;
    if (intent.subjectRequirement === "collection") {
      const cases = this.options.cases
        .filter((record) => record.tenantId === context.tenantId && record.dataSpaceId === context.dataSpaceId && record.accessible)
        .map((record) => ({ caseRef: record.caseId, version: record.version }));
      return { synthetic: true, cases };
    }
    if (caseRecord === undefined) return { synthetic: true };
    const sourceMetadata = caseRecord.sourceAvailability === "unavailable"
      ? {
          sourceStatus: "unavailable",
          freshness: "stale",
          observationAge: "synthetic-age",
          provenanceRef: "synthetic-provenance",
          sourcePolicyVersion: "synthetic-source-policy-v1"
        }
      : { sourceStatus: caseRecord.sourceAvailability ?? "fresh", freshness: caseRecord.sourceAvailability ?? "fresh" };
    return {
      synthetic: true,
      caseRef: caseRecord.caseId,
      version: caseRecord.version,
      resultKind: intent.requestedActionClass === "draft" ? "draft" : "candidate",
      formalStateChanged: false,
      externalSideEffect: false,
      ...sourceMetadata
    };
  }

  private finalize(
    context: RequestContext,
    task: NavigationTask,
    outcome: RouteOutcome,
    capabilityCalled: boolean,
    payload?: Record<string, unknown>
  ): ChildNavigationResult {
    this.transition(context, task, outcome.status, `route_${outcome.routeType.toLowerCase()}`, outcome.reasonCodes);
    this.auditForTask("route_finalized", context, task, outcome.reasonCodes);
    return toChildResult(task.taskId, task.intent, outcome, capabilityCalled, payload);
  }

  private transition(
    context: RequestContext,
    task: NavigationTask,
    toStatus: NavigationTask["status"],
    trigger: string,
    reasonCodes: string[]
  ): void {
    const record = transitionTask(task, toStatus, trigger, reasonCodes, () => this.id(), this.now());
    this.auditForTask("task_transition", context, task, record.reasonCodes);
  }

  private aggregate(results: ChildNavigationResult[]): NavigationResponse["aggregateStatus"] {
    if (results.some((result) => result.routeType === "SYSTEM_HARD_BLOCK")) return "hard_blocked";
    const completedCapability = results.some((result) => result.capabilityCalled && result.status === "completed");
    const denied = results.some((result) => result.routeType === "DENY");
    const waiting = results.some((result) => result.status === "waiting_for_human" || result.status === "waiting_for_source");
    const failed = results.some((result) => result.status === "failed");
    if (completedCapability && (denied || waiting || failed)) return "partially_completed";
    if (waiting) return "waiting";
    if (failed) return "failed";
    if (results.length > 0 && results.every((result) => result.routeType === "DENY")) return "all_denied";
    return "all_completed";
  }

  private ingressFailure(
    requestId: string,
    correlationId: string,
    reasonCode: string,
    aggregateStatus: NavigationResponse["aggregateStatus"],
    routeType: RouteType = "DENY",
    status: ChildNavigationResult["status"] = "failed"
  ): NavigationResponse {
    return {
      requestId,
      correlationId,
      aggregateStatus,
      childResults: [{
        taskId: "ingress-only",
        intentId: "UNKNOWN_INTENT",
        routeType,
        status,
        reasonCodes: [reasonCode],
        capabilityCalled: false
      }],
      auditEventCount: this.options.auditSink.events().length
    };
  }

  private audit(
    eventType: string,
    requestId: string,
    correlationId: string,
    reasonCodes: string[],
    boundary: { tenantId: string; dataSpaceId: string; taskId?: string } | undefined
  ): void {
    const event: NavigationAuditEvent = {
      eventId: `audit-${this.id()}`,
      eventType,
      requestId,
      correlationId,
      ...(boundary === undefined ? {} : {
        tenantId: boundary.tenantId,
        dataSpaceId: boundary.dataSpaceId,
        ...(boundary.taskId === undefined ? {} : { taskId: boundary.taskId })
      }),
      reasonCodes,
      occurredAt: this.now().toISOString()
    };
    this.options.auditSink.append(event);
  }

  private auditForContext(eventType: string, context: RequestContext, reasonCodes: string[]): void {
    this.audit(eventType, context.requestId, context.correlationId, reasonCodes, {
      tenantId: context.tenantId,
      dataSpaceId: context.dataSpaceId
    });
  }

  private auditForTask(eventType: string, context: RequestContext, task: NavigationTask, reasonCodes: string[]): void {
    this.audit(eventType, context.requestId, context.correlationId, reasonCodes, {
      tenantId: context.tenantId,
      dataSpaceId: context.dataSpaceId,
      taskId: task.taskId
    });
  }

  private id(): string {
    this.sequence += 1;
    return this.sequence.toString().padStart(6, "0");
  }
}
