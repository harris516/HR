import type { SkillAuditEvent, SkillAuditSink } from "../audit/skill-audit.js";
import type { CapabilityGateway } from "../capabilities/gateway.js";
import { digestCapabilityPayload } from "../capabilities/gateway.js";
import type { SyntheticCapabilityExecutor } from "../capabilities/implementations/executor.js";
import type { CanonicalReasonCode } from "../capabilities/reason-codes.js";
import type { CapabilityRef } from "../contracts/capability.js";
import {
  skillRunRequestSchema,
  skillRunResultSchema,
  type PracticeHandoffSignal,
  type SkillRunRequest,
  type SkillRunResult,
  type SkillStepResult
} from "../contracts/skill-orchestration.js";
import { validateRequestContext } from "../navigation/context-gate.js";
import { getSkillDefinition, getSkillWorkflow } from "./registry.js";

export interface SkillOrchestratorOptions {
  gateway: CapabilityGateway;
  executor: SyntheticCapabilityExecutor;
  auditSink: SkillAuditSink;
  allowSyntheticTestExecution: true;
  now?: () => Date;
  idFactory?: () => string;
}

export class SkillRunInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillRunInputError";
  }
}

function statusForGateway(decision: "DENY" | "SYSTEM_HARD_BLOCK" | "REVIEW_REQUIRED" | "WAITING"):
  SkillRunResult["status"] {
  if (decision === "REVIEW_REQUIRED") return "REVIEW_REQUIRED";
  if (decision === "WAITING") return "WAITING";
  return "DENIED";
}

function statusForExecution(status: string): SkillRunResult["status"] {
  if (status === "REVIEW_REQUIRED") return "REVIEW_REQUIRED";
  if (status === "WAITING" || status === "INDETERMINATE") return "WAITING";
  if (status === "DENIED") return "DENIED";
  return "FAILED";
}

export class SyntheticSkillOrchestrator {
  readonly #gateway: CapabilityGateway;
  readonly #executor: SyntheticCapabilityExecutor;
  readonly #auditSink: SkillAuditSink;
  readonly #now: () => Date;
  readonly #idFactory: () => string;

  constructor(options: SkillOrchestratorOptions) {
    if (!options.allowSyntheticTestExecution) {
      throw new Error("skill orchestration requires explicit synthetic test-only opt-in");
    }
    this.#gateway = options.gateway;
    this.#executor = options.executor;
    this.#auditSink = options.auditSink;
    this.#now = options.now ?? (() => new Date());
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  run(input: unknown): SkillRunResult {
    const parsed = skillRunRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new SkillRunInputError("skill orchestrator requires a valid versioned request");
    }
    const request = parsed.data;
    const startedAt = this.#now();

    if (!this.#auditSink.isAvailable()) {
      return this.#result(request, "FAILED", [], ["AUDIT_UNAVAILABLE"], 0, null, startedAt);
    }
    const ingressRef = this.#idFactory();
    if (!this.#appendAudit(request, ingressRef, "skill_run_ingress", [])) {
      return this.#result(request, "FAILED", [], ["AUDIT_UNAVAILABLE"], 0, null, startedAt);
    }

    if (
      new Date(request.createdAt).getTime() > startedAt.getTime() ||
      new Date(request.expiresAt).getTime() <= startedAt.getTime()
    ) {
      return this.#finalize(request, "WAITING", [], ["REQUEST_CONTEXT_EXPIRED"], 0, startedAt);
    }
    const contextResult = validateRequestContext(request.requestContext, startedAt);
    if (!contextResult.ok) {
      return this.#finalize(
        request,
        contextResult.hardBlock ? "DENIED" : "FAILED",
        [],
        [contextResult.reasonCode as CanonicalReasonCode],
        0,
        startedAt
      );
    }

