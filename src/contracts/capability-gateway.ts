import { z } from "zod";
import {
  actionClassSchema,
  capabilityStatusSchema,
  payloadSchemaNameSchema,
  phcSchema,
  resultStatusSchema,
  semanticVersionSchema,
  sideEffectClassSchema
} from "./capability.js";
import { canonicalReasonCodeSchema } from "../capabilities/reason-codes.js";

const refSchema = z.string().min(1);
const dateTimeSchema = z.string().datetime();
const purposeSchema = z.enum(["onboarding_operation", "review", "audit"]);

export const unresolvedCapabilityRefSchema = z.object({
  capabilityId: refSchema,
  capabilityVersion: semanticVersionSchema
}).strict();

export const capabilityAuthorizationDecisionSchema = z.object({
  decisionId: refSchema,
  result: z.enum([
    "allow",
    "deny",
    "step_up_required",
    "review_required",
    "context_refresh_required",
    "indeterminate"
  ]),
  reasonCode: canonicalReasonCodeSchema.optional(),
  policyVersion: refSchema,
  grantVersion: refSchema,
  enforcementPoint: z.literal("capability_gateway"),
  capabilityRef: unresolvedCapabilityRefSchema,
  tenantId: refSchema,
  dataSpaceId: refSchema,
  actorId: refSchema,
  actionClass: actionClassSchema,
  purpose: purposeSchema
}).strict();

export const gatewayResourceRefSchema = z.object({
  resourceType: refSchema,
  resourceId: refSchema,
  tenantId: refSchema,
  dataSpaceId: refSchema,
  sensitivity: z.enum([
    "SYNTHETIC_PUBLIC",
    "SYNTHETIC_INTERNAL",
    "SYNTHETIC_SENSITIVE"
  ]),
  expectedVersion: refSchema.optional()
}).strict();

export const collectionCursorBindingSchema = z.object({
  tenantId: refSchema,
  dataSpaceId: refSchema,
  actorId: refSchema,
  purpose: purposeSchema,
  capabilityId: refSchema,
  capabilityVersion: semanticVersionSchema,
  grantVersion: refSchema,
  queryDigest: refSchema,
  predicateRef: refSchema,
  fieldProjectionRef: refSchema,
  sortSpecRef: refSchema,
  snapshotAt: dateTimeSchema,
  expiresAt: dateTimeSchema,
  integrityValid: z.boolean()
}).strict();

export const collectionAdmissionSchema = z.object({
  predicateRef: refSchema,
  fieldProjectionRef: refSchema,
  grantVersion: refSchema,
  queryDigest: refSchema,
  sortSpecRef: refSchema,
  snapshotAt: dateTimeSchema,
  countDisclosureAllowed: z.boolean(),
  cursor: collectionCursorBindingSchema.optional()
}).strict();

export const capabilityGatewayRequestSchema = z.object({
  gatewayRequestVersion: z.literal("1"),
  capabilityRequestId: refSchema,
  taskId: refSchema,
  attemptId: refSchema,
  routeDecisionRef: refSchema,
  requestContext: z.unknown(),
  capabilityRef: unresolvedCapabilityRefSchema,
  resourceRefs: z.array(gatewayResourceRefSchema).min(1),
  actionClass: actionClassSchema,
  purpose: purposeSchema,
  inputEnvelope: z.unknown(),
  authorizationDecision: capabilityAuthorizationDecisionSchema,
  risk: z.object({
    phc: phcSchema,
    prohibition: z.enum(["NONE", "AGENT_PROHIBITED", "SYSTEM_HARD_BLOCK"])
  }).strict(),
  review: z.object({
    status: z.enum(["NOT_REQUIRED", "SATISFIED", "REQUIRED", "MISSING"]),
    reviewRef: refSchema.optional()
  }).strict(),
  collectionAdmission: collectionAdmissionSchema.optional(),
  createdAt: dateTimeSchema,
  expiresAt: dateTimeSchema
}).strict();

const bindingHealthSchema = z.enum(["HEALTHY", "UNHEALTHY", "UNKNOWN"]);
const bindingScopePolicySchema = z.literal("REQUEST_TENANT_AND_DATA_SPACE");

export const physicalToolBindingSchema = z.object({
  bindingRef: refSchema,
  runtimeProvider: refSchema,
  toolName: refSchema,
  implementedCapabilityId: refSchema,
  supportedCapabilityVersions: z.array(semanticVersionSchema).min(1),
  allowedEnvironments: z.array(z.enum(["design", "test"])).min(1),
  scopePolicy: bindingScopePolicySchema,
  credentialRef: refSchema,
  inputAdapterVersion: semanticVersionSchema,
  outputAdapterVersion: semanticVersionSchema,
  timeoutMs: z.number().int().positive(),
  maxAttempts: z.literal(1),
  retryAllowed: z.literal(false),
  circuitPolicyRef: refSchema,
  sideEffectClass: sideEffectClassSchema,
  receiptSupport: z.literal(false),
  auditSupport: z.literal(true),
  healthStatus: bindingHealthSchema,
  approvedBy: refSchema,
  approvalRef: refSchema
}).strict();

