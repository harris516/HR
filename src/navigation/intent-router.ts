import type {
  ActionClass,
  IntentCandidate,
  IntentClass,
  IntentId,
  RequestContext,
  SubjectRequirement
} from "../contracts/navigation.js";

interface IntentDefinition {
  intentId: IntentId;
  intentClass: IntentClass;
  taskType: string;
  subjectRequirement: SubjectRequirement;
  action: ActionClass;
  capabilityCandidate?: "read_stub" | "analyze_stub" | "draft_stub";
}

const definitions: Record<IntentId, IntentDefinition> = {
  LIST_ONBOARDING_CASES: { intentId: "LIST_ONBOARDING_CASES", intentClass: "supported_p0", taskType: "CASE_LIST_QUERY", subjectRequirement: "collection", action: "read", capabilityCandidate: "read_stub" },
  LIST_RISK_CASES: { intentId: "LIST_RISK_CASES", intentClass: "supported_p0", taskType: "RISK_CASE_QUERY", subjectRequirement: "collection", action: "analyze", capabilityCandidate: "analyze_stub" },
  GET_CASE_STATUS: { intentId: "GET_CASE_STATUS", intentClass: "supported_p0", taskType: "CASE_STATUS_CHECK", subjectRequirement: "unique_case", action: "read", capabilityCandidate: "read_stub" },
  CHECK_REQUIREMENT_STATUS: { intentId: "CHECK_REQUIREMENT_STATUS", intentClass: "supported_p0", taskType: "REQUIREMENT_STATUS_CHECK", subjectRequirement: "unique_case", action: "read", capabilityCandidate: "read_stub" },
  DAY1_READY_CHECK: { intentId: "DAY1_READY_CHECK", intentClass: "supported_p0", taskType: "DAY1_READY_CHECK", subjectRequirement: "unique_case", action: "analyze", capabilityCandidate: "analyze_stub" },
  CREATE_REMINDER_DRAFT: { intentId: "CREATE_REMINDER_DRAFT", intentClass: "supported_p0", taskType: "REMINDER_DRAFT", subjectRequirement: "unique_case", action: "draft", capabilityCandidate: "draft_stub" },
  CREATE_ESCALATION_DRAFT: { intentId: "CREATE_ESCALATION_DRAFT", intentClass: "supported_p0", taskType: "ESCALATION_DRAFT", subjectRequirement: "unique_case", action: "draft", capabilityCandidate: "draft_stub" },
  CREATE_REVIEW_DRAFT: { intentId: "CREATE_REVIEW_DRAFT", intentClass: "supported_p0", taskType: "REVIEW_REQUEST_DRAFT", subjectRequirement: "unique_case", action: "draft", capabilityCandidate: "draft_stub" },
  REVALIDATE_READY: { intentId: "REVALIDATE_READY", intentClass: "supported_p0", taskType: "READINESS_REVALIDATION", subjectRequirement: "unique_case", action: "analyze", capabilityCandidate: "analyze_stub" },
  FORMAL_READY_COMMIT_REQUEST: { intentId: "FORMAL_READY_COMMIT_REQUEST", intentClass: "forbidden_request", taskType: "FORMAL_READY_COMMIT_REQUEST", subjectRequirement: "unique_case", action: "commit" },
  REQUIREMENT_COMMIT_REQUEST: { intentId: "REQUIREMENT_COMMIT_REQUEST", intentClass: "forbidden_request", taskType: "REQUIREMENT_COMMIT_REQUEST", subjectRequirement: "unique_case", action: "commit" },
  EXTERNAL_SEND_REQUEST: { intentId: "EXTERNAL_SEND_REQUEST", intentClass: "forbidden_request", taskType: "EXTERNAL_SEND_REQUEST", subjectRequirement: "unique_case", action: "execute" },
  REVIEW_DECISION_REQUEST: { intentId: "REVIEW_DECISION_REQUEST", intentClass: "controlled_request", taskType: "REVIEW_DECISION_REQUEST", subjectRequirement: "unique_case", action: "decide" },
  WAIVER_REQUEST: { intentId: "WAIVER_REQUEST", intentClass: "controlled_request", taskType: "WAIVER_REQUEST", subjectRequirement: "unique_case", action: "decide" },
  EMPLOYMENT_DECISION_REQUEST: { intentId: "EMPLOYMENT_DECISION_REQUEST", intentClass: "forbidden_request", taskType: "EMPLOYMENT_DECISION_REQUEST", subjectRequirement: "unique_case", action: "decide" },
  SENSITIVE_EXPORT_REQUEST: { intentId: "SENSITIVE_EXPORT_REQUEST", intentClass: "forbidden_request", taskType: "SENSITIVE_EXPORT_REQUEST", subjectRequirement: "collection", action: "export" },
  CROSS_SCOPE_REQUEST: { intentId: "CROSS_SCOPE_REQUEST", intentClass: "forbidden_request", taskType: "CROSS_SCOPE_REQUEST", subjectRequirement: "none", action: "read" },
  UNSUPPORTED_HR_DOMAIN: { intentId: "UNSUPPORTED_HR_DOMAIN", intentClass: "out_of_scope", taskType: "CLARIFICATION_OR_HANDOFF", subjectRequirement: "none", action: "none" },
  PROMPT_OVERRIDE_REQUEST: { intentId: "PROMPT_OVERRIDE_REQUEST", intentClass: "forbidden_request", taskType: "PROMPT_OVERRIDE_REQUEST", subjectRequirement: "none", action: "none" },
  UNKNOWN_INTENT: { intentId: "UNKNOWN_INTENT", intentClass: "unknown", taskType: "CLARIFICATION_OR_HANDOFF", subjectRequirement: "none", action: "none" }
};