    const definition = getSkillDefinition(request.skillRef.skillId);
    if (definition.skillVersion !== request.skillRef.skillVersion) {
      return this.#finalize(request, "DENIED", [], ["SKILL_NOT_AVAILABLE"], 0, startedAt);
    }
    const workflow = getSkillWorkflow(request.skillRef.skillId, request.workflowId);
    if (workflow === undefined) {
      return this.#finalize(request, "DENIED", [], ["ACTION_NOT_ALLOWED"], 0, startedAt);
    }

    if (request.practiceHandoffSignal !== undefined) {
      if (request.capabilityRequests.length !== 0) {
        return this.#finalize(request, "DENIED", [], ["ACTION_NOT_ALLOWED"], 0, startedAt);
      }
      return this.#practiceHandoff(request, request.practiceHandoffSignal, startedAt);
    }

    const expectedRefs = workflow.capabilityRefs;
    if (
      request.capabilityRequests.length !== expectedRefs.length ||
      request.capabilityRequests.some((capabilityRequest, index) => {
        const expected = expectedRefs[index];
        return expected === undefined ||
          capabilityRequest.capabilityRef.capabilityId !== expected.capabilityId ||
          capabilityRequest.capabilityRef.capabilityVersion !== expected.capabilityVersion;
      })
    ) {
      return this.#finalize(request, "DENIED", [], ["ACTION_NOT_ALLOWED"], 0, startedAt);
    }

    const contextDigest = digestCapabilityPayload(request.requestContext);
    const requestMismatch = request.capabilityRequests.some((capabilityRequest) =>
      capabilityRequest.taskId !== request.taskId ||
      capabilityRequest.attemptId !== request.attemptId ||
      capabilityRequest.routeDecisionRef !== request.routeDecisionRef ||
      digestCapabilityPayload(capabilityRequest.requestContext) !== contextDigest
    );
    if (requestMismatch) {
      return this.#finalize(request, "DENIED", [], ["REQUEST_CONTEXT_INVALID"], 0, startedAt);
    }

