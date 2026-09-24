import { createHash } from "node:crypto";
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
  constructor(private readonly store: SyntheticBusinessStorePort) {}

  execute(request: SyntheticMutationRequest): SyntheticMutationResult {
    const inputDigest = digest(request.payload);
    const context = request.requestContext;
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
      return { decision: "DENY", reasonCode: "SYNTHETIC_MUTATION_NOT_AUTHORIZED",
        inputDigest, implementationCallCount: 0 };
    }
    const receipt = request.capabilityId === "hr.onboarding.synthetic.case.create"
      ? this.store.createAcceptedOfferCase(context, request.payload as CreateAcceptedOfferInput)
      : this.store.completeRequirement(context, request.payload as CompleteRequirementInput);
    return { decision: "ALLOW", reasonCode: "SYNTHETIC_MUTATION_COMMITTED", receipt,
      inputDigest, implementationCallCount: 1 };
  }
}
