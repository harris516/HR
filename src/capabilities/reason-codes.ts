import { z } from "zod";
import { resultStatusSchema } from "../contracts/capability.js";

export const capabilityReasonCodes = [
  "SKILL_NOT_AVAILABLE",
  "CAPABILITY_NOT_REGISTERED",
  "CAPABILITY_NOT_EXECUTABLE",
  "CAPABILITY_CONTRACT_INVALID",
  "CAPABILITY_VERSION_UNSUPPORTED",
  "IMPLEMENTATION_NOT_AVAILABLE",
  "TOOL_BINDING_NOT_AVAILABLE",
  "CONNECTOR_BINDING_NOT_AVAILABLE",
  "CAPABILITY_INPUT_INVALID",
  "CAPABILITY_OUTPUT_INVALID",
  "SOURCE_UNAVAILABLE",
  "SOURCE_POLICY_MISSING",
  "SOURCE_STALE",
  "MAPPING_UNKNOWN",
  "PRACTICE_NOT_AVAILABLE",
  "EXECUTION_TIMED_OUT",
  "AUDIT_UNAVAILABLE",
  "OBJECT_VERSION_CONFLICT",
  "IDEMPOTENCY_KEY_CONFLICT",
  "COLLECTION_CURSOR_INVALID"
] as const;

export const capabilityReasonCodeSchema = z.enum(capabilityReasonCodes);

export const importedReasonCodes = [
  "AUTHENTICATION_REQUIRED",
  "REQUEST_CONTEXT_INVALID",
  "REQUEST_CONTEXT_EXPIRED",
  "TENANT_MISSING_OR_MISMATCH",
  "DATA_SPACE_MISSING_OR_MISMATCH",
  "PURPOSE_NOT_ALLOWED",
  "SESSION_BINDING_INVALID",
  "ACTOR_SUSPENDED",
  "ACTION_NOT_ALLOWED",
  "AUTHORIZATION_INDETERMINATE",
  "CAPABILITY_NOT_AVAILABLE",
  "CONTEXT_REFRESH_REQUIRED",
  "REVIEW_REQUIRED",
  "STEP_UP_REQUIRED",
  "IDENTITY_CONFLICT",
  "MAPPING_STALE",
  "MULTIPLE_SUBJECTS",
  "SUBJECT_ACCESS_DENIED",
  "SUBJECT_NOT_FOUND",
  "UNKNOWN_INTENT",
  "REQUEST_ID_CONFLICT",
  "DUPLICATE_REQUEST",
  "FORMAL_COMMIT_PROHIBITED",
  "EXTERNAL_EFFECT_PROHIBITED",
  "INTENT_OUT_OF_SCOPE",
  "INTENT_UNKNOWN",
  "PROHIBITED_ACTION"
] as const;

export const importedReasonCodeSchema = z.enum(importedReasonCodes);
export const canonicalReasonCodeSchema = z.union([
  capabilityReasonCodeSchema,
  importedReasonCodeSchema
]);

const reasonCodeEntrySchema = z.object({
  code: capabilityReasonCodeSchema,
  resultStatuses: z.array(resultStatusSchema).min(1),
  owner: z.enum(["07", "08", "09", "12", "13", "14", "20", "12/20", "14/20"])
}).strict();

export const capabilityReasonCodeRegistrySchema = z.object({
  registryUri: z.literal("reason://hr-onboarding/capability/v1"),
  version: z.literal("1"),
  owner: z.literal("root"),
  importedRegistries: z.tuple([
    z.literal("10/request-context"),
    z.literal("10/authorization"),
    z.literal("10/subject-resolution"),
    z.literal("11/task-navigation"),
    z.literal("09/source-data-policy")
  ]),
  entries: z.array(reasonCodeEntrySchema).length(capabilityReasonCodes.length)
}).strict();

export const capabilityReasonCodeRegistry = capabilityReasonCodeRegistrySchema.parse({
  registryUri: "reason://hr-onboarding/capability/v1",
  version: "1",
  owner: "root",
  importedRegistries: [
    "10/request-context",
    "10/authorization",
    "10/subject-resolution",
    "11/task-navigation",
    "09/source-data-policy"
  ],
  entries: [
    { code: "SKILL_NOT_AVAILABLE", resultStatuses: ["DENIED"], owner: "12" },
    { code: "CAPABILITY_NOT_REGISTERED", resultStatuses: ["DENIED"], owner: "12" },
    { code: "CAPABILITY_NOT_EXECUTABLE", resultStatuses: ["DENIED"], owner: "12" },
    { code: "CAPABILITY_CONTRACT_INVALID", resultStatuses: ["FAILED"], owner: "12" },
    { code: "CAPABILITY_VERSION_UNSUPPORTED", resultStatuses: ["DENIED"], owner: "12" },
    { code: "IMPLEMENTATION_NOT_AVAILABLE", resultStatuses: ["FAILED"], owner: "12/20" },
    { code: "TOOL_BINDING_NOT_AVAILABLE", resultStatuses: ["DENIED"], owner: "14" },
    { code: "CONNECTOR_BINDING_NOT_AVAILABLE", resultStatuses: ["DENIED"], owner: "14" },
    { code: "CAPABILITY_INPUT_INVALID", resultStatuses: ["FAILED"], owner: "12" },
    { code: "CAPABILITY_OUTPUT_INVALID", resultStatuses: ["FAILED"], owner: "12" },
    { code: "SOURCE_UNAVAILABLE", resultStatuses: ["WAITING", "INDETERMINATE"], owner: "09" },
    { code: "SOURCE_POLICY_MISSING", resultStatuses: ["INDETERMINATE"], owner: "09" },
    { code: "SOURCE_STALE", resultStatuses: ["WAITING", "INDETERMINATE"], owner: "09" },
    { code: "MAPPING_UNKNOWN", resultStatuses: ["INDETERMINATE"], owner: "09" },
    { code: "PRACTICE_NOT_AVAILABLE", resultStatuses: ["REVIEW_REQUIRED"], owner: "13" },
    { code: "EXECUTION_TIMED_OUT", resultStatuses: ["TIMED_OUT"], owner: "12/20" },
    { code: "AUDIT_UNAVAILABLE", resultStatuses: ["FAILED"], owner: "07" },
    { code: "OBJECT_VERSION_CONFLICT", resultStatuses: ["FAILED"], owner: "08" },
    { code: "IDEMPOTENCY_KEY_CONFLICT", resultStatuses: ["FAILED"], owner: "08" },
    { code: "COLLECTION_CURSOR_INVALID", resultStatuses: ["DENIED"], owner: "12" }
  ]
});

export type CapabilityReasonCode = z.infer<typeof capabilityReasonCodeSchema>;
