# E1 Candidate Oracle Review — local synthetic primitive package

Status: **DRAFT / AUTHOR-PROPOSED / NOT INDEPENDENTLY REVIEWED**. These 31 proposed expectations correspond to `config/e1-case-handoff.draft.json`. They were derived from the reviewed design and code reading, not from an authorized E1 run. They are stored in the same repository as the inputs, so this is an `EVAL_CANDIDATE_HANDOFF`, **not** protected Holdout or Acceptance data. The project owner must review each expectation independently; `PASS` must not be assigned merely because code currently returns it.

For each non-success outcome, the future executable Case must additionally assert unchanged formal/business state, no Capability/connector/channel side effect, and the applicable route/audit contract. The pure-function proposals below do not themselves produce durable audit records. Exact Digest literals and fully materialized fixture snapshots remain pending.

| Case | Proposed exact result or invariant | Design basis / review question |
|---|---|---|
| HC-E1-001 | Context accepted: `ok=true`. | 11 Request Context; confirm all synthetic bindings are complete. |
| HC-E1-002 | `ok=false`, `hardBlock=true`, `DATA_SPACE_MISSING_OR_MISMATCH`. | 08/11 scope fail-closed; no object existence disclosure. |
| HC-E1-003 | `status=resolved`, `caseId=case-handoff-73`. | 10/11 unique candidate ID within matching Tenant/DataSpace. |
| HC-E1-004 | `status=stale_mapping`; no selected Case returned. | 10 selected reference TTL. |
| HC-E1-005 | `status=PASS`, `result=FRESH` at the policy-supplied exact-age boundary. | 09 §12; no invented threshold. |
| HC-E1-006 | `status=BLOCKED`, `FRESHNESS_POLICY_UNCONFIGURED`. | 09 §12; absent customer threshold cannot imply fresh. |
| HC-E1-007 | `status=BLOCKED`, `EVIDENCE_PRECONDITION_MISSING`. | 09 §16; validator authority is required, not optional. |
| HC-E1-008 | `status=PASS`, `result=NOT_ELIGIBLE`; never Formal READY. | 09 §§23—24; one blocking Requirement remains. |
| HC-E1-009 | `status=PASS`, `result=RECALCULATE_REQUIRED`; no prior record deleted. | 09 §25 policy-version change triggers impact analysis. |
| HC-E1-010 | `effectivePHC=PHC_3`, `reviewRequired=true`, `agentActionBlocked=false` for `prohibition=NONE`. | 03 §7.6 takes the strictest explicit class; PHC is not permission. |
| HC-E1-011 | `effectivePHC=PHC_4`, `reviewRequired=true`, `agentActionBlocked=true`. | 03 §5 PHC-4 support only; no Agent decision. |
| HC-E1-012 | `routeType=HUMAN_HANDOFF`, `status=waiting_for_human`, `REVIEW_REQUIRED`, `mayCallCapability=false`. | 03/11 controlled professional decision. |
| HC-E1-013 | `routeType=SYSTEM_HARD_BLOCK`, `status=blocked`, `SYSTEM_HARD_BLOCK`, `mayCallCapability=false`. | 03/16 cross-scope absolute prohibition. |
| HC-E1-014 | `result=allow`, no deny reason; this is navigation precheck only, not business Authority. | 11 matching synthetic ScopeGrant/Action/Resource. |
| HC-E1-015 | `result=deny`, `DATA_SPACE_MISSING_OR_MISMATCH`. | 08/11 mismatched referenced Grant cannot authorize. |
| HC-E1-016 | `status=PASS`, `SYNTHETIC_GATE_CONDITIONS_MET`; **not** a real AuthorityGrant. | 16 §§6, 8—9; all inputs are preverified synthetic facts. |
| HC-E1-017 | `status=BLOCKED`, `AUTHORITY_GRANT_MISMATCH`. | 16 §8; outside effective period. |
| HC-E1-018 | `status=BLOCKED`, `SOD_SELF_REVIEW`. | 16 §9; requester cannot self-review. |
| HC-E1-019 | Projection contains only `taskStatus` and `contactAlias`; `credential` omitted. | 16 §19; even listed Credential/Secret cannot enter generic output. |
| HC-E1-020 | `status=BLOCKED`, `FIELD_PROJECTION_POLICY_UNCONFIGURED`; no fields returned. | 16 §§7,19 purpose and projection policy required. |
| HC-E1-021 | Both payloads produce the **same** `sha256:` digest. Literal hash must be independently pinned after fixture materialization. | 12 canonical digest; object key order must not matter. |
| HC-E1-022 | Payloads produce **different** `sha256:` digests. Literal hashes must be independently pinned. | 12 distinct payloads cannot share this test oracle. |
| HC-E1-023 | `DUPLICATE`; implementation must not run again when used by executor. | 12/S6 same key and payload digest. |
| HC-E1-024 | `CONFLICT`; no implementation call or cached output on reused key with changed payload. | 12/S6 idempotency conflict. |
| HC-E1-025 | Transition `validated→in_progress`; task status updated once and one transition reference appended. | 11 lifecycle permitted edge. |
| HC-E1-026 | Invalid `waiting_for_human→completed` throws; task remains `waiting_for_human`, transition count unchanged. | 11 lifecycle fail-closed. |
| HC-E1-027 | `status=PASS`, `ISOLATED_FOR_SYNTHETIC_TEST` for the supplied synthetic checks; **not** a real contamination attestation. | 17—19 scope and split invariants. |
| HC-E1-028 | `status=BLOCKED`, `EVAL_CONTAMINATION_DETECTED`. | 18/19 Training Author must not see Expected Answers. |
| HC-E1-029 | `status=BLOCKED`, `EVAL_CONTAMINATION_UNRESOLVED`. | 18/19 indeterminate semantic scan cannot clear contamination. |
| HC-E1-030 | `status=BLOCKED`, `READY_INPUT_INDETERMINATE`; no `ELIGIBLE` candidate. | 09 §24 unknown critical freshness blocks Ready. |
| HC-E1-031 | `ok=false`, `hardBlock=false`, `REQUEST_CONTEXT_INVALID`; no Capability call. | 10/11 local primitive accepts only the synthetic test channel. |

## Review decisions required

- [ ] For each case, independently verify input materialization, exact result, reason, state invariants and forbidden side effects against the cited design. Record reviewer, decision, rationale and review time outside this author draft.
- [ ] Resolve any Oracle disagreement as `EVAL_ORACLE_CONFLICT`; do not majority-vote or change the original expected result in place. New expectation requires a new Case version and review.
- [ ] Pin literal Digest outputs, complete non-success Route/State/Audit/Forbidden Side-Effect assertions, and establish a fixture adapter before any case can become `EvalCaseV1`.
- [x] Confirm the field mapping: the owner agreed that `EvalCaseV1.expectedReasonCodes` is only for evaluator `EVAL_*` diagnostics. Navigation/policy/business reason codes remain exact expected outputs in versioned Oracle assertions referenced by `requiredOutputAssertions`; an expected business denial can still be an Eval PASS with `expectedReasonCodes: []`. No domain reason may be relabeled as an Eval failure.
- [ ] Materialize and independently review the exact Oracle assertion references for every applicable Case, including domain reason, route/result/state and no-side-effect checks. The mapping decision alone is not Oracle approval.
- [ ] Confirm independent generator lineage, access separation, all seven contamination checks, Privacy/Security review and an approved Holdout partition before promotion from `EVAL_CANDIDATE_HANDOFF`.

Until all of the above are completed, this file is an **author proposal**, not an independent Oracle or E1 result.
