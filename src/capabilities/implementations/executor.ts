import type {
  CapabilityExecutionAuditEvent,
  CapabilityExecutionAuditSink
} from "../../audit/capability-execution-audit.js";
import {
  capabilityExecutionOutcomeSchema,
  type CapabilityExecutionOutcome
} from "../../contracts/capability-execution.js";
import {
  capabilityGatewayRequestSchema,
  capabilityGatewayResultSchema,
  type CapabilityGatewayRequest,
  type CapabilityGatewayResult
} from "../../contracts/capability-gateway.js";
import type { CapabilityEntry, ResultStatus } from "../../contracts/capability.js";
import { validateRequestContext } from "../../navigation/context-gate.js";
import { digestCapabilityPayload } from "../gateway.js";
import { capabilityRegistry } from "../registry.js";
import {
  capabilityPayloadSchemas,
  parseCapabilityInput
} from "../schema-registry.js";
import { SyntheticReadAnalyzeImplementationRegistry } from "./implementation-registry.js";
import { syntheticCapabilityStore, type SyntheticCapabilityStore } from "./synthetic-store.js";
import { SyntheticAdapterError, type AdapterReasonCode } from "./types.js";

type ExecutionReasonCode = AdapterReasonCode | "AUDIT_UNAVAILABLE" | "CAPABILITY_OUTPUT_INVALID" | "IMPLEMENTATION_NOT_AVAILABLE" | "CAPABILITY_INPUT_INVALID";

export interface SyntheticCapabilityExecutorOptions {
  implementationRegistry: SyntheticReadAnalyzeImplementationRegistry;
  auditSink: CapabilityExecutionAuditSink;
  store?: SyntheticCapabilityStore;
  now?: () => Date;
  idFactory?: () => string;
  allowSyntheticTestExecution: true;
}

export class SyntheticCapabilityExecutor {
  readonly #implementationRegistry: SyntheticReadAnalyzeImplementationRegistry;
  readonly #auditSink: CapabilityExecutionAuditSink;
  readonly #store: SyntheticCapabilityStore;
  readonly #now: () => Date;
  readonly #idFactory: () => string;
  #implementationCallCount = 0;

  constructor(options: SyntheticCapabilityExecutorOptions) {
    if (!options.allowSyntheticTestExecution) {
      throw new Error("synthetic capability execution requires explicit test-only opt-in");
    }
    this.#implementationRegistry = options.implementationRegistry;
    this.#auditSink = options.auditSink;
    this.#store = options.store ?? syntheticCapabilityStore;
    this.#now = options.now ?? (() => new Date());
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  get implementationCallCount(): number {
    return this.#implementationCallCount;
  }

  execute(requestInput: unknown, admissionInput: unknown): CapabilityExecutionOutcome {
    const startedAt = this.#now();
    const requestResult = capabilityGatewayRequestSchema.safeParse(requestInput);
    const admissionResult = capabilityGatewayResultSchema.safeParse(admissionInput);
    if (!requestResult.success || !admissionResult.success) {
      throw new Error("executor requires a valid gateway request and admission result");
    }
    const request = requestResult.data;
    const admission = admissionResult.data;
    const contextResult = validateRequestContext(request.requestContext, startedAt);
    if (!contextResult.ok) {
      throw new Error("executor received an invalid or expired request context");
    }
    const capability = capabilityRegistry.capabilities.find(
      (entry) => entry.capabilityId === request.capabilityRef.capabilityId &&
        entry.capabilityVersion === request.capabilityRef.capabilityVersion
    );
    if (capability === undefined) {
      throw new Error("executor received an unregistered capability");
    }
    const registration = this.#implementationRegistry.get(capability.capabilityId);
    const gatewayAllowed = admission.decision === "ALLOW_TO_IMPLEMENTATION" &&
      admission.mayInvokeImplementation &&
      !admission.implementationInvoked &&
      admission.capabilityRequestId === request.capabilityRequestId &&
      admission.resolvedCapabilityRef?.capabilityId === capability.capabilityId &&
      admission.resolvedCapabilityRef.capabilityVersion === capability.capabilityVersion;

    if (
      !gatewayAllowed ||
      registration === undefined ||
      admission.implementationBindingRef !== registration.binding.bindingRef
    ) {
      return this.#failure(
        request,
        admission,
        capability,
        registration?.binding.bindingRef ?? "implementation-unavailable",
        "FAILED",
        "IMPLEMENTATION_NOT_AVAILABLE",
        startedAt,
        false,
        admission.auditRef ?? "gateway-audit-unavailable"
      );
    }

    if (!this.#auditSink.isAvailable()) {
      return this.#failure(
        request,
        admission,
        capability,
        registration.binding.bindingRef,
        "FAILED",
        "AUDIT_UNAVAILABLE",
        startedAt,
        false,
        admission.auditRef ?? "gateway-audit-unavailable"
      );
    }

