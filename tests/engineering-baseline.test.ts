import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { capabilityRegistry } from "../src/capabilities/registry.js";
import {
  baselineComponentIds,
  formalActionIds,
  p0OutputSpecIds,
  practicePackIds,
  securityControlIds
} from "../src/contracts/engineering-baseline.js";
import {
  EngineeringBaselineValidationError,
  validateEngineeringBaseline
} from "../src/validation/validate-engineering-baseline.js";

const manifest = JSON.parse(readFileSync("config/engineering-baseline.test.json", "utf8"));

describe("10-16 engineering baseline manifest", () => {
  it("pins all seven components and every reviewed disabled contract set", () => {
    const result = validateEngineeringBaseline(structuredClone(manifest));
    expect(result.components).toHaveLength(baselineComponentIds.length);
    expect(result.practiceContracts).toHaveLength(practicePackIds.length);
    expect(result.outputContracts).toHaveLength(p0OutputSpecIds.length);
    expect(result.securityControls).toHaveLength(securityControlIds.length);
    expect(result.formalActions).toHaveLength(formalActionIds.length);
  });

  it("keeps every 13-16 contract disabled and unbound", () => {
    const result = validateEngineeringBaseline(structuredClone(manifest));
    expect(result.components.every((item) => !item.executionAllowed)).toBe(true);
    expect(result.practiceContracts.every((item) => item.runtimeBindingRef === null)).toBe(true);
    expect(result.outputContracts.every((item) => item.runtimeBindingRef === null)).toBe(true);
    expect(result.securityControls.every((item) => item.runtimeBindingRef === null)).toBe(true);
  });

  it("maps every formal action to a reserved and non-registered capability", () => {
    const result = validateEngineeringBaseline(structuredClone(manifest));
    const reserved = new Set(capabilityRegistry.reservedCapabilities.map((item) => item.capabilityId));
    expect(result.formalActions.filter((item) => item.capabilityId !== null)
      .every((item) => reserved.has(item.capabilityId!))).toBe(true);
    expect(result.formalActions.every((item) => !item.registrationAllowed && item.implementationBindingRef === null)).toBe(true);
  });

  it("rejects a missing security control", () => {
    const invalid = structuredClone(manifest);
    invalid.securityControls.pop();
    expect(() => validateEngineeringBaseline(invalid)).toThrow();
  });

  it("rejects a duplicate output contract even when the array length is unchanged", () => {
    const invalid = structuredClone(manifest);
    invalid.outputContracts[6] = invalid.outputContracts[0];
    expect(() => validateEngineeringBaseline(invalid)).toThrow(EngineeringBaselineValidationError);
  });

  it("rejects attempts to enable customer configuration or side effects", () => {
    const customerEnabled = structuredClone(manifest);
    customerEnabled.gateModel.customerConfigurationSatisfied = true;
    expect(() => validateEngineeringBaseline(customerEnabled)).toThrow();

    const sideEffectsEnabled = structuredClone(manifest);
    sideEffectsEnabled.runtimeAssertions.externalSideEffectsAllowed = true;
    expect(() => validateEngineeringBaseline(sideEffectsEnabled)).toThrow();
  });

  it("rejects an unreserved formal action identity", () => {
    const invalid = structuredClone(manifest);
    invalid.formalActions[0].capabilityId = null;
    expect(() => validateEngineeringBaseline(invalid)).toThrow();
  });

  it("rejects component maturity and formal-action authority drift", () => {
    const componentDrift = structuredClone(manifest);
    componentDrift.components[3].maturity = "RUNTIME_VERIFIED";
    expect(() => validateEngineeringBaseline(componentDrift)).toThrow(EngineeringBaselineValidationError);

    const authorityDrift = structuredClone(manifest);
    authorityDrift.formalActions[9].authorityType = "EXPORT_APPROVAL_AUTHORITY";
    expect(() => validateEngineeringBaseline(authorityDrift)).toThrow(EngineeringBaselineValidationError);
  });

  it("freezes the default-closed runtime counts", () => {
    const result = validateEngineeringBaseline(structuredClone(manifest));
    expect(result.runtimeAssertions).toMatchObject({
      plannedCapabilityCount: 18,
      enabledBusinessCapabilityCount: 0,
      reservedCapabilityCount: 17,
      registeredReservedCapabilityCount: 0,
      physicalToolBindingCount: 0,
      connectorBindingCount: 0,
      channelBindingCount: 0,
      realCustomerDataAllowed: false,
      formalInternalCommitAllowed: false,
      externalSideEffectsAllowed: false,
      outboundMessagingAllowed: false
    });
  });
});
