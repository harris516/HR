import { z } from "zod";
import {
  authorizationProfileIdSchema,
  dataProfileIdSchema,
  executionProfileIdSchema
} from "../contracts/capability.js";

const actorTypeSchema = z.enum(["user", "service_principal"]);
const purposeSchema = z.enum(["onboarding_operation", "review", "audit"]);

export const capabilityBaseProfileSchema = z.object({
  profileId: z.literal("CAP-BASE-SYNTHETIC-V1"),
  allowedEnvironments: z.tuple([z.literal("design"), z.literal("test")]),
  syntheticMarkerRequired: z.literal(true),
  realCustomerDataAllowed: z.literal(false),
  requiredTenantContext: z.literal(true),
  resourceBoundary: z.literal("SAME_TENANT_AND_DATA_SPACE"),
  prohibitionClasses: z.tuple([
    z.literal("AGENT_PROHIBITED"),
    z.literal("SYSTEM_HARD_BLOCK")
  ]),
  genericToolFallbackAllowed: z.literal(false),
  connectorBindingPolicy: z.literal("NONE_INTERNAL"),
  implementationBindingRef: z.null(),
  physicalToolBindingRefs: z.array(z.never()).max(0),
  featureFlagDefault: z.literal(false),
  resultReceiptRequired: z.literal(false),
  formalStateChangeAllowed: z.literal(false),
  externalSideEffectAllowed: z.literal(false),
  owner: z.literal("root")
}).strict();

export const authorizationProfileSchema = z.object({
  profileId: authorizationProfileIdSchema,
  allowedActorTypes: z.array(actorTypeSchema).min(1),
  requiredGrantActions: z.array(z.string().min(1)).min(1),
  purposeAllowlist: z.array(purposeSchema).min(1),
  resourceBoundary: z.string().min(1),
  fieldBoundary: z.string().min(1),
  authorityRequirement: z.literal("NONE")
}).strict();

export const dataProfileSchema = z.object({
  profileId: dataProfileIdSchema,
  requiredControls: z.array(z.string().min(1)).min(1),
  sensitivityClasses: z.tuple([
    z.literal("SYNTHETIC_PUBLIC"),
    z.literal("SYNTHETIC_INTERNAL"),
    z.literal("SYNTHETIC_SENSITIVE")
  ]),
  productionDefaultsAllowed: z.literal(false)
}).strict();

export const executionProfileSchema = z.object({
  profileId: executionProfileIdSchema,
  maxAttempts: z.literal(1),
  deadlinePolicy: z.literal("INHERIT_REQUEST_DEADLINE"),
  implicitRetryAllowed: z.literal(false),
  genericToolFallbackAllowed: z.literal(false),
  failureVisibility: z.literal("VISIBLE"),
  auditEventTypes: z.array(z.string().min(1)).length(3)
}).strict();

export const capabilityProfilesSchema = z.object({
  base: capabilityBaseProfileSchema,
  authorization: z.array(authorizationProfileSchema).length(10),
  data: z.array(dataProfileSchema).length(8),
  execution: z.array(executionProfileSchema).length(3)
}).strict();

