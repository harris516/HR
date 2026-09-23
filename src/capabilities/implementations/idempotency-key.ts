import type { CapabilityGatewayRequest } from "../../contracts/capability-gateway.js";
import type { CapabilityEntry } from "../../contracts/capability.js";
import { digestCapabilityPayload } from "../gateway.js";

/** Pure key derivation shared by the synthetic executor and E1 primitive tests. */
export function deriveSyntheticCapabilityIdempotencyKey(
  request: CapabilityGatewayRequest,
  capability: CapabilityEntry,
  parsedInput: Record<string, unknown>
): string {
  const context = request.requestContext as {
    tenantId: string;
    dataSpaceId: string;
    actorId: string;
    activeTeamId: string;
    teamMembershipRef: string;
    roles: string[];
    scopeGrantRefs: string[];
    authorityGrantRefs: string[];
  };
  const explicitDeduplicationKey = typeof parsedInput.deduplicationKey === "string"
    ? parsedInput.deduplicationKey
    : request.capabilityRequestId;
  return [
    context.tenantId,
    context.dataSpaceId,
    context.actorId,
    context.activeTeamId,
    context.teamMembershipRef,
    request.purpose,
    request.authorizationDecision.grantVersion,
    digestCapabilityPayload({
      roles: context.roles,
      scopeGrantRefs: context.scopeGrantRefs,
      authorityGrantRefs: context.authorityGrantRefs
    }),
    capability.capabilityId,
    capability.capabilityVersion,
    capability.idempotencyProfile,
    digestCapabilityPayload(request.resourceRefs),
    digestCapabilityPayload(request.collectionAdmission ?? null),
    explicitDeduplicationKey
  ].join("|");
}

export function classifySyntheticIdempotencyReplay(
  previousPayloadDigest: string | undefined,
  currentPayloadDigest: string
): "NEW" | "DUPLICATE" | "CONFLICT" {
  if (previousPayloadDigest === undefined) return "NEW";
  return previousPayloadDigest === currentPayloadDigest ? "DUPLICATE" : "CONFLICT";
}
