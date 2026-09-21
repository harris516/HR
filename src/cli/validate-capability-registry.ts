import { capabilityRegistry } from "../capabilities/registry.js";
import { validateCapabilityRegistry } from "../validation/validate-capability-registry.js";

const registry = validateCapabilityRegistry(capabilityRegistry);

process.stdout.write(`${JSON.stringify({
  status: "capability_registry_contracts_accepted",
  contractVersion: registry.contractVersion,
  registryVersion: registry.registryVersion,
  plannedCapabilityCount: registry.capabilities.length,
  executableCapabilityCount: registry.capabilities.filter(
    (entry) => String(entry.status) === "TEST_STUB_ENABLED"
  ).length,
  reservedCapabilityCount: registry.reservedCapabilities.length,
  implementationBindingCount: registry.capabilities.filter(
    (entry) => entry.implementationBindingRef !== null
  ).length,
  physicalToolBindingCount: registry.capabilities.reduce(
    (total, entry) => total + entry.physicalToolBindingRefs.length,
    0
  ),
  externalSideEffect: false
}, null, 2)}\n`);