function matches(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

export function classifyIntentCandidates(
  text: string,
  context: RequestContext,
  id: () => string
): IntentCandidate[] {
  const normalized = text.toLowerCase();
  const ids: IntentId[] = [];
  const add = (intentId: IntentId): void => {
    if (!ids.includes(intentId)) ids.push(intentId);
  };

  if (matches(normalized, /其他租户|another tenant|cross[- ]tenant/)) add("CROSS_SCOPE_REQUEST");
  if (matches(normalized, /忽略.*规则|ignore.*instruction|你现在是管理员/)) add("PROMPT_OVERRIDE_REQUEST");
  if (matches(normalized, /标记.*ready|确认.*ready|mark.*ready/)) add("FORMAL_READY_COMMIT_REQUEST");
  if (matches(normalized, /改成已完成|标记.*完成|mark.*completed/)) add("REQUIREMENT_COMMIT_REQUEST");
  if (matches(normalized, /发送|发飞书|send now|send message/)) add("EXTERNAL_SEND_REQUEST");
  if (matches(normalized, /替我批准|批准.*异常|approve.*review/)) add("REVIEW_DECISION_REQUEST");
  if (matches(normalized, /豁免|waive/)) add("WAIVER_REQUEST");
  if (matches(normalized, /拒绝.*入职|取消.*offer|reject.*hire/)) add("EMPLOYMENT_DECISION_REQUEST");
  if (matches(normalized, /导出.*证件|敏感.*导出|export.*identity/)) add("SENSITIVE_EXPORT_REQUEST");
  if (matches(normalized, /招聘|绩效|薪酬|recruiting|performance|payroll/)) add("UNSUPPORTED_HR_DOMAIN");

  if (matches(normalized, /重新.*ready|revalidate.*ready/)) add("REVALIDATE_READY");
  if (matches(normalized, /催材料.*草稿|提醒草稿|reminder draft/)) add("CREATE_REMINDER_DRAFT");
  if (matches(normalized, /升级.*草稿|设备延误.*升级|escalation draft/)) add("CREATE_ESCALATION_DRAFT");
  if (matches(normalized, /复核.*草稿|review request draft/)) add("CREATE_REVIEW_DRAFT");
  if (matches(normalized, /合同.*(状态|签)|requirement status/)) add("CHECK_REQUIREMENT_STATUS");
  if (matches(normalized, /风险员工|哪些.*风险|risk cases/)) add("LIST_RISK_CASES");
  if (matches(normalized, /下周.*入职|入职员工列表|list onboarding/)) add("LIST_ONBOARDING_CASES");
  if (matches(normalized, /(day.?1|明天).*(ready|入职)|能正常入职|ready check/)) add("DAY1_READY_CHECK");
  if (matches(normalized, /查询.*状态|case.*状态|到哪一步|case status/)) add("GET_CASE_STATUS");

  if (ids.length === 0) add("UNKNOWN_INTENT");

  return ids.map((intentId) => {
    const definition = definitions[intentId];
    return {
      intentCandidateId: `intent-${id()}`,
      requestContextRef: context.requestId,
      correlationId: context.correlationId,
      intentId: definition.intentId,
      intentClass: definition.intentClass,
      taskType: definition.taskType,
      subjectRequirement: definition.subjectRequirement,
      requestedActionClass: definition.action,
      ...(definition.capabilityCandidate === undefined
        ? {}
        : { capabilityCandidate: definition.capabilityCandidate }),
      reasonCodes: []
    };
  });
}
