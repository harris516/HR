import { createHash, randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { RequestContext } from "../contracts/navigation.js";
import { validateRequestContext } from "../navigation/context-gate.js";
import type {
  CompleteRequirementInput,
  CreateAcceptedOfferInput,
  SyntheticBusinessStorePort,
  SyntheticCaseResolution,
  SyntheticCaseSnapshot,
  SyntheticMutationReceipt,
  SyntheticRequirementSnapshot
} from "./synthetic-business-store.js";
export type { SyntheticCaseSnapshot, SyntheticRequirementSnapshot } from "./synthetic-business-store.js";

const ref = z.string().min(1).max(128);
const requirementKind = z.enum(["DOCUMENTS", "IT_ACCOUNT", "DEVICE"]);
const requirementStatus = z.enum(["not_started", "in_progress", "evidence_pending", "completed", "blocked"]);
const freshness = z.enum(["fresh", "stale", "unavailable", "unknown"]);

const syntheticOfferBaseSchema = z.object({
  schemaVersion: z.literal("synthetic-offer.v1"),
  synthetic: z.literal(true),
  dataSpaceId: ref,
  offerRef: ref,
  candidateRef: ref,
  plannedStartAt: z.iso.datetime({ offset: true }),
  sourceVersionRef: ref,
  requirements: z.array(z.object({
    kind: requirementKind,
    ownerRef: ref,
    deadlineAt: z.iso.datetime({ offset: true }),
    completionCriteriaRef: ref,
    ruleVersionRef: ref,
    sourceVersionRef: ref,
    freshness
  }).strict()).length(3).refine(
    (items) => new Set(items.map((item) => item.kind)).size === 3,
    "the three MVP requirement kinds must each occur exactly once"
  )
});

export const syntheticOfferSchema = z.discriminatedUnion("scopeType", [
  syntheticOfferBaseSchema.extend({
    scopeType: z.literal("TENANT_PRIVATE"),
    tenantId: ref
  }).strict(),
  syntheticOfferBaseSchema.extend({
    scopeType: z.literal("TEAM_SHARED"),
    teamId: ref
  }).strict()
]);

export const syntheticRequirementUpdateSchema = z.object({
  schemaVersion: z.literal("synthetic-requirement-update.v1"),
  caseRef: ref,
  kind: requirementKind,
  expectedCaseVersion: z.number().int().positive(),
  status: requirementStatus,
  evidenceRefs: z.array(ref),
  evidenceValidationRef: ref.optional(),
  conflictRefs: z.array(ref).default([]),
  freshness,
  sourceVersionRef: ref
}).strict().superRefine((value, context) => {
  if (value.status === "completed" && (value.evidenceRefs.length === 0 || !value.evidenceValidationRef)) {
    context.addIssue({ code: "custom", message: "completed requires synthetic evidence and validation references" });
  }
});

type SyntheticOffer = z.infer<typeof syntheticOfferSchema>;
type SyntheticRequirementUpdate = z.infer<typeof syntheticRequirementUpdateSchema>;
type RequirementKind = z.infer<typeof requirementKind>;
type RequirementStatus = z.infer<typeof requirementStatus>;
type Freshness = z.infer<typeof freshness>;

export interface SyntheticCaseAuditSnapshot {
  eventRef: string;
  caseRef: string;
  tenantId: string;
  dataSpaceId: string;
  actorId: string;
  activeTeamId: string;
  teamMembershipRef: string;
  objectScopeType: "TENANT_PRIVATE" | "TEAM_SHARED";
  objectTeamId: string | null;
  eventType: string;
  caseVersion: number;
  occurredAt: string;
}

export class SyntheticCaseStoreError extends Error {
  constructor(readonly code: "DATABASE_PATH_UNSAFE" | "TEST_CONTEXT_REQUIRED" | "SCOPE_MISMATCH" |
    "INPUT_INVALID" | "OFFER_REPLAY_CONFLICT" | "CASE_NOT_FOUND_OR_NOT_ACCESSIBLE" |
    "OBJECT_VERSION_CONFLICT" | "IDEMPOTENCY_KEY_CONFLICT" | "AUDIT_UNAVAILABLE") {
    super(code);
    this.name = "SyntheticCaseStoreError";
  }
}

function ensureOutsideRepository(databasePath: string, repositoryRoot: string): void {
  if (!isAbsolute(databasePath) || !isAbsolute(repositoryRoot)) {
    throw new SyntheticCaseStoreError("DATABASE_PATH_UNSAFE");
  }
  const root = realpathSync(repositoryRoot);
  const parent = realpathSync(dirname(databasePath));
  const target = existsSync(databasePath) ? realpathSync(databasePath) : databasePath;
  for (const path of [parent, target]) {
    const within = relative(root, path);
    if (within === "" || (within !== ".." && !within.startsWith(`..${sep}`) && !isAbsolute(within))) {
      throw new SyntheticCaseStoreError("DATABASE_PATH_UNSAFE");
    }
  }
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

type CaseRow = {
  scope_type: "TENANT_PRIVATE" | "TEAM_SHARED"; team_id: string | null;
  private_tenant_id: string | null; private_actor_ref: string | null;
  data_space_id: string; case_ref: string; offer_ref: string;
  created_by_tenant_id: string; created_by_actor_id: string;
  candidate_ref: string; candidate_display_name?: string; candidate_name_normalized?: string;
  offer_status?: "accepted"; planned_start_at: string; planned_start_at_optional?: string | null;
  source_version_ref: string; input_digest: string; case_version: number;
  created_at?: string; updated_at?: string;
};

export interface TrustedTeamMembership {
  tenantId: string;
  dataSpaceId: string;
  actorId: string;
  activeTeamId: string;
  teamMembershipRef: string;
  roles: readonly string[];
  scopeGrantRefs: readonly string[];
}

type RequirementRow = {
  kind: RequirementKind; version: number; status: RequirementStatus; owner_ref: string;
  deadline_at: string; deadline_at_optional?: string | null; completion_criteria_ref: string; rule_version_ref: string;
  source_version_ref: string; freshness: Freshness; evidence_refs_json: string;
  evidence_validation_ref: string | null; conflict_refs_json: string;
};

/** Local synthetic state only; this is not an OpenClaw Tool or an authority decision. */
export class SyntheticCaseStore implements SyntheticBusinessStorePort {
  readonly #db: DatabaseSync;
  readonly #now: () => Date;
  readonly #trustedTeamMemberships: readonly TrustedTeamMembership[];
  readonly #auditAvailable: () => boolean;

  constructor(options: {
    databasePath: string;
    repositoryRoot: string;
    allowSyntheticTestStorage: true;
    trustedTeamMemberships?: readonly TrustedTeamMembership[];
    now?: () => Date;
    auditAvailable?: () => boolean;
  }) {
    if (!options.allowSyntheticTestStorage) throw new SyntheticCaseStoreError("TEST_CONTEXT_REQUIRED");
    ensureOutsideRepository(options.databasePath, options.repositoryRoot);
    this.#now = options.now ?? (() => new Date());
    this.#trustedTeamMemberships = options.trustedTeamMemberships ?? [];
    this.#auditAvailable = options.auditAvailable ?? (() => true);
    this.#db = new DatabaseSync(options.databasePath);
    this.#db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS synthetic_cases (
        case_ref TEXT PRIMARY KEY,
        scope_type TEXT NOT NULL CHECK (scope_type IN ('TENANT_PRIVATE', 'TEAM_SHARED')),
        team_id TEXT,
        private_tenant_id TEXT,
        private_actor_ref TEXT,
        data_space_id TEXT NOT NULL,
        offer_ref TEXT NOT NULL,
        created_by_tenant_id TEXT NOT NULL,
        created_by_actor_id TEXT NOT NULL,
        candidate_ref TEXT NOT NULL,
        planned_start_at TEXT NOT NULL,
        source_version_ref TEXT NOT NULL,
        input_digest TEXT NOT NULL,
        case_version INTEGER NOT NULL,
        CHECK ((scope_type = 'TENANT_PRIVATE' AND team_id IS NULL AND private_tenant_id IS NOT NULL AND private_actor_ref IS NOT NULL)
          OR (scope_type = 'TEAM_SHARED' AND team_id IS NOT NULL AND private_tenant_id IS NULL AND private_actor_ref IS NULL))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS synthetic_case_business_key
        ON synthetic_cases(scope_type, IFNULL(team_id, ''), IFNULL(private_tenant_id, ''), data_space_id, offer_ref);
      CREATE TABLE IF NOT EXISTS synthetic_requirements (
        case_ref TEXT NOT NULL REFERENCES synthetic_cases(case_ref),
        kind TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        owner_ref TEXT NOT NULL,
        deadline_at TEXT NOT NULL,
        completion_criteria_ref TEXT NOT NULL,
        rule_version_ref TEXT NOT NULL,
        source_version_ref TEXT NOT NULL,
        freshness TEXT NOT NULL,
        evidence_refs_json TEXT NOT NULL,
        evidence_validation_ref TEXT,
        conflict_refs_json TEXT NOT NULL,
        PRIMARY KEY (case_ref, kind)
      );
      CREATE TABLE IF NOT EXISTS synthetic_case_audit (
        event_ref TEXT PRIMARY KEY,
        case_ref TEXT NOT NULL REFERENCES synthetic_cases(case_ref),
        tenant_id TEXT NOT NULL,
        data_space_id TEXT NOT NULL,
        actor_ref TEXT NOT NULL,
        active_team_id TEXT NOT NULL,
        team_membership_ref TEXT NOT NULL,
        object_scope_type TEXT NOT NULL,
        object_team_id TEXT,
        request_ref TEXT NOT NULL,
        event_type TEXT NOT NULL,
        case_version INTEGER NOT NULL,
        occurred_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS synthetic_mutation_idempotency (
        mutation_id TEXT PRIMARY KEY,
        input_digest TEXT NOT NULL,
        event_ref TEXT NOT NULL,
        case_ref TEXT NOT NULL REFERENCES synthetic_cases(case_ref),
        result_case_version INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    this.#addColumn("synthetic_cases", "candidate_display_name", "TEXT");
    this.#addColumn("synthetic_cases", "candidate_name_normalized", "TEXT");
    this.#addColumn("synthetic_cases", "offer_status", "TEXT");
    this.#addColumn("synthetic_cases", "planned_start_at_optional", "TEXT");
    this.#addColumn("synthetic_cases", "created_at", "TEXT");
    this.#addColumn("synthetic_cases", "updated_at", "TEXT");
    this.#addColumn("synthetic_requirements", "deadline_at_optional", "TEXT");
    this.#addColumn("synthetic_case_audit", "requirement_kind", "TEXT");
    this.#addColumn("synthetic_case_audit", "previous_status", "TEXT");
    this.#addColumn("synthetic_case_audit", "new_status", "TEXT");
    this.#addColumn("synthetic_case_audit", "previous_requirement_version", "INTEGER");
    this.#addColumn("synthetic_case_audit", "new_requirement_version", "INTEGER");
    this.#addColumn("synthetic_case_audit", "correlation_ref", "TEXT");
    this.#addColumn("synthetic_case_audit", "runtime_profile_ref", "TEXT");
    this.#addColumn("synthetic_case_audit", "mutation_id", "TEXT");
    this.#db.exec(`CREATE INDEX IF NOT EXISTS synthetic_case_candidate_lookup
      ON synthetic_cases(data_space_id, scope_type, team_id, candidate_name_normalized);`);
  }

  close(): void { this.#db.close(); }

  #addColumn(table: string, column: string, definition: string): void {
    const columns = this.#db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((item) => item.name === column)) {
      this.#db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  ingestOffer(contextInput: unknown, offerInput: unknown): { case: SyntheticCaseSnapshot; created: boolean } {
    const context = this.#context(contextInput);
    const parsed = syntheticOfferSchema.safeParse(offerInput);
    if (!parsed.success) throw new SyntheticCaseStoreError("INPUT_INVALID");
    const offer: SyntheticOffer = parsed.data;
    if (context.dataSpaceId !== offer.dataSpaceId ||
      (offer.scopeType === "TENANT_PRIVATE" && context.tenantId !== offer.tenantId) ||
      (offer.scopeType === "TEAM_SHARED" &&
        (context.activeTeamId !== offer.teamId || !this.#hasTrustedTeamAccess(context, offer.teamId, "write")))) {
      throw new SyntheticCaseStoreError("SCOPE_MISMATCH");
    }
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const prior = this.#db.prepare(`SELECT * FROM synthetic_cases WHERE scope_type = ?
        AND IFNULL(team_id, '') = ? AND IFNULL(private_tenant_id, '') = ?
        AND data_space_id = ? AND offer_ref = ?`)
        .get(offer.scopeType, offer.scopeType === "TEAM_SHARED" ? offer.teamId : "",
          offer.scopeType === "TENANT_PRIVATE" ? offer.tenantId : "", offer.dataSpaceId,
          offer.offerRef) as CaseRow | undefined;
      if (prior !== undefined) {
        if (!this.#canAccessCase(context, prior, "write")) {
          throw new SyntheticCaseStoreError("CASE_NOT_FOUND_OR_NOT_ACCESSIBLE");
        }
        if (prior.input_digest !== digest(offer)) throw new SyntheticCaseStoreError("OFFER_REPLAY_CONFLICT");
        const snapshot = this.#snapshot(prior);
        this.#db.exec("COMMIT");
        return { case: snapshot, created: false };
      }
      const caseRef = `case-synthetic-${randomUUID()}`;
      const occurredAt = this.#now().toISOString();
      this.#db.prepare(`INSERT INTO synthetic_cases
        (case_ref, scope_type, team_id, private_tenant_id, private_actor_ref, data_space_id,
         offer_ref, created_by_tenant_id, created_by_actor_id, candidate_ref, planned_start_at,
         source_version_ref, input_digest, case_version, candidate_display_name,
         candidate_name_normalized, offer_status, planned_start_at_optional, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'accepted', ?, ?, ?)`)
        .run(caseRef, offer.scopeType, offer.scopeType === "TEAM_SHARED" ? offer.teamId : null,
          offer.scopeType === "TENANT_PRIVATE" ? offer.tenantId : null,
          offer.scopeType === "TENANT_PRIVATE" ? context.actorId : null,
          offer.dataSpaceId, offer.offerRef, context.tenantId, context.actorId, offer.candidateRef,
          offer.plannedStartAt, offer.sourceVersionRef, digest(offer), offer.candidateRef,
          this.#normalizeName(offer.candidateRef), offer.plannedStartAt, occurredAt, occurredAt);
      const insertRequirement = this.#db.prepare(`INSERT INTO synthetic_requirements
        (case_ref, kind, version, status, owner_ref, deadline_at, completion_criteria_ref,
         rule_version_ref, source_version_ref, freshness, evidence_refs_json,
         evidence_validation_ref, conflict_refs_json, deadline_at_optional)
         VALUES (?, ?, 1, 'not_started', ?, ?, ?, ?, ?, ?, '[]', NULL, '[]', ?)`);
      for (const requirement of offer.requirements) {
        insertRequirement.run(caseRef, requirement.kind, requirement.ownerRef, requirement.deadlineAt,
          requirement.completionCriteriaRef, requirement.ruleVersionRef,
          requirement.sourceVersionRef, requirement.freshness, requirement.deadlineAt);
      }
      this.#audit(context, caseRef, "synthetic_case_created", 1);
      const created = this.#snapshot(this.#caseRow(caseRef, context, "read"));
      this.#db.exec("COMMIT");
      return { case: created, created: true };
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  getCase(contextInput: unknown, caseRef: string): SyntheticCaseSnapshot | null {
    const context = this.#context(contextInput);
    const row = this.#db.prepare("SELECT * FROM synthetic_cases WHERE case_ref = ?")
      .get(caseRef) as CaseRow | undefined;
    return row === undefined || !this.#canAccessCase(context, row, "read") ? null : this.#snapshot(row);
  }

  listCases(contextInput: unknown): SyntheticCaseSnapshot[] {
    const context = this.#context(contextInput);
    const rows = this.#db.prepare("SELECT * FROM synthetic_cases ORDER BY rowid DESC").all() as CaseRow[];
    return rows.filter((row) => this.#canAccessCase(context, row, "read")).map((row) => this.#snapshot(row));
  }

  resolveCase(
    contextInput: unknown,
    clue: { caseRef?: string; candidateDisplayName?: string }
  ): SyntheticCaseResolution {
    const context = this.#context(contextInput);
    if (clue.caseRef !== undefined) {
      const matched = this.getCase(context, clue.caseRef);
      return matched === null
        ? { status: "NOT_FOUND", case: null, candidateCount: 0 }
        : { status: "MATCHED", case: matched, candidateCount: 1 };
    }
    if (clue.candidateDisplayName === undefined || clue.candidateDisplayName.trim() === "") {
      return { status: "NOT_FOUND", case: null, candidateCount: 0 };
    }
    const normalized = this.#normalizeName(clue.candidateDisplayName);
    const matches = this.listCases(context).filter((item) =>
      this.#normalizeName(item.candidateDisplayName) === normalized);
    if (matches.length === 1) return { status: "MATCHED", case: matches[0]!, candidateCount: 1 };
    return {
      status: matches.length === 0 ? "NOT_FOUND" : "AMBIGUOUS",
      case: null,
      candidateCount: matches.length
    };
  }

  createAcceptedOfferCase(
    contextInput: unknown,
    input: CreateAcceptedOfferInput
  ): SyntheticMutationReceipt {
    const context = this.#context(contextInput);
    const parsed = z.object({
      mutationId: ref,
      offerRef: ref,
      candidateRef: ref,
      candidateDisplayName: z.string().trim().min(1).max(128),
      plannedStartAt: z.iso.datetime({ offset: true }).nullable().optional(),
      sourceVersionRef: ref,
      scopeType: z.enum(["TEAM_SHARED", "TENANT_PRIVATE"]),
      teamId: ref.optional()
    }).strict().safeParse(input);
    if (!parsed.success) throw new SyntheticCaseStoreError("INPUT_INVALID");
    const value = parsed.data;
    if (value.scopeType === "TEAM_SHARED" &&
      (value.teamId !== context.activeTeamId || !this.#hasTrustedTeamAccess(context, value.teamId, "write"))) {
      throw new SyntheticCaseStoreError("SCOPE_MISMATCH");
    }
    const inputDigest = digest(value);
    const replay = this.#idempotencyReplay(context, value.mutationId, inputDigest);
    if (replay !== null) return replay;
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const prior = this.#db.prepare(`SELECT * FROM synthetic_cases WHERE scope_type = ?
        AND IFNULL(team_id, '') = ? AND IFNULL(private_tenant_id, '') = ?
        AND data_space_id = ? AND offer_ref = ?`).get(
        value.scopeType,
        value.scopeType === "TEAM_SHARED" ? (value.teamId ?? "") : "",
        value.scopeType === "TENANT_PRIVATE" ? context.tenantId : "",
        context.dataSpaceId,
        value.offerRef
      ) as CaseRow | undefined;
      if (prior !== undefined) throw new SyntheticCaseStoreError("OFFER_REPLAY_CONFLICT");
      const now = this.#now().toISOString();
      const caseRef = `case-synthetic-${randomUUID()}`;
      this.#db.prepare(`INSERT INTO synthetic_cases
        (case_ref, scope_type, team_id, private_tenant_id, private_actor_ref, data_space_id,
         offer_ref, created_by_tenant_id, created_by_actor_id, candidate_ref, planned_start_at,
         source_version_ref, input_digest, case_version, candidate_display_name,
         candidate_name_normalized, offer_status, planned_start_at_optional, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'accepted', ?, ?, ?)`)
        .run(caseRef, value.scopeType, value.scopeType === "TEAM_SHARED" ? (value.teamId ?? null) : null,
          value.scopeType === "TENANT_PRIVATE" ? context.tenantId : null,
          value.scopeType === "TENANT_PRIVATE" ? context.actorId : null,
          context.dataSpaceId, value.offerRef, context.tenantId, context.actorId, value.candidateRef,
          value.plannedStartAt ?? "", value.sourceVersionRef, inputDigest, value.candidateDisplayName,
          this.#normalizeName(value.candidateDisplayName), value.plannedStartAt ?? null, now, now);
      const insertRequirement = this.#db.prepare(`INSERT INTO synthetic_requirements
        (case_ref, kind, version, status, owner_ref, deadline_at, completion_criteria_ref,
         rule_version_ref, source_version_ref, freshness, evidence_refs_json,
         evidence_validation_ref, conflict_refs_json, deadline_at_optional)
         VALUES (?, ?, 1, 'not_started', ?, '', ?, 'synthetic-mvp-rule-v1', ?, 'fresh', '[]', NULL, '[]', NULL)`);
      for (const kind of ["DOCUMENTS", "IT_ACCOUNT", "DEVICE"] as const) {
        insertRequirement.run(caseRef, kind, `owner-role-${kind.toLowerCase()}`,
          `criteria-${kind.toLowerCase()}-v1`, value.sourceVersionRef);
      }
      const eventRef = this.#audit(context, caseRef, "synthetic_case_created", 1, {
        mutationId: value.mutationId
      });
      this.#db.prepare(`INSERT INTO synthetic_mutation_idempotency
        (mutation_id, input_digest, event_ref, case_ref, result_case_version, created_at)
        VALUES (?, ?, ?, ?, 1, ?)`).run(value.mutationId, inputDigest, eventRef, caseRef, now);
      const snapshot = this.#snapshot(this.#caseRow(caseRef, context, "read"));
      this.#db.exec("COMMIT");
      return { mutationId: value.mutationId, eventRef, idempotentReplay: false, case: snapshot };
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  completeRequirement(
    contextInput: unknown,
    input: CompleteRequirementInput
  ): SyntheticMutationReceipt {
    const context = this.#context(contextInput);
    const parsed = z.object({
      mutationId: ref,
      caseRef: ref,
      kind: requirementKind,
      expectedCaseVersion: z.number().int().positive(),
      expectedRequirementVersion: z.number().int().positive(),
      evidenceRef: ref,
      evidenceValidationRef: ref,
      sourceVersionRef: ref
    }).strict().safeParse(input);
    if (!parsed.success) throw new SyntheticCaseStoreError("INPUT_INVALID");
    const value = parsed.data;
    const inputDigest = digest(value);
    const replay = this.#idempotencyReplay(context, value.mutationId, inputDigest);
    if (replay !== null) return replay;
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.#caseRow(value.caseRef, context, "write");
      if (row.case_version !== value.expectedCaseVersion) {
        throw new SyntheticCaseStoreError("OBJECT_VERSION_CONFLICT");
      }
      const requirement = this.#db.prepare(`SELECT * FROM synthetic_requirements
        WHERE case_ref = ? AND kind = ?`).get(value.caseRef, value.kind) as RequirementRow | undefined;
      if (requirement === undefined || requirement.version !== value.expectedRequirementVersion) {
        throw new SyntheticCaseStoreError("OBJECT_VERSION_CONFLICT");
      }
      const nextCaseVersion = row.case_version + 1;
      const nextRequirementVersion = requirement.version + 1;
      this.#db.prepare(`UPDATE synthetic_requirements SET version = ?, status = 'completed',
        evidence_refs_json = ?, evidence_validation_ref = ?, conflict_refs_json = '[]',
        freshness = 'fresh', source_version_ref = ? WHERE case_ref = ? AND kind = ?`)
        .run(nextRequirementVersion, JSON.stringify([value.evidenceRef]), value.evidenceValidationRef,
          value.sourceVersionRef, value.caseRef, value.kind);
      const now = this.#now().toISOString();
      this.#db.prepare("UPDATE synthetic_cases SET case_version = ?, updated_at = ? WHERE case_ref = ?")
        .run(nextCaseVersion, now, value.caseRef);
      const eventRef = this.#audit(context, value.caseRef, "synthetic_requirement_completed",
        nextCaseVersion, {
          mutationId: value.mutationId,
          requirementKind: value.kind,
          previousStatus: requirement.status,
          newStatus: "completed",
          previousRequirementVersion: requirement.version,
          newRequirementVersion: nextRequirementVersion
        });
      this.#db.prepare(`INSERT INTO synthetic_mutation_idempotency
        (mutation_id, input_digest, event_ref, case_ref, result_case_version, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`).run(value.mutationId, inputDigest, eventRef, value.caseRef,
          nextCaseVersion, now);
      const snapshot = this.#snapshot(this.#caseRow(value.caseRef, context, "read"));
      this.#db.exec("COMMIT");
      return { mutationId: value.mutationId, eventRef, idempotentReplay: false, case: snapshot };
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  updateRequirement(contextInput: unknown, updateInput: unknown): SyntheticCaseSnapshot {
    const context = this.#context(contextInput);
    const parsed = syntheticRequirementUpdateSchema.safeParse(updateInput);
    if (!parsed.success) throw new SyntheticCaseStoreError("INPUT_INVALID");
    const update: SyntheticRequirementUpdate = parsed.data;
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.#caseRow(update.caseRef, context, "write");
      if (row.case_version !== update.expectedCaseVersion) {
        throw new SyntheticCaseStoreError("OBJECT_VERSION_CONFLICT");
      }
      const result = this.#db.prepare(`UPDATE synthetic_requirements SET
        version = version + 1, status = ?, evidence_refs_json = ?, evidence_validation_ref = ?,
        conflict_refs_json = ?, freshness = ?, source_version_ref = ? WHERE case_ref = ? AND kind = ?`)
        .run(update.status, JSON.stringify(update.evidenceRefs), update.evidenceValidationRef ?? null,
          JSON.stringify(update.conflictRefs), update.freshness, update.sourceVersionRef,
          update.caseRef, update.kind);
      if (result.changes !== 1) throw new SyntheticCaseStoreError("INPUT_INVALID");
      const nextVersion = row.case_version + 1;
      this.#db.prepare("UPDATE synthetic_cases SET case_version = ?, updated_at = ? WHERE case_ref = ?")
        .run(nextVersion, this.#now().toISOString(), update.caseRef);
      this.#audit(context, update.caseRef, "synthetic_requirement_updated", nextVersion);
      const updated = this.#snapshot(this.#caseRow(update.caseRef, context, "read"));
      this.#db.exec("COMMIT");
      return updated;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  countAuditEvents(contextInput: unknown, caseRef: string): number {
    const context = this.#context(contextInput);
    if (this.getCase(context, caseRef) === null) return 0;
    const row = this.#db.prepare("SELECT COUNT(*) AS count FROM synthetic_case_audit WHERE case_ref = ?")
      .get(caseRef) as { count: number };
    return row.count;
  }

  listAuditEvents(contextInput: unknown, caseRef: string): SyntheticCaseAuditSnapshot[] {
    const context = this.#context(contextInput);
    if (this.getCase(context, caseRef) === null) return [];
    return this.#db.prepare(`SELECT event_ref, case_ref, tenant_id, data_space_id, actor_ref,
      active_team_id, team_membership_ref, object_scope_type, object_team_id,
      event_type, case_version, occurred_at FROM synthetic_case_audit
      WHERE case_ref = ? ORDER BY rowid`).all(caseRef).map((row) => {
      const item = row as Record<string, string | number | null>;
      return {
        eventRef: item.event_ref as string,
        caseRef: item.case_ref as string,
        tenantId: item.tenant_id as string,
        dataSpaceId: item.data_space_id as string,
        actorId: item.actor_ref as string,
        activeTeamId: item.active_team_id as string,
        teamMembershipRef: item.team_membership_ref as string,
        objectScopeType: item.object_scope_type as "TENANT_PRIVATE" | "TEAM_SHARED",
        objectTeamId: item.object_team_id as string | null,
        eventType: item.event_type as string,
        caseVersion: item.case_version as number,
        occurredAt: item.occurred_at as string
      };
    });
  }

  recordReadinessEvaluation(contextInput: unknown, caseRef: string, expectedCaseVersion: number): string {
    const context = this.#context(contextInput);
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.#caseRow(caseRef, context, "read");
      if (row.case_version !== expectedCaseVersion) {
        throw new SyntheticCaseStoreError("OBJECT_VERSION_CONFLICT");
      }
      const eventRef = this.#audit(context, caseRef, "synthetic_readiness_evaluated", row.case_version);
      this.#db.exec("COMMIT");
      return eventRef;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  #context(input: unknown): RequestContext {
    const result = validateRequestContext(input, this.#now());
    if (!result.ok || result.context.environment !== "test" ||
      result.context.dataAccessPurpose !== "onboarding_operation" ||
      !result.context.roles.includes("onboarding_hr_operations")) {
      throw new SyntheticCaseStoreError("TEST_CONTEXT_REQUIRED");
    }
    return result.context;
  }

  #hasTrustedTeamAccess(context: RequestContext, teamId: string, operation: "read" | "write"): boolean {
    const membership = this.#trustedTeamMemberships.find((candidate) =>
      candidate.tenantId === context.tenantId && candidate.actorId === context.actorId &&
      candidate.dataSpaceId === context.dataSpaceId &&
      candidate.activeTeamId === context.activeTeamId && candidate.teamMembershipRef === context.teamMembershipRef
    );
    if (membership === undefined) return false;
    const requiredScope = operation === "write"
      ? "scope-mvp-synthetic-team-write"
      : "scope-mvp-synthetic-team-read";
    const sameValues = (left: readonly string[], right: readonly string[]) =>
      left.length === right.length && left.every((value) => right.includes(value));
    return context.activeTeamId === teamId && sameValues(context.roles, membership.roles) &&
      sameValues(context.scopeGrantRefs, membership.scopeGrantRefs) &&
      membership.roles.includes("onboarding_hr_operations") && membership.scopeGrantRefs.includes(requiredScope);
  }

  #canAccessCase(context: RequestContext, row: CaseRow, operation: "read" | "write"): boolean {
    if (context.dataSpaceId !== row.data_space_id) return false;
    if (row.scope_type === "TENANT_PRIVATE") {
      return row.private_tenant_id === context.tenantId && row.private_actor_ref === context.actorId;
    }
    return row.team_id !== null && this.#hasTrustedTeamAccess(context, row.team_id, operation);
  }

  #caseRow(caseRef: string, context: RequestContext, operation: "read" | "write"): CaseRow {
    const row = this.#db.prepare("SELECT * FROM synthetic_cases WHERE case_ref = ?")
      .get(caseRef) as CaseRow | undefined;
    if (row === undefined || !this.#canAccessCase(context, row, operation)) {
      throw new SyntheticCaseStoreError("CASE_NOT_FOUND_OR_NOT_ACCESSIBLE");
    }
    return row;
  }

  recordWorkflowEvent(contextInput: unknown, caseRef: string, workflowId: string): string {
    const context = this.#context(contextInput);
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.#caseRow(caseRef, context, "read");
      const eventRef = this.#audit(context, caseRef, `synthetic_workflow_${workflowId}`,
        row.case_version);
      this.#db.exec("COMMIT");
      return eventRef;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  #normalizeName(value: string): string {
    return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");
  }

  #idempotencyReplay(
    context: RequestContext,
    mutationId: string,
    inputDigest: string
  ): SyntheticMutationReceipt | null {
    const row = this.#db.prepare(`SELECT mutation_id, input_digest, event_ref, case_ref
      FROM synthetic_mutation_idempotency WHERE mutation_id = ?`).get(mutationId) as
      { mutation_id: string; input_digest: string; event_ref: string; case_ref: string } | undefined;
    if (row === undefined) return null;
    if (row.input_digest !== inputDigest) throw new SyntheticCaseStoreError("IDEMPOTENCY_KEY_CONFLICT");
    const snapshot = this.getCase(context, row.case_ref);
    if (snapshot === null) throw new SyntheticCaseStoreError("CASE_NOT_FOUND_OR_NOT_ACCESSIBLE");
    return { mutationId, eventRef: row.event_ref, idempotentReplay: true, case: snapshot };
  }

  #snapshot(row: CaseRow): SyntheticCaseSnapshot {
    const requirements = this.#db.prepare(`SELECT * FROM synthetic_requirements
      WHERE case_ref = ? ORDER BY kind`).all(row.case_ref) as RequirementRow[];
    return {
      synthetic: true,
      scopeType: row.scope_type,
      teamId: row.team_id,
      dataSpaceId: row.data_space_id,
      privateTenantId: row.private_tenant_id,
      privateActorId: row.private_actor_ref,
      createdByTenantId: row.created_by_tenant_id,
      createdByActorId: row.created_by_actor_id,
      caseRef: row.case_ref,
      offerRef: row.offer_ref,
      candidateRef: row.candidate_ref,
      candidateDisplayName: row.candidate_display_name ?? row.candidate_ref,
      offerStatus: "accepted",
      plannedStartAt: row.planned_start_at_optional ?? (row.planned_start_at || null),
      sourceVersionRef: row.source_version_ref,
      caseVersion: row.case_version,
      formalReadinessStatus: null,
      suggestedReadiness: requirements.every((item) => item.status === "completed")
        ? "READY_CANDIDATE"
        : "NOT_READY",
      confirmationStatus: "not_confirmed",
      createdAt: row.created_at ?? "1970-01-01T00:00:00.000Z",
      updatedAt: row.updated_at ?? row.created_at ?? "1970-01-01T00:00:00.000Z",
      requirements: requirements.map((item) => ({
        requirementRef: `requirement-${item.kind.toLowerCase()}-${row.case_ref}`,
        kind: item.kind,
        version: item.version,
        status: item.status,
        ownerRef: item.owner_ref,
        deadlineAt: item.deadline_at_optional ?? (item.deadline_at || null),
        completionCriteriaRef: item.completion_criteria_ref,
        ruleVersionRef: item.rule_version_ref,
        sourceVersionRef: item.source_version_ref,
        freshness: item.freshness,
        evidenceRefs: JSON.parse(item.evidence_refs_json) as string[],
        evidenceValidationRef: item.evidence_validation_ref,
        conflictRefs: JSON.parse(item.conflict_refs_json) as string[]
      }))
    };
  }

  #audit(
    context: RequestContext,
    caseRef: string,
    eventType: string,
    caseVersion: number,
    details: {
      mutationId?: string;
      requirementKind?: RequirementKind;
      previousStatus?: RequirementStatus;
      newStatus?: RequirementStatus;
      previousRequirementVersion?: number;
      newRequirementVersion?: number;
    } = {}
  ): string {
    if (!this.#auditAvailable()) throw new SyntheticCaseStoreError("AUDIT_UNAVAILABLE");
    const eventRef = randomUUID();
    const row = this.#db.prepare("SELECT * FROM synthetic_cases WHERE case_ref = ?")
      .get(caseRef) as CaseRow;
    this.#db.prepare(`INSERT INTO synthetic_case_audit
      (event_ref, case_ref, tenant_id, data_space_id, actor_ref, active_team_id,
       team_membership_ref, object_scope_type, object_team_id, request_ref,
       event_type, case_version, occurred_at, requirement_kind, previous_status, new_status,
       previous_requirement_version, new_requirement_version, correlation_ref,
       runtime_profile_ref, mutation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(eventRef, caseRef, context.tenantId, context.dataSpaceId, context.actorId,
        context.activeTeamId, context.teamMembershipRef, row.scope_type, row.team_id,
        context.requestId, eventType, caseVersion, this.#now().toISOString(),
        details.requirementKind ?? null, details.previousStatus ?? null, details.newStatus ?? null,
        details.previousRequirementVersion ?? null, details.newRequirementVersion ?? null,
        context.correlationId, "STEP2.5-SYNTHETIC-MUTATION-V1", details.mutationId ?? null);
    return eventRef;
  }
}