export const connectorBindingSchema = z.object({
  bindingRef: refSchema,
  connectorId: refSchema,
  implementedCapabilityId: refSchema,
  supportedCapabilityVersions: z.array(semanticVersionSchema).min(1),
  allowedEnvironments: z.array(z.enum(["design", "test"])).min(1),
  scopePolicy: bindingScopePolicySchema,
  credentialRef: refSchema,
  timeoutMs: z.number().int().positive(),
  maxAttempts: z.literal(1),
  retryAllowed: z.literal(false),
  circuitPolicyRef: refSchema,
  sideEffectClass: sideEffectClassSchema,
  receiptSupport: z.literal(false),
  auditSupport: z.literal(true),
  healthStatus: bindingHealthSchema,
  approvedBy: refSchema,
  approvalRef: refSchema
}).strict();

export const capabilityImplementationBindingSchema = z.object({
  bindingRef: refSchema,
  implementedCapabilityId: refSchema,
  supportedCapabilityVersions: z.array(semanticVersionSchema).min(1),
  implementationName: refSchema,
  implementationVersion: semanticVersionSchema,
  mode: z.enum(["INTERNAL_CORE", "TEST_STUB", "PHYSICAL_TOOL", "CONNECTOR_ADAPTER"]),
  allowedEnvironments: z.array(z.enum(["design", "test"])).min(1),
  scopePolicy: bindingScopePolicySchema,
  inputSchemaRef: payloadSchemaNameSchema,
  outputSchemaRef: payloadSchemaNameSchema,
  timeoutMs: z.number().int().positive(),
  maxAttempts: z.literal(1),
  retryAllowed: z.literal(false),
  circuitPolicyRef: refSchema,
  sideEffectClass: sideEffectClassSchema,
  auditSupport: z.literal(true),
  healthStatus: bindingHealthSchema,
  featureFlagRef: refSchema,
  approvedBy: refSchema,
  approvalRef: refSchema,
  physicalToolBinding: physicalToolBindingSchema.optional(),
  connectorBinding: connectorBindingSchema.optional()
}).strict();

export const capabilityRuntimeStateSchema = z.object({
  capabilityId: refSchema,
  capabilityVersion: semanticVersionSchema,
  status: capabilityStatusSchema,
  featureEnabled: z.boolean(),
  allowedEnvironments: z.array(z.enum(["design", "test"])).min(1),
  implementationBinding: capabilityImplementationBindingSchema.nullable()
}).strict();

export const capabilityGatewayResultSchema = z.object({
  resultId: refSchema,
  capabilityRequestId: refSchema,
  decision: z.enum([
    "DENY",
    "SYSTEM_HARD_BLOCK",
    "REVIEW_REQUIRED",
    "WAITING",
    "ALLOW_TO_IMPLEMENTATION"
  ]),
  resultStatus: resultStatusSchema,
  reasonCodes: z.array(canonicalReasonCodeSchema),
  resolvedCapabilityRef: unresolvedCapabilityRefSchema.optional(),
  implementationBindingRef: refSchema.optional(),
  mayInvokeImplementation: z.boolean(),
  implementationInvoked: z.literal(false),
  externalSideEffect: z.literal(false),
  auditRef: refSchema.nullable(),
  evaluatedAt: dateTimeSchema
}).strict().superRefine((value, context) => {
  if (value.decision !== "ALLOW_TO_IMPLEMENTATION" && value.mayInvokeImplementation) {
    context.addIssue({ code: "custom", message: "rejected decisions cannot invoke an implementation" });
  }
  if (value.decision === "ALLOW_TO_IMPLEMENTATION" && !value.mayInvokeImplementation) {
    context.addIssue({ code: "custom", message: "allowed admission must expose the next-stage permission" });
  }
  if (value.decision !== "ALLOW_TO_IMPLEMENTATION" && value.reasonCodes.length === 0) {
    context.addIssue({ code: "custom", message: "rejected decisions require a reason code" });
  }
});

export type CapabilityGatewayRequest = z.infer<typeof capabilityGatewayRequestSchema>;
export type CapabilityGatewayResult = z.infer<typeof capabilityGatewayResultSchema>;
export type CapabilityRuntimeState = z.infer<typeof capabilityRuntimeStateSchema>;
export type CapabilityImplementationBinding = z.infer<typeof capabilityImplementationBindingSchema>;
