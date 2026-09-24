import { createHash } from "node:crypto";
import type { CapabilityGatewayAuditSink } from "../audit/capability-audit.js";
import type { RequestContext } from "../contracts/navigation.js";
import type {
  CompleteRequirementInput,
  CreateAcceptedOfferInput,
  SyntheticBusinessStorePort,
  SyntheticMutationReceipt
} from "./synthetic-business-store.js";

export const syntheticMutationCapabilityIds = [
  "hr.onboarding.synthetic.case.create",
  "hr.onboarding.synthetic.requirement.update"
] as const;

export type SyntheticMutationCapabilityId = typeof syntheticMutationCapabilityIds[number];

export interface SyntheticMutationRequest {
  profileId: "STEP2.5-SYNTHETIC-MUTATION-V1";
  skillId: "onboarding_case_intake_pack" | "onboarding_requirement_tracking_pack";
  workflowId: "synthetic_case_create_from_accepted_offer" | "synthetic_requirement_completion_update";
  capabilityId: SyntheticMutationCapabilityId;
  mutationId: string;
  requestContext: RequestContext;
  payload: CreateAcceptedOfferInput | CompleteRequirementInput;
}

export interface SyntheticMutationResult {
  decision: "ALLOW" | "DENY";
  reasonCode: string;
  receipt?: SyntheticMutationReceipt;
  inputDigest: string;
  implementationCallCount: number;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Separate test-only gate. It never activates a reserved formal-write capability. */
export class SyntheticMutationGateway {
  constructor(
    private readonly store: SyntheticBusinessStorePort,
    private readonly auditSink: CapabilityGatewayAuditSink,
    private readonly now: () => Date,
    private readonly idFactory: () => string
  ) {}

  execute(request: SyntheticMutationRequest): SyntheticMutationResult {
    if (!this.auditSink.isAvailable()) throw new Error("GATEWAY_AUDIT_UNAVAILABLE");
    const inputDigest = digest(request.payload);
    const context = request.requestContext;
    const appendAudit = (
      eventType: "capability_gateway_ingress" | "capability_gateway_rejected" |
        "capability_gateway_admission_allowed",
      decision?: "ALLOW_TO_IMPLEMENTATION" | "DENY",
      reasonCodes: string[] = []
    ) => {
      const appended = this.auditSink.append({
        auditRef: `step25-gateway-${this.idFactory()}`,
        eventType,
        capabilityRequestId: request.mutationId,
        taskId: context.requestId,
        capabilityId: request.capabilityId,
        capabilityVersion: "1.0.0",
        tenantId: context.tenantId,
        dataSpaceId: context.dataSpaceId,
        actorId: context.actorId,
        activeTeamId: context.activeTeamId,
        teamMembershipRef: context.teamMembershipRef,
        ...(decision === undefined ? {} : { decision }),
        reasonCodes,
        occurredAt: this.now().toISOString()
      });
      if (!appended) throw new Error("GATEWAY_AUDIT_UNAVAILABLE");
    };
    appendAudit("capability_gateway_ingress");
    const bindingIsExact =
      (request.workflowId === "synthetic_case_create_from_accepted_offer" &&
        request.skillId === "onboarding_case_intake_pack" &&
        request.capabilityId === "hr.onboarding.synthetic.case.create") ||
      (request.workflowId === "synthetic_requirement_completion_update" &&
        request.skillId === "onboarding_requirement_tracking_pack" &&
        request.capabilityId === "hr.onboarding.synthetic.requirement.update");
    const authorized = request.profileId === "STEP2.5-SYNTHETIC-MUTATION-V1" &&
      context.contextVersion === "2" && context.environment === "test" && context.synthetic &&
      context.dataAccessPurpose === "onboarding_operation" &&
      context.roles.includes("onboarding_hr_operations") &&
      context.scopeGrantRefs.includes("scope-mvp-synthetic-team-write") && bindingIsExact &&
      request.mutationId.length > 0 && request.payload.mutationId === request.mutationId;
    if (!authorized) {
      appendAudit("capability_gateway_rejected", "DENY", ["SYNTHETIC_MUTATION_NOT_AUTHORIZED"]);
      return { decision: "DENY", reasonCode: "SYNTHETIC_MUTATION_NOT_AUTHORIZED",
        inputDigest, implementationCallCount: 0 };
    }
    appendAudit("capability_gateway_admission_allowed", "ALLOW_TO_IMPLEMENTATION",
      ["SYNTHETIC_MUTATION_AUTHORIZED"]);
    const receipt = request.capabilityId === "hr.onboarding.synthetic.case.create"
      ? this.store.createAcceptedOfferCase(context, request.payload as CreateAcceptedOfferInput)
      : this.store.completeRequirement(context, request.payload as CompleteRequirementInput);
    return { decision: "ALLOW", reasonCode: "SYNTHETIC_MUTATION_COMMITTED", receipt,
      inputDigest, implementationCallCount: 1 };
  }
}
