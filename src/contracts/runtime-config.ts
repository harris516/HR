import { z } from "zod";

const agentSchema = z.object({
  id: z.literal("aibang-hr-onboarding-agent"),
  displayName: z.literal("hr-onboarding"),
  domain: z.literal("hr_employment_onboarding"),
  primaryUser: z.literal("onboarding_hr_operations"),
  canonicalObject: z.literal("OnboardingCase"),
  heroTask: z.literal("offer_accepted_to_day1_ready"),
  automationCeiling: z.literal("A2_DRAFT")
}).strict();

const runtimeSchema = z.object({
  mode: z.enum(["design", "test"]),
  openclawVersion: z.literal("2026.9.4"),
  nodeVersion: z.literal("24.21.0")
}).strict();

const contractsSchema = z.object({
  identity: z.literal("v0.3"),
  requestContext: z.literal("v1"),
  subjectResolution: z.literal("v0.3"),
  authorization: z.literal("v0.3"),
  sessionMemory: z.literal("v0.3"),
  taskNavigation: z.literal("v0.3"),
  skillPack: z.literal("v0.3"),
  capabilityRegistry: z.literal("v1"),
  capabilitySchemas: z.literal("v1"),
  capabilityReasonCodes: z.literal("v1")
}).strict();

const defaultsSchema = z.object({
  authorization: z.literal("deny"),
  unknownData: z.literal("visible"),
  authorityUncertain: z.literal("deny"),
  subjectResolution: z.literal("deterministic_only")
}).strict();

const capabilitySchema = z.enum([
  "health",
  "validate_context",
  "resolve_subject_stub",
  "read_stub",
  "analyze_stub",
  "draft_stub"
]);

const bindingsSchema = z.object({
  channels: z.array(z.never()).max(0),
  connectors: z.array(z.never()).max(0),
  tools: z.array(z.never()).max(0),
  capabilityImplementations: z.array(z.never()).max(0)
}).strict();

const featureFlagsSchema = z.object({
  realCustomerData: z.literal(false),
  formalInternalCommit: z.literal(false),
  externalSideEffects: z.literal(false),
  outboundMessaging: z.literal(false),
  sensitiveExport: z.literal(false),
  growthWrite: z.literal(false),
  productionMemory: z.literal(false),
  mockCapabilities: z.literal(true),
  businessCapabilityExecution: z.literal(false)
}).strict();

export const runtimeConfigSchema = z.object({
  schemaVersion: z.literal("v1"),
  agent: agentSchema,
  runtime: runtimeSchema,
  contracts: contractsSchema,
  defaults: defaultsSchema,
  capabilities: z.array(capabilitySchema).min(1).refine(
    (values) => new Set(values).size === values.length,
    { message: "capabilities must not contain duplicates" }
  ),
  enabledBusinessCapabilities: z.array(z.never()).max(0),
  bindings: bindingsSchema,
  featureFlags: featureFlagsSchema
}).strict();

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
