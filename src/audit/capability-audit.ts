import type { CapabilityGatewayResult } from "../contracts/capability-gateway.js";

export type CapabilityGatewayAuditEventType =
  | "capability_gateway_ingress"
  | "capability_gateway_rejected"
  | "capability_gateway_admission_allowed";

export interface CapabilityGatewayAuditEvent {
  auditRef: string;
  eventType: CapabilityGatewayAuditEventType;
  capabilityRequestId?: string;
  taskId?: string;
  capabilityId?: string;
  capabilityVersion?: string;
  tenantId?: string;
  dataSpaceId?: string;
  actorId?: string;
  decision?: CapabilityGatewayResult["decision"];
  reasonCodes: string[];
  occurredAt: string;
}

export interface CapabilityGatewayAuditSink {
  isAvailable(): boolean;
  append(event: CapabilityGatewayAuditEvent): boolean;
}

export class InMemoryCapabilityGatewayAuditSink implements CapabilityGatewayAuditSink {
  readonly #events: CapabilityGatewayAuditEvent[] = [];

  constructor(private readonly available = true) {}

  isAvailable(): boolean {
    return this.available;
  }

  append(event: CapabilityGatewayAuditEvent): boolean {
    if (!this.available) {
      return false;
    }
    this.#events.push(structuredClone(event));
    return true;
  }

  events(): CapabilityGatewayAuditEvent[] {
    return structuredClone(this.#events);
  }
}

