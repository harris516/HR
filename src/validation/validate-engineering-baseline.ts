import {
  baselineComponentIds,
  engineeringBaselineManifestSchema,
  formalActionCapabilityIds,
  formalActionIds,
  p0OutputSpecIds,
  practicePackIds,
  securityControlIds,
  type EngineeringBaselineManifest
} from "../contracts/engineering-baseline.js";
import { reservedCapabilityIds } from "../contracts/capability.js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export class EngineeringBaselineValidationError extends Error {}

const expectedComponents = {
  "10_identity_runtime": ["v0.3", "RUNTIME_VERIFIED"],
  "11_task_navigation": ["v0.3", "RUNTIME_VERIFIED"],
  "12_skill_capability": ["v0.4", "RUNTIME_VERIFIED"],
  "13_industry_practice": ["v0.2", "DESIGN_READY_DISABLED"],
  "14_mcp_connector": ["v0.2", "DESIGN_READY_DISABLED"],
  "15_output_artifact": ["v0.2", "DESIGN_READY_DISABLED"],
  "16_security_human_review": ["v0.1", "DESIGN_READY_DISABLED"]
} as const;

const expectedFormalActionPolicies = {
  "hr.onboarding.review.create": ["INTERNAL_COMMIT", "REVIEW_CREATION_POLICY"],
  "hr.onboarding.review.decision.commit": ["INTERNAL_COMMIT", "REVIEW_DECIDE_AUTHORITY"],
  "hr.onboarding.requirement.complete": ["INTERNAL_COMMIT", "REQUIREMENT_COMMIT_AUTHORITY"],
  "hr.onboarding.requirement.waiver.commit": ["INTERNAL_COMMIT", "WAIVER_AUTHORITY"],
  "hr.onboarding.exception.accept": ["INTERNAL_COMMIT", "ACCEPT_EXCEPTION_AUTHORITY"],
  "hr.onboarding.frozen_action.create": ["INTERNAL_COMMIT", "FREEZE_POLICY"],
  "hr.onboarding.frozen_action.release": ["INTERNAL_COMMIT", "FREEZE_RELEASE_AUTHORITY"],
  "hr.onboarding.ready.confirm": ["INTERNAL_COMMIT", "READY_CONFIRM_AUTHORITY"],
  "hr.onboarding.artifact.export": ["EXPORT", "EXPORT_APPROVAL_AUTHORITY"],
  "hr.onboarding.notification.send": ["OUTBOUND_MESSAGE", "SEND_APPROVAL_AUTHORITY"],
  "external.write.target_specific": ["EXTERNAL_WRITE", "EXTERNAL_WRITE_AUTHORITY"]
} as const;

function assertExactSet(label: string, actual: readonly string[], expected: readonly string[]): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  if (actual.length !== actualSet.size || actualSet.size !== expectedSet.size ||
      [...expectedSet].some((item) => !actualSet.has(item))) {
    throw new EngineeringBaselineValidationError(`${label} does not match the reviewed baseline`);
  }
}

export function validateEngineeringBaseline(input: unknown): EngineeringBaselineManifest {
  const manifest = engineeringBaselineManifestSchema.parse(input);

  assertExactSet("components", manifest.components.map((item) => item.componentId), baselineComponentIds);
  assertExactSet("practice contracts", manifest.practiceContracts.map((item) => item.id), practicePackIds);
  assertExactSet("output contracts", manifest.outputContracts.map((item) => item.id), p0OutputSpecIds);
  assertExactSet("security controls", manifest.securityControls.map((item) => item.id), securityControlIds);
  assertExactSet("formal actions", manifest.formalActions.map((item) => item.formalActionId), formalActionIds);

  for (const component of manifest.components) {
    const [version, maturity] = expectedComponents[component.componentId];
    if (component.documentVersion !== version || component.maturity !== maturity) {
      throw new EngineeringBaselineValidationError(
        `${component.componentId} version or maturity does not match the reviewed baseline`
      );
    }
  }

  const reservedSet = new Set<string>(reservedCapabilityIds);
  for (const action of manifest.formalActions) {
    const [sideEffectClass, authorityType] = expectedFormalActionPolicies[action.formalActionId];
    if (action.sideEffectClass !== sideEffectClass || action.authorityType !== authorityType) {
      throw new EngineeringBaselineValidationError(
        `${action.formalActionId} side-effect or authority policy drifted`
      );
    }
    if (action.formalActionId === "external.write.target_specific") {
      if (action.capabilityId !== null || action.status !== "TARGET_SPECIFIC_CAPABILITY_REQUIRED") {
        throw new EngineeringBaselineValidationError(
          "external write must wait for a target-specific capability identity"
        );
      }
      continue;
    }
    if (action.capabilityId === null || action.formalActionId !== action.capabilityId ||
        !reservedSet.has(action.capabilityId) || action.status !== "RESERVED_NOT_REGISTERED") {
      throw new EngineeringBaselineValidationError(
        `${action.formalActionId} is not mapped to its reserved capability identity`
      );
    }
  }

  return manifest;
}

export async function verifyEngineeringBaselineDocumentDigests(
  manifest: EngineeringBaselineManifest,
  documentsRoot: string
): Promise<void> {
  for (const component of manifest.components) {
    const paths = [...component.sourcePaths].sort();
    if (component.digestMode === "SINGLE_FILE" && paths.length !== 1) {
      throw new EngineeringBaselineValidationError(`${component.componentId} must reference exactly one source file`);
    }

    const chunks: string[] = [];
    for (const sourcePath of paths) {
      const content = await readFile(resolve(documentsRoot, sourcePath), "utf8");
      chunks.push(component.digestMode === "ORDERED_FILE_SET"
        ? `FILE:${sourcePath.split(/[\\/]/).at(-1)}\n${content}`
        : content);
    }
    const digest = createHash("sha256").update(chunks.join("\n"), "utf8").digest("hex");
    if (digest !== component.documentDigestSha256) {
      throw new EngineeringBaselineValidationError(
        `${component.componentId} document digest does not match the reviewed baseline`
      );
    }
  }
}
