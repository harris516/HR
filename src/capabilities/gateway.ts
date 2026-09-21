import { createHash } from "node:crypto";
import type {
  CapabilityGatewayAuditEvent,
  CapabilityGatewayAuditSink
} from "../audit/capability-audit.js";
import {
  capabilityGatewayRequestSchema,
  capabilityGatewayResultSchema,
  capabilityRuntimeStateSchema,
  type CapabilityGatewayRequest,
  type CapabilityGatewayResult,
  type CapabilityRuntimeState
} from "../contracts/capability-gateway.js";
import type { CapabilityEntry, CapabilityId } from "../contracts/capability.js";
import { validateRequestContext } from "../navigation/context-gate.js";
import { capabilityProfiles } from "./profiles.js";
import { capabilityRegistry } from "./registry.js";
import { parseCapabilityInput } from "./schema-registry.js";

type GatewayReasonCode = CapabilityGatewayResult["reasonCodes"][number];

export interface CapabilityRuntimeStateResolver {
  resolve(entry: CapabilityEntry): unknown;
}

export interface CapabilityGatewayOptions {
  auditSink: CapabilityGatewayAuditSink;
  now?: () => Date;
  idFactory?: () => string;
  runtimeStateResolver?: CapabilityRuntimeStateResolver;
  allowSyntheticTestRuntimeOverrides?: boolean;
}

const executableStatuses = new Set([
  "TEST_STUB_ENABLED",
  "STAGING_ENABLED",
  "PRODUCTION_ENABLED"
]);

const collectionCapabilityIds = new Set<CapabilityId>([
  "hr.onboarding.case.list",
  "hr.onboarding.risk.list",
  "hr.onboarding.responsibility.workbox.read",
  "hr.onboarding.artifact.list",
  "hr.onboarding.audit.timeline.read"
]);

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)])
    );
  }
  return value;
}

