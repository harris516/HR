import type {
  CapabilityImplementationBinding,
  CapabilityRuntimeState
} from "../../contracts/capability-gateway.js";
import type { CapabilityEntry, CapabilityId } from "../../contracts/capability.js";
import type { CapabilityRuntimeStateResolver } from "../gateway.js";
import { syntheticReadAnalyzeAdapters } from "./read-analyze-adapters.js";
import type { SyntheticCapabilityAdapter } from "./types.js";

export interface SyntheticImplementationRegistration {
  capabilityId: CapabilityId;
  binding: CapabilityImplementationBinding;
  adapter: SyntheticCapabilityAdapter;
}

export interface SyntheticImplementationRegistryOptions {
  adapterOverrides?: ReadonlyMap<CapabilityId, SyntheticCapabilityAdapter>;
  allowSyntheticTestAdapterOverrides?: boolean;
}

function bindingFor(entry: CapabilityEntry): CapabilityImplementationBinding {
  return {
    bindingRef: `implementation://synthetic/${entry.capabilityId}/1.0.0`,
    implementedCapabilityId: entry.capabilityId,
    supportedCapabilityVersions: [entry.capabilityVersion],
    implementationName: `synthetic-${entry.capabilityId}`,
    implementationVersion: "1.0.0",
    mode: "TEST_STUB",
    allowedEnvironments: ["test"],
    scopePolicy: "REQUEST_TENANT_AND_DATA_SPACE",
    inputSchemaRef: entry.inputSchemaRef,
    outputSchemaRef: entry.outputSchemaRef,
    timeoutMs: 1000,
    maxAttempts: 1,
    retryAllowed: false,
    circuitPolicyRef: "circuit://synthetic/no-retry/v1",
    sideEffectClass: entry.sideEffectClass,
    auditSupport: true,
    healthStatus: "HEALTHY",
    featureFlagRef: entry.featureFlag.key,
    approvedBy: "root",
    approvalRef: "approval://synthetic/s3-local-test-only"
  };
}

export class SyntheticReadAnalyzeImplementationRegistry {
  readonly #registrations = new Map<CapabilityId, SyntheticImplementationRegistration>();

  constructor(
    entries: readonly CapabilityEntry[],
    options: SyntheticImplementationRegistryOptions = {}
  ) {
    if (options.adapterOverrides !== undefined && !options.allowSyntheticTestAdapterOverrides) {
      throw new Error("synthetic adapter overrides require explicit test-only opt-in");
    }
    for (const entry of entries) {
      const adapter = options.adapterOverrides?.get(entry.capabilityId) ??
        syntheticReadAnalyzeAdapters.get(entry.capabilityId);
      if (adapter === undefined) {
        continue;
      }
      this.#registrations.set(entry.capabilityId, {
        capabilityId: entry.capabilityId,
        binding: bindingFor(entry),
        adapter
      });
    }
    if (this.#registrations.size !== syntheticReadAnalyzeAdapters.size) {
      throw new Error("synthetic read/analyze implementation registry is incomplete");
    }
  }

  get(capabilityId: CapabilityId): SyntheticImplementationRegistration | undefined {
    return this.#registrations.get(capabilityId);
  }

  registrations(): SyntheticImplementationRegistration[] {
    return [...this.#registrations.values()];
  }

  runtimeStateResolver(): CapabilityRuntimeStateResolver {
    return {
      resolve: (entry: CapabilityEntry): CapabilityRuntimeState => {
        const registration = this.#registrations.get(entry.capabilityId);
        if (registration === undefined) {
          return {
            capabilityId: entry.capabilityId,
            capabilityVersion: entry.capabilityVersion,
            status: entry.status,
            featureEnabled: entry.featureFlag.enabled,
            allowedEnvironments: ["design", "test"],
            implementationBinding: null
          };
        }
        return {
          capabilityId: entry.capabilityId,
          capabilityVersion: entry.capabilityVersion,
          status: "TEST_STUB_ENABLED",
          featureEnabled: true,
          allowedEnvironments: ["test"],
          implementationBinding: registration.binding
        };
      }
    };
  }
}
