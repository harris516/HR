export interface NavigationAuditEvent {
  eventId: string;
  eventType: string;
  requestId: string;
  correlationId: string;
  tenantId?: string;
  dataSpaceId?: string;
  taskId?: string;
  reasonCodes: string[];
  occurredAt: string;
}

export interface NavigationAuditSink {
  isAvailable(): boolean;
  append(event: NavigationAuditEvent): void;
  events(): readonly NavigationAuditEvent[];
}

export class InMemoryNavigationAuditSink implements NavigationAuditSink {
  private readonly records: NavigationAuditEvent[] = [];

  constructor(private available = true) {}

  isAvailable(): boolean {
    return this.available;
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  append(event: NavigationAuditEvent): void {
    if (!this.available) throw new Error("AUDIT_UNAVAILABLE");
    this.records.push(structuredClone(event));
  }

  events(): readonly NavigationAuditEvent[] {
    return this.records;
  }
}
