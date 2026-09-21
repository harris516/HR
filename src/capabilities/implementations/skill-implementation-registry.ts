import type { CapabilityRuntimeState } from "../../contracts/capability-gateway.js";
import type { CapabilityEntry, CapabilityId } from "../../contracts/capability.js";
import type { CapabilityRuntimeStateResolver } from "../gateway.js";
import { syntheticDraftAdapters } from "./draft-adapters.js";
import {
  syntheticBindingFor,
  type SyntheticImplementationRegistration,
  type SyntheticImplementationRegistryPort
} from "./implementation-registry.js";
import { syntheticReadAnalyzeAdapters } from "./read-analyze-adapters.js";

export class SyntheticSkillImplementationRegistry implements SyntheticImplementationRegistryPort {
  readonly #registrations = new Map<CapabilityId, SyntheticImplementationRegistration>();

  constructor(entries: readonly CapabilityEntry[]) {
    for (const entry of entries) {
      const adapter = syntheticReadAnalyzeAdapters.get(entry.capabilityId) ??
        syntheticDraftAdapters.get(entry.capabilityId);
      if (adapter === undefined) continue;
      this.#registrations.set(entry.capabilityId, {
        capabilityId: entry.capabilityId,
        binding: syntheticBindingFor(entry, "approval://synthetic/s5-local-test-only"),
        adapter
      });
    }
    if (this.#registrations.size !== entries.length) {
      throw new Error("synthetic S5 skill implementation registry is incomplete");
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