    const startAuditRef = this.#idFactory();
    const started = this.#auditSink.append(this.#auditEvent(
      request,
      capability,
      registration.binding.bindingRef,
      startAuditRef,
      "capability_implementation_started",
      [],
      startedAt
    ));
    if (!started) {
      return this.#failure(
        request,
        admission,
        capability,
        registration.binding.bindingRef,
        "FAILED",
        "AUDIT_UNAVAILABLE",
        startedAt,
        false,
        admission.auditRef ?? "gateway-audit-unavailable"
      );
    }

    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = parseCapabilityInput(capability.inputSchemaRef, request.inputEnvelope) as Record<string, unknown>;
    } catch {
      return this.#recordedFailure(
        request,
        admission,
        capability,
        registration.binding.bindingRef,
        "FAILED",
        "CAPABILITY_INPUT_INVALID",
        startedAt,
        false,
        startAuditRef
      );
    }

    try {
      this.#implementationCallCount += 1;
      const adapterResult = registration.adapter({
        request,
        requestContext: contextResult.context,
        capability,
        input: parsedInput,
        store: this.#store,
        now: this.#now(),
        idFactory: this.#idFactory
      });
      const outputResult = capabilityPayloadSchemas[capability.outputSchemaRef].safeParse(
        adapterResult.outputPayload
      );
      if (!outputResult.success) {
        return this.#recordedFailure(
          request,
          admission,
          capability,
          registration.binding.bindingRef,
          "FAILED",
          "CAPABILITY_OUTPUT_INVALID",
          startedAt,
          true,
          startAuditRef
        );
      }
      const completedAt = this.#now();
      const completedAuditRef = this.#idFactory();
      const recorded = this.#auditSink.append(this.#auditEvent(
        request,
        capability,
        registration.binding.bindingRef,
        completedAuditRef,
        "capability_implementation_completed",
        adapterResult.reasonCodes,
        completedAt,
        adapterResult.resultStatus
      ));
      if (!recorded) {
        return this.#failure(
          request,
          admission,
          capability,
          registration.binding.bindingRef,
          "FAILED",
          "AUDIT_UNAVAILABLE",
          startedAt,
          true,
          startAuditRef
        );
      }
      const outputDigest = digestCapabilityPayload(outputResult.data);
      return capabilityExecutionOutcomeSchema.parse({
        envelope: {
          schemaVersion: "1",
          capabilityResultId: this.#idFactory(),
          capabilityRef: request.capabilityRef,
          capabilityRequestRef: request.capabilityRequestId,
          requestId: contextResult.context.requestId,
          taskId: request.taskId,
          attemptId: request.attemptId,
          correlationId: contextResult.context.correlationId,
          requestContextRef: contextResult.context.integrityRef,
          authorizationDecisionRef: request.authorizationDecision.decisionId,
          tenantId: contextResult.context.tenantId,
          dataSpaceId: contextResult.context.dataSpaceId,
          resourceRefs: request.resourceRefs.map((resource) => resource.resourceId),
          inputPayloadDigest: (request.inputEnvelope as { inputPayloadDigest: string }).inputPayloadDigest,
          ...(adapterResult.inputSnapshotRef === undefined ? {} : { inputSnapshotRef: adapterResult.inputSnapshotRef }),
          outputPayloadSchemaRef: capability.outputSchemaRef,
          resultStatus: adapterResult.resultStatus,
          resultPayloadRef: outputDigest,
          reasonCodes: adapterResult.reasonCodes,
          sourceReferences: adapterResult.sourceReferences,
          freshnessResults: adapterResult.freshnessResults,
          policyVersionRefs: adapterResult.policyVersionRefs,
          objectVersionRefs: adapterResult.objectVersionRefs,
          implementationBindingRef: registration.binding.bindingRef,
          implementationVersion: registration.binding.implementationVersion,
          sideEffectClass: capability.sideEffectClass,
          auditRef: completedAuditRef,
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString()
        },
        outputPayload: outputResult.data,
        implementationInvoked: true,
        externalSideEffect: false
      });
    } catch (error) {
      if (error instanceof SyntheticAdapterError) {
        return this.#recordedFailure(
          request,
          admission,
          capability,
          registration.binding.bindingRef,
          error.resultStatus,
          error.reasonCode,
          startedAt,
          true,
          startAuditRef
        );
      }
      throw error;
    }
  }

  #recordedFailure(
    request: CapabilityGatewayRequest,
    admission: CapabilityGatewayResult,
    capability: CapabilityEntry,
    bindingRef: string,
    resultStatus: Extract<ResultStatus, "FAILED" | "WAITING" | "INDETERMINATE">,
    reasonCode: ExecutionReasonCode,
    startedAt: Date,
    implementationInvoked: boolean,
    fallbackAuditRef: string
  ): CapabilityExecutionOutcome {
    const failedAt = this.#now();
    const failedAuditRef = this.#idFactory();
    const recorded = this.#auditSink.append(this.#auditEvent(
      request,
      capability,
      bindingRef,
      failedAuditRef,
      "capability_implementation_failed",
      [reasonCode],
      failedAt,
      resultStatus
    ));
    return this.#failure(
      request,
      admission,
      capability,
      bindingRef,
      recorded ? resultStatus : "FAILED",
      recorded ? reasonCode : "AUDIT_UNAVAILABLE",
      startedAt,
      implementationInvoked,
      recorded ? failedAuditRef : fallbackAuditRef
    );
  }

  #failure(
    request: CapabilityGatewayRequest,
    _admission: CapabilityGatewayResult,
    capability: CapabilityEntry,
    bindingRef: string,
    resultStatus: Extract<ResultStatus, "FAILED" | "WAITING" | "INDETERMINATE">,
    reasonCode: ExecutionReasonCode,
    startedAt: Date,
    implementationInvoked: boolean,
    auditRef: string
  ): CapabilityExecutionOutcome {
    const context = request.requestContext as {
      requestId: string;
      correlationId: string;
      integrityRef: string;
      tenantId: string;
      dataSpaceId: string;
    };
    return capabilityExecutionOutcomeSchema.parse({
      envelope: {
        schemaVersion: "1",
        capabilityResultId: this.#idFactory(),
        capabilityRef: request.capabilityRef,
        capabilityRequestRef: request.capabilityRequestId,
        requestId: context.requestId,
        taskId: request.taskId,
        attemptId: request.attemptId,
        correlationId: context.correlationId,
        requestContextRef: context.integrityRef,
        authorizationDecisionRef: request.authorizationDecision.decisionId,
        tenantId: context.tenantId,
        dataSpaceId: context.dataSpaceId,
        resourceRefs: request.resourceRefs.map((resource) => resource.resourceId),
        inputPayloadDigest: (request.inputEnvelope as { inputPayloadDigest: string }).inputPayloadDigest,
        resultStatus,
        reasonCodes: [reasonCode],
        sourceReferences: [],
        freshnessResults: [],
        policyVersionRefs: [],
        objectVersionRefs: [],
        implementationBindingRef: bindingRef,
        implementationVersion: "1.0.0",
        sideEffectClass: capability.sideEffectClass,
        auditRef,
        startedAt: startedAt.toISOString(),
        completedAt: this.#now().toISOString()
      },
      implementationInvoked,
      externalSideEffect: false
    });
  }

  #auditEvent(
    request: CapabilityGatewayRequest,
    capability: CapabilityEntry,
    bindingRef: string,
    auditRef: string,
    eventType: CapabilityExecutionAuditEvent["eventType"],
    reasonCodes: string[],
    occurredAt: Date,
    resultStatus?: ResultStatus
  ): CapabilityExecutionAuditEvent {
    const context = request.requestContext as {
      tenantId: string;
      dataSpaceId: string;
      actorId: string;
    };
    return {
      auditRef,
      eventType,
      capabilityRequestId: request.capabilityRequestId,
      capabilityId: capability.capabilityId,
      capabilityVersion: capability.capabilityVersion,
      implementationBindingRef: bindingRef,
      tenantId: context.tenantId,
      dataSpaceId: context.dataSpaceId,
      actorId: context.actorId,
      ...(resultStatus === undefined ? {} : { resultStatus }),
      reasonCodes,
      occurredAt: occurredAt.toISOString()
    };
  }
}

