export type CapabilityExecutionAuditEventType =
  | "capability_implementation_started"
  | "capability_implementation_completed"
  | "capability_implementation_failed"
  | "capability_implementation_duplicate_suppressed";

export interface CapabilityExecutionAuditEvent {
  auditRef: string;
  eventType: CapabilityExecutionAuditEventType;
  capabilityRequestId: string;
  capabilityId: string;
  capabilityVersion: string;
  implementationBindingRef: string;
  tenantId: string;
  dataSpaceId: string;
  actorId: string;
  resultStatus?: string;
  reasonCodes: string[];
  occurredAt: string;
}

export interface CapabilityExecutionAuditSink {
  isAvailable(): boolean;
  append(event: CapabilityExecutionAuditEvent): boolean;
}

export class InMemoryCapabilityExecutionAuditSink implements CapabilityExecutionAuditSink {
  readonly #events: CapabilityExecutionAuditEvent[] = [];

  constructor(private readonly available = true) {}

  isAvailable(): boolean {
    return this.available;
  }

  append(event: CapabilityExecutionAuditEvent): boolean {
    if (!this.available) {
      return false;
    }
    this.#events.push(structuredClone(event));
    return true;
  }

  events(): CapabilityExecutionAuditEvent[] {
    return structuredClone(this.#events);
  }
}