export const capabilityProfiles = capabilityProfilesSchema.parse({
  base: {
    profileId: "CAP-BASE-SYNTHETIC-V1",
    allowedEnvironments: ["design", "test"],
    syntheticMarkerRequired: true,
    realCustomerDataAllowed: false,
    requiredTenantContext: true,
    resourceBoundary: "SAME_TENANT_AND_DATA_SPACE",
    prohibitionClasses: ["AGENT_PROHIBITED", "SYSTEM_HARD_BLOCK"],
    genericToolFallbackAllowed: false,
    connectorBindingPolicy: "NONE_INTERNAL",
    implementationBindingRef: null,
    physicalToolBindingRefs: [],
    featureFlagDefault: false,
    resultReceiptRequired: false,
    formalStateChangeAllowed: false,
    externalSideEffectAllowed: false,
    owner: "root"
  },
  authorization: [
    {
      profileId: "AUTH-INTAKE-READ-V1",
      allowedActorTypes: ["user", "service_principal"],
      requiredGrantActions: ["intake.read"],
      purposeAllowlist: ["onboarding_operation"],
      resourceBoundary: "OFFER_HANDOFF",
      fieldBoundary: "APPROVED_FIELD_PROJECTION",
      authorityRequirement: "NONE"
    },
    {
      profileId: "AUTH-CASE-COLLECTION-READ-V1",
      allowedActorTypes: ["user", "service_principal"],
      requiredGrantActions: ["case.collection.read"],
      purposeAllowlist: ["onboarding_operation"],
      resourceBoundary: "AUTHORIZED_CASE_COLLECTION_PER_ITEM",
      fieldBoundary: "AUTHORIZED_FIELD_PROJECTION",
      authorityRequirement: "NONE"
    },
    {
      profileId: "AUTH-CASE-READ-V1",
      allowedActorTypes: ["user", "service_principal"],
      requiredGrantActions: ["case.read"],
      purposeAllowlist: ["onboarding_operation", "review"],
      resourceBoundary: "EXPLICIT_CASE",
      fieldBoundary: "AUTHORIZED_FIELD_PROJECTION",
      authorityRequirement: "NONE"
    },
    {
      profileId: "AUTH-REQUIREMENT-READ-V1",
      allowedActorTypes: ["user", "service_principal"],
      requiredGrantActions: ["requirement.read"],
      purposeAllowlist: ["onboarding_operation", "review"],
      resourceBoundary: "CASE_REQUIREMENT",
      fieldBoundary: "AUTHORIZED_FIELD_PROJECTION",
      authorityRequirement: "NONE"
    },
    {
      profileId: "AUTH-EVIDENCE-READ-V1",
      allowedActorTypes: ["user", "service_principal"],
      requiredGrantActions: ["evidence.read"],
      purposeAllowlist: ["onboarding_operation", "review", "audit"],
      resourceBoundary: "REFERENCED_OBJECT",
      fieldBoundary: "SENSITIVITY_FILTERED_PROJECTION",
      authorityRequirement: "NONE"
    },
    {
      profileId: "AUTH-WORKBOX-READ-V1",
      allowedActorTypes: ["user", "service_principal"],
      requiredGrantActions: ["workbox.read"],
      purposeAllowlist: ["onboarding_operation"],
      resourceBoundary: "ACTOR_VISIBLE_RESPONSIBILITY_SCOPE",
      fieldBoundary: "AUTHORIZED_FIELD_PROJECTION",
      authorityRequirement: "NONE"
    },
    {
      profileId: "AUTH-ANALYZE-V1",
      allowedActorTypes: ["user", "service_principal"],
      requiredGrantActions: ["resource.read", "analysis.execute"],
      purposeAllowlist: ["onboarding_operation", "review"],
      resourceBoundary: "AUTHORIZED_SNAPSHOT",
      fieldBoundary: "AUTHORIZED_INPUT_PROJECTION",
      authorityRequirement: "NONE"
    },
    {
      profileId: "AUTH-DRAFT-V1",
      allowedActorTypes: ["user", "service_principal"],
      requiredGrantActions: ["resource.read", "draft.create"],
      purposeAllowlist: ["onboarding_operation", "review"],
      resourceBoundary: "REFERENCED_CASE_OR_OBJECT",
      fieldBoundary: "APPROVED_FACTS_MINIMUM_DISCLOSURE",
      authorityRequirement: "NONE"
    },
    {
      profileId: "AUTH-ARTIFACT-READ-V1",
      allowedActorTypes: ["user", "service_principal"],
      requiredGrantActions: ["artifact.read"],
      purposeAllowlist: ["onboarding_operation", "review", "audit"],
      resourceBoundary: "ARTIFACT_AND_VERSION_SCOPE",
      fieldBoundary: "AUTHORIZED_FIELD_PROJECTION",
      authorityRequirement: "NONE"
    },
    {
      profileId: "AUTH-AUDIT-READ-V1",
      allowedActorTypes: ["user", "service_principal"],
      requiredGrantActions: ["audit.timeline.read"],
      purposeAllowlist: ["audit", "onboarding_operation"],
      resourceBoundary: "AUDIT_RESOURCE_SCOPE",
      fieldBoundary: "REDACTION_POLICY_PROJECTION",
      authorityRequirement: "NONE"
    }
  ],
  data: [
    {
      profileId: "DATA-INTAKE-V1",
      requiredControls: ["source_version", "identity_mapping", "freshness", "schema", "source_policy"],
      sensitivityClasses: ["SYNTHETIC_PUBLIC", "SYNTHETIC_INTERNAL", "SYNTHETIC_SENSITIVE"],
      productionDefaultsAllowed: false
    },
    {
      profileId: "DATA-CASE-V1",
      requiredControls: ["case_version", "separate_state_dimensions", "source", "freshness"],
      sensitivityClasses: ["SYNTHETIC_PUBLIC", "SYNTHETIC_INTERNAL", "SYNTHETIC_SENSITIVE"],
      productionDefaultsAllowed: false
    },
    {
      profileId: "DATA-REQUIREMENT-V1",
      requiredControls: ["criteria", "applicability", "evidence_set_version", "formal_candidate_separation"],
      sensitivityClasses: ["SYNTHETIC_PUBLIC", "SYNTHETIC_INTERNAL", "SYNTHETIC_SENSITIVE"],
      productionDefaultsAllowed: false
    },
    {
      profileId: "DATA-RISK-V1",
      requiredControls: ["risk_policy_version", "snapshot", "affected_objects", "severity", "blocking"],
      sensitivityClasses: ["SYNTHETIC_PUBLIC", "SYNTHETIC_INTERNAL", "SYNTHETIC_SENSITIVE"],
      productionDefaultsAllowed: false
    },
    {
      profileId: "DATA-EVIDENCE-V1",
      requiredControls: ["authority", "provenance", "freshness", "quality", "policy_version"],
      sensitivityClasses: ["SYNTHETIC_PUBLIC", "SYNTHETIC_INTERNAL", "SYNTHETIC_SENSITIVE"],
      productionDefaultsAllowed: false
    },
    {
      profileId: "DATA-READY-V1",
      requiredControls: ["authoritative_snapshot", "complete_requirements", "active_rules", "evidence_versions"],
      sensitivityClasses: ["SYNTHETIC_PUBLIC", "SYNTHETIC_INTERNAL", "SYNTHETIC_SENSITIVE"],
      productionDefaultsAllowed: false
    },
    {
      profileId: "DATA-DRAFT-V1",
      requiredControls: ["approved_fact_refs", "redaction", "minimum_disclosure", "draft_not_sent"],
      sensitivityClasses: ["SYNTHETIC_PUBLIC", "SYNTHETIC_INTERNAL", "SYNTHETIC_SENSITIVE"],
      productionDefaultsAllowed: false
    },
    {
      profileId: "DATA-AUDIT-V1",
      requiredControls: ["append_only_ref", "scope_redaction", "no_secret", "no_sensitive_body"],
      sensitivityClasses: ["SYNTHETIC_PUBLIC", "SYNTHETIC_INTERNAL", "SYNTHETIC_SENSITIVE"],
      productionDefaultsAllowed: false
    }
  ],
  execution: [
    {
      profileId: "EXEC-READ-V1",
      maxAttempts: 1,
      deadlinePolicy: "INHERIT_REQUEST_DEADLINE",
      implicitRetryAllowed: false,
      genericToolFallbackAllowed: false,
      failureVisibility: "VISIBLE",
      auditEventTypes: ["capability.read.started", "capability.read.completed", "capability.read.failed"]
    },
    {
      profileId: "EXEC-ANALYZE-V1",
      maxAttempts: 1,
      deadlinePolicy: "INHERIT_REQUEST_DEADLINE",
      implicitRetryAllowed: false,
      genericToolFallbackAllowed: false,
      failureVisibility: "VISIBLE",
      auditEventTypes: ["capability.analysis.started", "capability.analysis.completed", "capability.analysis.failed"]
    },
    {
      profileId: "EXEC-DRAFT-V1",
      maxAttempts: 1,
      deadlinePolicy: "INHERIT_REQUEST_DEADLINE",
      implicitRetryAllowed: false,
      genericToolFallbackAllowed: false,
      failureVisibility: "VISIBLE",
      auditEventTypes: ["capability.draft.started", "capability.draft.completed", "capability.draft.failed"]
    }
  ]
});

export type CapabilityProfiles = z.infer<typeof capabilityProfilesSchema>;
