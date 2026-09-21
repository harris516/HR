import {
  requestContextSchema,
  type RequestContext
} from "../contracts/navigation.js";

export type ContextGateResult =
  | { ok: true; context: RequestContext }
  | { ok: false; hardBlock: boolean; reasonCode: string };

export function validateRequestContext(
  input: unknown,
  now: Date
): ContextGateResult {
  const parsed = requestContextSchema.safeParse(input);
  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
    if (fields.has("tenantId")) {
      return { ok: false, hardBlock: true, reasonCode: "TENANT_MISSING_OR_MISMATCH" };
    }
    if (fields.has("dataSpaceId")) {
      return { ok: false, hardBlock: true, reasonCode: "DATA_SPACE_MISSING_OR_MISMATCH" };
    }
    return { ok: false, hardBlock: false, reasonCode: "REQUEST_CONTEXT_INVALID" };
  }

  const context = parsed.data;
  if (new Date(context.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, hardBlock: false, reasonCode: "REQUEST_CONTEXT_EXPIRED" };
  }
  if (context.actorType === "user" && context.sessionId === undefined) {
    return { ok: false, hardBlock: false, reasonCode: "SESSION_BINDING_INVALID" };
  }
  if (context.roles.includes("suspended")) {
    return { ok: false, hardBlock: false, reasonCode: "ACTOR_SUSPENDED" };
  }
  if (!context.integrityRef.startsWith("test-")) {
    return { ok: false, hardBlock: false, reasonCode: "REQUEST_CONTEXT_INVALID" };
  }
  return { ok: true, context };
}