export function digestCapabilityPayload(payload: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(stableValue(payload))).digest("hex")}`;
}

class BaselineRuntimeStateResolver implements CapabilityRuntimeStateResolver {
  resolve(entry: CapabilityEntry): CapabilityRuntimeState {
    return {
      capabilityId: entry.capabilityId,
      capabilityVersion: entry.capabilityVersion,
      status: entry.status,
      featureEnabled: entry.featureFlag.enabled,
      allowedEnvironments: [...capabilityProfiles.base.allowedEnvironments],
      implementationBinding: null
    };
  }
}

function readString(input: unknown, key: string): string | undefined {
  if (input === null || typeof input !== "object") {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNestedString(input: unknown, parent: string, key: string): string | undefined {
  if (input === null || typeof input !== "object") {
    return undefined;
  }
  return readString((input as Record<string, unknown>)[parent], key);
}

export class CapabilityGateway {
  readonly #auditSink: CapabilityGatewayAuditSink;
  readonly #now: () => Date;
  readonly #idFactory: () => string;
  readonly #runtimeStateResolver: CapabilityRuntimeStateResolver;

  constructor(options: CapabilityGatewayOptions) {
    if (options.runtimeStateResolver !== undefined && !options.allowSyntheticTestRuntimeOverrides) {
      throw new Error("runtime state overrides are test-only and require explicit opt-in");
    }
    this.#auditSink = options.auditSink;
    this.#now = options.now ?? (() => new Date());
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.#runtimeStateResolver = options.runtimeStateResolver ?? new BaselineRuntimeStateResolver();
  }

  resolve(input: unknown): CapabilityGatewayResult {
    const now = this.#now();
    const capabilityRequestId = readString(input, "capabilityRequestId") ?? "unknown-capability-request";
    const taskId = readString(input, "taskId");
    const capabilityId = readNestedString(input, "capabilityRef", "capabilityId");
    const capabilityVersion = readNestedString(input, "capabilityRef", "capabilityVersion");

    if (!this.#auditSink.isAvailable()) {
      return this.#result(capabilityRequestId, "DENY", "FAILED", "AUDIT_UNAVAILABLE", now, null);
    }

    const ingressRef = this.#idFactory();
    const ingressRecorded = this.#auditSink.append({
      auditRef: ingressRef,
      eventType: "capability_gateway_ingress",
      ...(capabilityRequestId === "unknown-capability-request" ? {} : { capabilityRequestId }),
      ...(taskId === undefined ? {} : { taskId }),
      ...(capabilityId === undefined ? {} : { capabilityId }),
      ...(capabilityVersion === undefined ? {} : { capabilityVersion }),
      reasonCodes: [],
      occurredAt: now.toISOString()
    });
    if (!ingressRecorded) {
      return this.#result(capabilityRequestId, "DENY", "FAILED", "AUDIT_UNAVAILABLE", now, null);
    }

    const parsed = capabilityGatewayRequestSchema.safeParse(input);
    if (!parsed.success) {
      return this.#reject(input, capabilityRequestId, "DENY", "FAILED", "CAPABILITY_INPUT_INVALID", now);
    }
    const request = parsed.data;

    if (new Date(request.createdAt).getTime() > now.getTime() || new Date(request.expiresAt).getTime() <= now.getTime()) {
      return this.#reject(request, request.capabilityRequestId, "WAITING", "WAITING", "REQUEST_CONTEXT_EXPIRED", now);
    }

    const contextResult = validateRequestContext(request.requestContext, now);
    if (!contextResult.ok) {
      return this.#reject(
        request,
        request.capabilityRequestId,
        contextResult.hardBlock ? "SYSTEM_HARD_BLOCK" : "DENY",
        contextResult.hardBlock ? "DENIED" : "FAILED",
        contextResult.reasonCode as GatewayReasonCode,
        now
      );
    }
    const context = contextResult.context;

    const entry = capabilityRegistry.capabilities.find(
      (candidate) => candidate.capabilityId === request.capabilityRef.capabilityId
    );
    if (entry === undefined) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "CAPABILITY_NOT_REGISTERED", now);
    }
    const resolvedRef = { capabilityId: entry.capabilityId, capabilityVersion: entry.capabilityVersion };
    if (entry.capabilityVersion !== request.capabilityRef.capabilityVersion) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "CAPABILITY_VERSION_UNSUPPORTED", now, resolvedRef);
    }

    const stateResult = capabilityRuntimeStateSchema.safeParse(this.#runtimeStateResolver.resolve(entry));
    if (!stateResult.success || stateResult.data.capabilityId !== entry.capabilityId || stateResult.data.capabilityVersion !== entry.capabilityVersion) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "FAILED", "CAPABILITY_CONTRACT_INVALID", now, resolvedRef);
    }
    const state = stateResult.data;
    if (!executableStatuses.has(state.status) || !state.featureEnabled) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "CAPABILITY_NOT_EXECUTABLE", now, resolvedRef);
    }
    if (!state.allowedEnvironments.includes(context.environment)) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "CAPABILITY_NOT_EXECUTABLE", now, resolvedRef);
    }

    const crossTenant = request.resourceRefs.some((resource) => resource.tenantId !== context.tenantId);
    if (crossTenant) {
      return this.#reject(request, request.capabilityRequestId, "SYSTEM_HARD_BLOCK", "DENIED", "TENANT_MISSING_OR_MISMATCH", now, resolvedRef);
    }
    const crossDataSpace = request.resourceRefs.some((resource) => resource.dataSpaceId !== context.dataSpaceId);
    if (crossDataSpace) {
      return this.#reject(request, request.capabilityRequestId, "SYSTEM_HARD_BLOCK", "DENIED", "DATA_SPACE_MISSING_OR_MISMATCH", now, resolvedRef);
    }
    if (request.purpose !== context.dataAccessPurpose) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "PURPOSE_NOT_ALLOWED", now, resolvedRef);
    }
    if (request.actionClass !== entry.actionClass) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "ACTION_NOT_ALLOWED", now, resolvedRef);
    }

    const applicableAuthorizationProfiles = capabilityProfiles.authorization.filter((profile) =>
      entry.authorizationProfileRefs.includes(profile.profileId)
    );
    if (
      applicableAuthorizationProfiles.length === 0 ||
      !applicableAuthorizationProfiles.some((profile) =>
        profile.allowedActorTypes.includes(context.actorType as "user" | "service_principal") &&
        profile.purposeAllowlist.includes(request.purpose)
      )
    ) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "PURPOSE_NOT_ALLOWED", now, resolvedRef);
    }

    const authorization = request.authorizationDecision;
    if (
      authorization.capabilityRef.capabilityId !== entry.capabilityId ||
      authorization.capabilityRef.capabilityVersion !== entry.capabilityVersion ||
      authorization.tenantId !== context.tenantId ||
      authorization.dataSpaceId !== context.dataSpaceId ||
      authorization.actorId !== context.actorId ||
      authorization.actionClass !== request.actionClass ||
      authorization.purpose !== request.purpose
    ) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "AUTHORIZATION_INDETERMINATE", now, resolvedRef);
    }
    if (authorization.result !== "allow") {
      const mapping: Record<typeof authorization.result, [CapabilityGatewayResult["decision"], CapabilityGatewayResult["resultStatus"], GatewayReasonCode]> = {
        deny: ["DENY", "DENIED", authorization.reasonCode ?? "ACTION_NOT_ALLOWED"],
        step_up_required: ["WAITING", "WAITING", "STEP_UP_REQUIRED"],
        review_required: ["REVIEW_REQUIRED", "REVIEW_REQUIRED", "REVIEW_REQUIRED"],
        context_refresh_required: ["WAITING", "WAITING", "CONTEXT_REFRESH_REQUIRED"],
        indeterminate: ["DENY", "INDETERMINATE", "AUTHORIZATION_INDETERMINATE"]
      };
      const [decision, resultStatus, reasonCode] = mapping[authorization.result];
      return this.#reject(request, request.capabilityRequestId, decision, resultStatus, reasonCode, now, resolvedRef);
    }

    if (request.risk.prohibition === "SYSTEM_HARD_BLOCK") {
      return this.#reject(request, request.capabilityRequestId, "SYSTEM_HARD_BLOCK", "DENIED", "PROHIBITED_ACTION", now, resolvedRef);
    }
    if (request.risk.prohibition === "AGENT_PROHIBITED") {
      return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "PROHIBITED_ACTION", now, resolvedRef);
    }
    if (!entry.allowedPHC.includes(request.risk.phc)) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "ACTION_NOT_ALLOWED", now, resolvedRef);
    }

    const sensitive = request.resourceRefs.some((resource) => resource.sensitivity === "SYNTHETIC_SENSITIVE");
    const reviewRequired =
      entry.reviewRequirement === "HUMAN_REVIEW_REQUIRED" ||
      entry.reviewRequirement === "PHC_4_FACTS_ONLY" ||
      (entry.reviewRequirement === "HUMAN_REVIEW_IF_SENSITIVE" && sensitive);
    if (reviewRequired && (request.review.status !== "SATISFIED" || request.review.reviewRef === undefined)) {
      return this.#reject(request, request.capabilityRequestId, "REVIEW_REQUIRED", "REVIEW_REQUIRED", "REVIEW_REQUIRED", now, resolvedRef);
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = parseCapabilityInput(entry.inputSchemaRef, request.inputEnvelope);
    } catch {
      return this.#reject(request, request.capabilityRequestId, "DENY", "FAILED", "CAPABILITY_INPUT_INVALID", now, resolvedRef);
    }
    const envelope = request.inputEnvelope as { inputPayloadDigest?: unknown };
    const capabilityRequestRef = (request.inputEnvelope as { capabilityRequestRef?: unknown }).capabilityRequestRef;
    if (
      capabilityRequestRef !== request.capabilityRequestId ||
      envelope.inputPayloadDigest !== digestCapabilityPayload(parsedPayload)
    ) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "FAILED", "CAPABILITY_INPUT_INVALID", now, resolvedRef);
    }

    if (collectionCapabilityIds.has(entry.capabilityId)) {
      const collectionFailure = this.#validateCollectionAdmission(request, parsedPayload, context.actorId, now);
      if (collectionFailure !== undefined) {
        return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", collectionFailure, now, resolvedRef);
      }
    }

    const binding = state.implementationBinding;
    if (
      binding === null ||
      binding.healthStatus !== "HEALTHY" ||
      binding.implementedCapabilityId !== entry.capabilityId ||
      !binding.supportedCapabilityVersions.includes(entry.capabilityVersion) ||
      !binding.allowedEnvironments.includes(context.environment) ||
      binding.inputSchemaRef !== entry.inputSchemaRef ||
      binding.outputSchemaRef !== entry.outputSchemaRef ||
      binding.sideEffectClass !== entry.sideEffectClass ||
      binding.featureFlagRef !== entry.featureFlag.key
    ) {
      return this.#reject(request, request.capabilityRequestId, "DENY", "FAILED", "IMPLEMENTATION_NOT_AVAILABLE", now, resolvedRef);
    }
    if (binding.mode === "PHYSICAL_TOOL" || binding.mode === "CONNECTOR_ADAPTER") {
      const tool = binding.physicalToolBinding;
      if (
        tool === undefined ||
        tool.healthStatus !== "HEALTHY" ||
        tool.implementedCapabilityId !== entry.capabilityId ||
        !tool.supportedCapabilityVersions.includes(entry.capabilityVersion) ||
        !tool.allowedEnvironments.includes(context.environment) ||
        tool.sideEffectClass !== entry.sideEffectClass
      ) {
        return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "TOOL_BINDING_NOT_AVAILABLE", now, resolvedRef);
      }
    }
    if (binding.mode === "CONNECTOR_ADAPTER") {
      const connector = binding.connectorBinding;
      if (
        connector === undefined ||
        connector.healthStatus !== "HEALTHY" ||
        connector.implementedCapabilityId !== entry.capabilityId ||
        !connector.supportedCapabilityVersions.includes(entry.capabilityVersion) ||
        !connector.allowedEnvironments.includes(context.environment) ||
        connector.sideEffectClass !== entry.sideEffectClass
      ) {
        return this.#reject(request, request.capabilityRequestId, "DENY", "DENIED", "CONNECTOR_BINDING_NOT_AVAILABLE", now, resolvedRef);
      }
    }

    return this.#allow(request, binding.bindingRef, resolvedRef, now);
  }

  #validateCollectionAdmission(
    request: CapabilityGatewayRequest,
    parsedPayload: unknown,
    actorId: string,
    now: Date
  ): GatewayReasonCode | undefined {
    const admission = request.collectionAdmission;
    if (admission === undefined) {
      return "ACTION_NOT_ALLOWED";
    }
    if (admission.grantVersion !== request.authorizationDecision.grantVersion) {
      return "ACTION_NOT_ALLOWED";
    }
    const payload = parsedPayload as Record<string, unknown>;
    const cursor = admission.cursor;
    if (payload.pageToken !== undefined && cursor === undefined) {
      return "COLLECTION_CURSOR_INVALID";
    }
    if (cursor === undefined) {
      return undefined;
    }
    if (
      !cursor.integrityValid ||
      new Date(cursor.expiresAt).getTime() <= now.getTime() ||
      cursor.tenantId !== (request.requestContext as { tenantId: string }).tenantId ||
      cursor.dataSpaceId !== (request.requestContext as { dataSpaceId: string }).dataSpaceId ||
      cursor.actorId !== actorId ||
      cursor.purpose !== request.purpose ||
      cursor.capabilityId !== request.capabilityRef.capabilityId ||
      cursor.capabilityVersion !== request.capabilityRef.capabilityVersion ||
      cursor.grantVersion !== admission.grantVersion ||
      cursor.queryDigest !== admission.queryDigest ||
      cursor.predicateRef !== admission.predicateRef ||
      cursor.fieldProjectionRef !== admission.fieldProjectionRef ||
      cursor.sortSpecRef !== admission.sortSpecRef ||
      cursor.snapshotAt !== admission.snapshotAt
    ) {
      return "COLLECTION_CURSOR_INVALID";
    }
    return undefined;
  }

  #allow(
    request: CapabilityGatewayRequest,
    implementationBindingRef: string,
    resolvedCapabilityRef: { capabilityId: CapabilityId; capabilityVersion: string },
    now: Date
  ): CapabilityGatewayResult {
    const auditRef = this.#idFactory();
    const result = this.#result(
      request.capabilityRequestId,
      "ALLOW_TO_IMPLEMENTATION",
      "SUCCESS",
      undefined,
      now,
      auditRef,
      resolvedCapabilityRef,
      implementationBindingRef,
      true
    );
    const recorded = this.#auditSink.append(this.#event(request, result, auditRef, "capability_gateway_admission_allowed", now));
    return recorded
      ? result
      : this.#result(request.capabilityRequestId, "DENY", "FAILED", "AUDIT_UNAVAILABLE", now, null, resolvedCapabilityRef);
  }

  #reject(
    input: unknown,
    capabilityRequestId: string,
    decision: CapabilityGatewayResult["decision"],
    resultStatus: CapabilityGatewayResult["resultStatus"],
    reasonCode: GatewayReasonCode,
    now: Date,
    resolvedCapabilityRef?: { capabilityId: CapabilityId; capabilityVersion: string }
  ): CapabilityGatewayResult {
    const auditRef = this.#idFactory();
    const result = this.#result(
      capabilityRequestId,
      decision,
      resultStatus,
      reasonCode,
      now,
      auditRef,
      resolvedCapabilityRef
    );
    const recorded = this.#auditSink.append(this.#event(input, result, auditRef, "capability_gateway_rejected", now));
    return recorded
      ? result
      : this.#result(capabilityRequestId, "DENY", "FAILED", "AUDIT_UNAVAILABLE", now, null, resolvedCapabilityRef);
  }

  #event(
    input: unknown,
    result: CapabilityGatewayResult,
    auditRef: string,
    eventType: CapabilityGatewayAuditEvent["eventType"],
    now: Date
  ): CapabilityGatewayAuditEvent {
    const context = input !== null && typeof input === "object"
      ? (input as Record<string, unknown>).requestContext
      : undefined;
    const taskId = readString(input, "taskId");
    const capabilityId = readNestedString(input, "capabilityRef", "capabilityId");
    const capabilityVersion = readNestedString(input, "capabilityRef", "capabilityVersion");
    const tenantId = readString(context, "tenantId");
    const dataSpaceId = readString(context, "dataSpaceId");
    const actorId = readString(context, "actorId");
    return {
      auditRef,
      eventType,
      capabilityRequestId: result.capabilityRequestId,
      ...(taskId === undefined ? {} : { taskId }),
      ...(capabilityId === undefined ? {} : { capabilityId }),
      ...(capabilityVersion === undefined ? {} : { capabilityVersion }),
      ...(tenantId === undefined ? {} : { tenantId }),
      ...(dataSpaceId === undefined ? {} : { dataSpaceId }),
      ...(actorId === undefined ? {} : { actorId }),
      decision: result.decision,
      reasonCodes: result.reasonCodes,
      occurredAt: now.toISOString()
    };
  }

  #result(
    capabilityRequestId: string,
    decision: CapabilityGatewayResult["decision"],
    resultStatus: CapabilityGatewayResult["resultStatus"],
    reasonCode: GatewayReasonCode | undefined,
    now: Date,
    auditRef: string | null,
    resolvedCapabilityRef?: { capabilityId: CapabilityId; capabilityVersion: string },
    implementationBindingRef?: string,
    mayInvokeImplementation = false
  ): CapabilityGatewayResult {
    return capabilityGatewayResultSchema.parse({
      resultId: this.#idFactory(),
      capabilityRequestId,
      decision,
      resultStatus,
      reasonCodes: reasonCode === undefined ? [] : [reasonCode],
      ...(resolvedCapabilityRef === undefined ? {} : { resolvedCapabilityRef }),
      ...(implementationBindingRef === undefined ? {} : { implementationBindingRef }),
      mayInvokeImplementation,
      implementationInvoked: false,
      externalSideEffect: false,
      auditRef,
      evaluatedAt: now.toISOString()
    });
  }
}
