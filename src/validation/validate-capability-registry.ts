import { ZodError } from "zod";
import {
  capabilityRegistrySchema,
  plannedCapabilityIds,
  reservedCapabilityIds,
  type CapabilityRegistry
} from "../contracts/capability.js";
import { capabilityProfiles } from "../capabilities/profiles.js";
import {
  capabilityReasonCodeRegistry,
  capabilityReasonCodes
} from "../capabilities/reason-codes.js";
import { assertSchemaRegistryComplete, capabilityPayloadSchemas } from "../capabilities/schema-registry.js";

export class CapabilityRegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapabilityRegistryValidationError";
  }
}

function assertExactSet(label: string, actual: string[], expected: readonly string[]): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  if (actualSet.size !== actual.length) {
    throw new CapabilityRegistryValidationError(`${label} contains duplicates`);
  }
  if (
    actualSet.size !== expectedSet.size ||
    [...expectedSet].some((value) => !actualSet.has(value))
  ) {
    throw new CapabilityRegistryValidationError(`${label} does not match the reviewed baseline`);
  }
}

export function validateCapabilityRegistry(input: unknown): CapabilityRegistry {
  let registry: CapabilityRegistry;
  try {
    registry = capabilityRegistrySchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new CapabilityRegistryValidationError(error.issues.map((issue) => issue.message).join("; "));
    }
    throw error;
  }

  assertSchemaRegistryComplete();
  assertExactSet(
    "planned capabilities",
    registry.capabilities.map((entry) => entry.capabilityId),
    plannedCapabilityIds
  );
  assertExactSet(
    "reserved capabilities",
    registry.reservedCapabilities.map((entry) => entry.capabilityId),
    reservedCapabilityIds
  );
  assertExactSet(
    "capability reason codes",
    capabilityReasonCodeRegistry.entries.map((entry) => entry.code),
    capabilityReasonCodes
  );

  const reservedSet = new Set(registry.reservedCapabilities.map((entry) => entry.capabilityId));
  const authorizationProfiles = new Set(
    capabilityProfiles.authorization.map((profile) => profile.profileId)
  );
  const dataProfiles = new Set(capabilityProfiles.data.map((profile) => profile.profileId));
  const executionProfiles = new Set(
    capabilityProfiles.execution.map((profile) => profile.profileId)
  );
  const featureFlags = new Set<string>();

  const actionContract = {
    read: { automationLevel: "A0_READ", sideEffectClass: "NONE_READ" },
    analyze: { automationLevel: "A1_ANALYZE", sideEffectClass: "NONE_ANALYZE" },
    draft: { automationLevel: "A2_DRAFT", sideEffectClass: "DRAFT_ONLY" }
  } as const;

  for (const entry of registry.capabilities) {
    if (reservedSet.has(entry.capabilityId as never)) {
      throw new CapabilityRegistryValidationError(`${entry.capabilityId} is both planned and reserved`);
    }
    if (entry.status !== "PLANNED_TEST_STUB") {
      throw new CapabilityRegistryValidationError(`${entry.capabilityId} is unexpectedly executable`);
    }
    if (
      entry.featureFlag.enabled ||
      entry.implementationBindingRef !== null ||
      entry.physicalToolBindingRefs.length !== 0 ||
      entry.connectorBindingRefs.length !== 0
    ) {
      throw new CapabilityRegistryValidationError(`${entry.capabilityId} violates the S1 no-execution boundary`);
    }
    const expectedFlag = `capability.${entry.capabilityId}.test.enabled`;
    if (entry.featureFlag.key !== expectedFlag || featureFlags.has(expectedFlag)) {
      throw new CapabilityRegistryValidationError(`${entry.capabilityId} has an invalid or duplicate feature flag`);
    }
    featureFlags.add(expectedFlag);

    const expectedAction = actionContract[entry.actionClass];
    if (
      entry.automationLevel !== expectedAction.automationLevel ||
      entry.sideEffectClass !== expectedAction.sideEffectClass
    ) {
      throw new CapabilityRegistryValidationError(`${entry.capabilityId} has an invalid action contract`);
    }
    if (!authorizationProfiles.has(entry.authorizationProfileRefs[0]!)) {
      throw new CapabilityRegistryValidationError(`${entry.capabilityId} has an unknown authorization profile`);
    }
    if (entry.authorizationProfileRefs.some((profile) => !authorizationProfiles.has(profile))) {
      throw new CapabilityRegistryValidationError(`${entry.capabilityId} has an unknown authorization profile`);
    }
    if (entry.dataProfileRefs.some((profile) => !dataProfiles.has(profile))) {
      throw new CapabilityRegistryValidationError(`${entry.capabilityId} has an unknown data profile`);
    }
    if (!executionProfiles.has(entry.executionProfileRef)) {
      throw new CapabilityRegistryValidationError(`${entry.capabilityId} has an unknown execution profile`);
    }
    if (
      capabilityPayloadSchemas[entry.inputSchemaRef] === undefined ||
      capabilityPayloadSchemas[entry.outputSchemaRef] === undefined
    ) {
      throw new CapabilityRegistryValidationError(`${entry.capabilityId} references an unknown payload schema`);
    }
  }

  return registry;
}