    const stepResults: SkillStepResult[] = [];
    let implementationCallCount = 0;
    for (const [index, capabilityRequest] of request.capabilityRequests.entries()) {
      const stepId = `${request.workflowId}:step-${index + 1}`;
      const stepAuditRef = this.#idFactory();
      if (!this.#appendAudit(
        request,
        stepAuditRef,
        "skill_step_requested",
        [],
        capabilityRequest
      )) {
        return this.#finalize(
          request,
          "FAILED",
          stepResults,
          ["AUDIT_UNAVAILABLE"],
          implementationCallCount,
          startedAt
        );
      }

      if (!this.#dependencySatisfied(request, index, stepResults)) {
        const stoppedRecorded = this.#appendAudit(
          request,
          this.#idFactory(),
          "skill_step_stopped",
          ["CAPABILITY_INPUT_INVALID"],
          capabilityRequest,
          "FAILED"
        );
        if (!stoppedRecorded) {
          return this.#result(
            request,
            "FAILED",
            stepResults,
            ["AUDIT_UNAVAILABLE"],
            implementationCallCount,
            null,
            startedAt
          );
        }
        return this.#finalize(
          request,
          "FAILED",
          stepResults,
          ["CAPABILITY_INPUT_INVALID"],
          implementationCallCount,
          startedAt
        );
      }

      const gatewayResult = this.#gateway.resolve(capabilityRequest);
      if (gatewayResult.decision !== "ALLOW_TO_IMPLEMENTATION") {
        stepResults.push({
          stepId,
          capabilityRef: capabilityRequest.capabilityRef as CapabilityRef,
          gatewayResult,
          completed: false,
          reasonCodes: gatewayResult.reasonCodes
        });
        const stoppedRecorded = this.#appendAudit(
          request,
          this.#idFactory(),
          "skill_step_stopped",
          gatewayResult.reasonCodes,
          capabilityRequest,
          statusForGateway(gatewayResult.decision)
        );
        if (!stoppedRecorded) {
          return this.#result(
            request,
            "FAILED",
            stepResults,
            ["AUDIT_UNAVAILABLE"],
            implementationCallCount,
            null,
            startedAt
          );
        }
        return this.#finalize(
          request,
          statusForGateway(gatewayResult.decision),
          stepResults,
          gatewayResult.reasonCodes,
          implementationCallCount,
          startedAt
        );
      }

      const executionOutcome = this.#executor.execute(capabilityRequest, gatewayResult);
      if (executionOutcome.implementationInvoked) implementationCallCount += 1;
      const completed = executionOutcome.envelope.resultStatus === "SUCCESS" ||
        executionOutcome.envelope.resultStatus === "PARTIAL";
      stepResults.push({
        stepId,
        capabilityRef: capabilityRequest.capabilityRef as CapabilityRef,
        gatewayResult,
        executionOutcome,
        completed,
        reasonCodes: executionOutcome.envelope.reasonCodes
      });
      const eventType = completed ? "skill_step_completed" : "skill_step_stopped";
      const eventStatus = completed ? undefined : statusForExecution(executionOutcome.envelope.resultStatus);
      const recorded = this.#appendAudit(
        request,
        this.#idFactory(),
        eventType,
        executionOutcome.envelope.reasonCodes,
        capabilityRequest,
        eventStatus
      );
      if (!recorded) {
        return this.#finalize(
          request,
          "FAILED",
          stepResults,
          ["AUDIT_UNAVAILABLE"],
          implementationCallCount,
          startedAt
        );
      }
      if (!completed) {
        return this.#finalize(
          request,
          statusForExecution(executionOutcome.envelope.resultStatus),
          stepResults,
          executionOutcome.envelope.reasonCodes,
          implementationCallCount,
          startedAt
        );
      }
    }

    return this.#finalize(request, "COMPLETED", stepResults, [], implementationCallCount, startedAt);
  }

  #dependencySatisfied(
    request: SkillRunRequest,
    index: number,
    stepResults: SkillStepResult[]
  ): boolean {
    if (index === 0) return true;
    const payload = (request.capabilityRequests[index]?.inputEnvelope as {
      payload?: Record<string, unknown>;
    } | undefined)?.payload;
    if (payload === undefined) return false;

    if (request.workflowId === "case_intake_candidate") {
      const handoffOutput = stepResults[0]?.executionOutcome?.outputPayload as
        | Record<string, unknown>
        | undefined;
      if (index === 1) {
        return payload.expectedSourceVersion === handoffOutput?.sourceVersion;
      }
      const evaluationOutput = stepResults[1]?.executionOutcome?.outputPayload as
        | Record<string, unknown>
        | undefined;
      return payload.expectedSourceVersion === handoffOutput?.sourceVersion &&
        payload.completenessEvaluationRef === evaluationOutput?.evaluationRef;
    }

    if (request.workflowId === "day1_ready_card_candidate" && index === 1) {
      const evaluationOutput = stepResults[0]?.executionOutcome?.outputPayload as
        | Record<string, unknown>
        | undefined;
      return payload.readinessEvaluationRef === evaluationOutput?.evaluationId &&
        payload.expectedCaseVersion === evaluationOutput?.caseVersion;
    }

    return true;
  }

  #practiceHandoff(
    request: SkillRunRequest,
    signal: PracticeHandoffSignal,
    startedAt: Date
  ): SkillRunResult {
    const handoffAuditRef = this.#idFactory();
    const recorded = this.#appendAudit(
      request,
      handoffAuditRef,
      "skill_practice_handoff",
      signal.reasonCodes,
      undefined,
      "PRACTICE_HANDOFF"
    );
    if (!recorded) {
      return this.#result(request, "FAILED", [], ["AUDIT_UNAVAILABLE"], 0, null, startedAt);
    }
    const finalAuditRef = this.#idFactory();
    const finalized = this.#appendAudit(
      request,
      finalAuditRef,
      "skill_run_finalized",
      signal.reasonCodes,
      undefined,
      "PRACTICE_HANDOFF"
    );
    if (!finalized) {
      return this.#result(request, "FAILED", [], ["AUDIT_UNAVAILABLE"], 0, null, startedAt);
    }
    const result = this.#result(
      request,
      "PRACTICE_HANDOFF",
      [],
      signal.reasonCodes,
      0,
      finalAuditRef,
      startedAt,
      {
        ...signal,
        originSkillId: request.skillRef.skillId,
        originSkillVersion: request.skillRef.skillVersion,
        taskRef: request.taskId,
        handoffStatus: "CANDIDATE_ONLY",
        formalReviewCreated: false,
        professionalDecisionMade: false
      }
    );
    return result;
  }

  #finalize(
    request: SkillRunRequest,
    status: SkillRunResult["status"],
    stepResults: SkillStepResult[],
    reasonCodes: CanonicalReasonCode[],
    implementationCallCount: number,
    startedAt: Date
  ): SkillRunResult {
    const auditRef = this.#idFactory();
    const recorded = this.#appendAudit(
      request,
      auditRef,
      "skill_run_finalized",
      reasonCodes,
      undefined,
      status
    );
    return this.#result(
      request,
      recorded ? status : "FAILED",
      stepResults,
      recorded ? reasonCodes : ["AUDIT_UNAVAILABLE"],
      implementationCallCount,
      recorded ? auditRef : null,
      startedAt
    );
  }

  #result(
    request: SkillRunRequest,
    status: SkillRunResult["status"],
    stepResults: SkillStepResult[],
    reasonCodes: CanonicalReasonCode[],
    implementationCallCount: number,
    auditRef: string | null,
    startedAt: Date,
    practiceHandoff?: SkillRunResult["practiceHandoff"]
  ): SkillRunResult {
    return skillRunResultSchema.parse({
      skillRunId: request.skillRunId,
      skillRef: request.skillRef,
      workflowId: request.workflowId,
      taskId: request.taskId,
      attemptId: request.attemptId,
      routeDecisionRef: request.routeDecisionRef,
      status,
      stepResults,
      ...(practiceHandoff === undefined ? {} : { practiceHandoff }),
      reasonCodes,
      capabilityRequestCount: stepResults.length,
      implementationCallCount,
      independentCapabilityAudit: true,
      formalStateChanged: false,
      externalSideEffect: false,
      outboundMessageSent: false,
      realCustomerDataProcessed: false,
      unsafeToolFallbackCount: 0,
      domainCompletionClaimed: false,
      auditRef,
      startedAt: startedAt.toISOString(),
      completedAt: this.#now().toISOString()
    });
  }

  #appendAudit(
    request: SkillRunRequest,
    auditRef: string,
    eventType: SkillAuditEvent["eventType"],
    reasonCodes: string[],
    capabilityRequest?: SkillRunRequest["capabilityRequests"][number],
    status?: SkillRunResult["status"]
  ): boolean {
    const event: SkillAuditEvent = {
      auditRef,
      eventType,
      skillRunId: request.skillRunId,
      skillId: request.skillRef.skillId,
      skillVersion: request.skillRef.skillVersion,
      workflowId: request.workflowId,
      taskId: request.taskId,
      attemptId: request.attemptId,
      ...(capabilityRequest === undefined ? {} : {
        capabilityRequestId: capabilityRequest.capabilityRequestId,
        capabilityId: capabilityRequest.capabilityRef.capabilityId
      }),
      tenantId: request.requestContext.tenantId,
      dataSpaceId: request.requestContext.dataSpaceId,
      actorId: request.requestContext.actorId,
      ...(status === undefined ? {} : { status }),
      reasonCodes,
      occurredAt: this.#now().toISOString()
    };
    return this.#auditSink.append(event);
  }
}
