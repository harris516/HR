import { z } from "zod";

export const baselineComponentIds = [
  "10_identity_runtime",
  "11_task_navigation",
  "12_skill_capability",
  "13_industry_practice",
  "14_mcp_connector",
  "15_output_artifact",
  "16_security_human_review"
] as const;

export const practicePackIds = [
  "hr_employment_contract_onboarding_practice_pack",
  "hr_employment_eligibility_verification_practice_pack",
  "hr_onboarding_exception_governance_practice_pack"
] as const;

export const p0OutputSpecIds = [
  "hr.onboarding.output.intake_handoff_card",
  "hr.onboarding.output.weekly_exception_workbox",
  "hr.onboarding.output.responsibility_workbox",
  "hr.onboarding.output.contract_consistency_check",
  "hr.onboarding.output.contract_exception_review_packet",
  "hr.onboarding.output.exception_governance_workpaper",
  "hr.onboarding.output.day1_ready_delivery_card"
] as const;

export const securityControlIds = [
  "SEC-C001",
  "SEC-C002",
  "SEC-C003",
  "SEC-C004",
  "SEC-C005",
  "SEC-C006",
  "SEC-C007",
  "SEC-C008",
  "SEC-C009",
  "SEC-C010",
  "SEC-C011",
  "SEC-C012"
] as const;

export const formalActionCapabilityIds = [
  "hr.onboarding.review.create",
  "hr.onboarding.review.decision.commit",
  "hr.onboarding.requirement.complete",
  "hr.onboarding.requirement.waiver.commit",
  "hr.onboarding.exception.accept",
  "hr.onboarding.frozen_action.create",
  "hr.onboarding.frozen_action.release",
  "hr.onboarding.ready.confirm",
  "hr.onboarding.artifact.export",
  "hr.onboarding.notification.send"
] as const;

export const formalActionIds = [
  ...formalActionCapabilityIds,
  "external.write.target_specific"
] as const;

const componentSchema = z.object({
  componentId: z.enum(baselineComponentIds),
  documentVersion: z.string().regex(/^v\d+\.\d+$/),
  documentDigestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourcePaths: z.array(z.string().min(1)).min(1),
  digestMode: z.enum(["SINGLE_FILE", "ORDERED_FILE_SET"]),
  maturity: z.enum(["RUNTIME_VERIFIED", "DESIGN_READY_DISABLED"]),
  executionAllowed: z.literal(false)
}).strict();

const disabledRegistryEntrySchema = <T extends readonly [string, ...string[]]>(ids: T) => z.object({
  id: z.enum(ids),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  status: z.literal("DESIGN_READY_DISABLED"),
  runtimeBindingRef: z.null()
}).strict();

const formalActionSchema = z.object({
  formalActionId: z.enum(formalActionIds),
  capabilityId: z.enum(formalActionCapabilityIds).nullable(),
  sideEffectClass: z.enum(["INTERNAL_COMMIT", "OUTBOUND_MESSAGE", "EXPORT", "EXTERNAL_WRITE"]),
  authorityType: z.enum([
    "REVIEW_CREATION_POLICY",
    "REVIEW_DECIDE_AUTHORITY",
    "REQUIREMENT_COMMIT_AUTHORITY",
    "WAIVER_AUTHORITY",
    "ACCEPT_EXCEPTION_AUTHORITY",
    "FREEZE_POLICY",
    "FREEZE_RELEASE_AUTHORITY",
    "READY_CONFIRM_AUTHORITY",
    "EXPORT_APPROVAL_AUTHORITY",
    "SEND_APPROVAL_AUTHORITY",
    "EXTERNAL_WRITE_AUTHORITY"
  ]),
  commandSchemaRef: z.string().min(1),
  resultSchemaRef: z.string().min(1),
  commitUnitRef: z.string().min(1),
  denyReasonCode: z.string().regex(/^[A-Z][A-Z0-9_]+$/),
  idempotencyNamespace: z.string().min(1),
  auditEventPrefix: z.string().min(1),
  owner: z.literal("root"),
  status: z.enum(["RESERVED_NOT_REGISTERED", "TARGET_SPECIFIC_CAPABILITY_REQUIRED"]),
  registrationAllowed: z.literal(false),
  implementationBindingRef: z.null()
}).strict();

export const engineeringBaselineManifestSchema = z.object({
  schemaVersion: z.literal("v1"),
  manifestVersion: z.literal("1.0.0"),
  generatedFor: z.literal("synthetic_default_closed_baseline"),
  gateModel: z.object({
    engineeringBaseline: z.literal("GENERIC_SYNTHETIC"),
    customerActivation: z.literal("DEFERRED_TO_PILOT_CANDIDATE"),
    customerConfigurationSatisfied: z.literal(false)
  }).strict(),
  components: z.array(componentSchema).length(baselineComponentIds.length),
  practiceContracts: z.array(disabledRegistryEntrySchema(practicePackIds)).length(practicePackIds.length),
  outputContracts: z.array(disabledRegistryEntrySchema(p0OutputSpecIds)).length(p0OutputSpecIds.length),
  securityControls: z.array(z.object({
    id: z.enum(securityControlIds),
    status: z.literal("DESIGN_READY_DISABLED"),
    runtimeBindingRef: z.null()
  }).strict()).length(securityControlIds.length),
  formalActions: z.array(formalActionSchema).length(formalActionIds.length),
  runtimeAssertions: z.object({
    automationCeiling: z.literal("A2_DRAFT"),
    plannedCapabilityCount: z.literal(18),
    enabledBusinessCapabilityCount: z.literal(0),
    reservedCapabilityCount: z.literal(17),
    registeredReservedCapabilityCount: z.literal(0),
    physicalToolBindingCount: z.literal(0),
    connectorBindingCount: z.literal(0),
    channelBindingCount: z.literal(0),
    realCustomerDataAllowed: z.literal(false),
    formalInternalCommitAllowed: z.literal(false),
    externalSideEffectsAllowed: z.literal(false),
    outboundMessagingAllowed: z.literal(false)
  }).strict()
}).strict();

export type EngineeringBaselineManifest = z.infer<typeof engineeringBaselineManifestSchema>;
