import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateEngineeringBaseline,
  verifyEngineeringBaselineDocumentDigests
} from "../validation/validate-engineering-baseline.js";

const filePath = resolve(process.argv[2] ?? "config/engineering-baseline.test.json");
const manifest = validateEngineeringBaseline(JSON.parse(await readFile(filePath, "utf8")));
const documentsRoot = process.argv[3];
if (documentsRoot !== undefined) {
  await verifyEngineeringBaselineDocumentDigests(manifest, resolve(documentsRoot));
}

console.log(JSON.stringify({
  status: "engineering_baseline_manifest_accepted",
  manifestVersion: manifest.manifestVersion,
  components: manifest.components.length,
  practiceContracts: manifest.practiceContracts.length,
  outputContracts: manifest.outputContracts.length,
  securityControls: manifest.securityControls.length,
  formalActions: manifest.formalActions.length,
  enabledBusinessCapabilities: manifest.runtimeAssertions.enabledBusinessCapabilityCount,
  registeredReservedCapabilities: manifest.runtimeAssertions.registeredReservedCapabilityCount,
  externalSideEffectsAllowed: manifest.runtimeAssertions.externalSideEffectsAllowed,
  customerConfigurationSatisfied: manifest.gateModel.customerConfigurationSatisfied,
  documentDigestsVerified: documentsRoot !== undefined
}, null, 2));
