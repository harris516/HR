export type CaseIntakeRoutingDecision =
  | {
    decision: "ROUTE";
    skillId: "onboarding_requirement_tracking_pack";
    workflowId: "synthetic_requirement_completion_update";
    businessInput: {
      candidateDisplayName: string;
      requirementKind: "DOCUMENTS" | "IT_ACCOUNT" | "DEVICE";
    };
    missingConditions: [];
  }
  | {
    decision: "ROUTE";
    skillId: "onboarding_case_intake_pack";
    workflowId: "synthetic_case_create_from_accepted_offer";
    businessInput: {
      candidateDisplayName: string;
      offerAccepted: true;
      plannedStartAt: null;
    };
    missingConditions: [];
  }
  | {
    decision: "ROUTE";
    skillId: "onboarding_case_intake_pack";
    workflowId: "case_intake_candidate";
    businessInput: { handoffRef?: string };
    missingConditions: Array<"handoffRef">;
  }
  | {
    decision: "CLARIFY";
    skillId: null;
    workflowId: null;
    businessInput: Record<string, never>;
    missingConditions: Array<
      "syntheticContext" | "candidateDisplayName" | "offerAccepted" | "createCaseIntent" |
      "requirementKind" | "requirementCompleted"
    >;
  };

const syntheticContextPatterns = [
  /合成(?:测试|数据)?/iu,
  /测试数据/iu,
  /\bsynthetic(?:\s+(?:test|data))?\b/iu
];

const acceptedOfferPatterns = [
  /(?:已|已经)接受(?:了)?\s*(?:offer|录用|聘用)/iu,
  /(?:offer|录用|聘用)\s*(?:已|已经)?(?:被)?接受/iu,
  /\boffer\s+(?:is\s+)?accepted\b/iu,
  /(?:offer|录用|聘用)[\s\S]{0,24}(?:他|她|候选人)[\s\S]{0,8}(?:已|已经)接受/iu
];

const createVerbPatterns = [/(?:创建|建立|新建)/u, /\b(?:create|set\s+up)\b/iu];
const onboardingCasePatterns = [/(?:入职案例|入职\s*case)/iu, /\bonboarding\s+case\b/iu];
const intakeReviewPatterns = [
  /(?:检查|读取|查看)[\s\S]{0,20}(?:handoff|交接)/iu,
  /(?:handoff|交接)[\s\S]{0,20}(?:是否完整|完整性|检查|读取|查看)/iu,
  /(?:基于|根据)[\s\S]{0,20}(?:现有|已有)[\s\S]{0,20}(?:offer\s*)?handoff[\s\S]{0,20}(?:草稿|材料)/iu
];

const uncertainCompletionPatterns = [/(?:可能|也许|大概|似乎|看起来|差不多)/u,
  /\b(?:maybe|probably|seems?|almost)\b/iu];

const requirementPatterns = {
  DOCUMENTS: [/(?:入职文件|入职材料|入职资料)/u, /\bonboarding\s+(?:documents?|materials?)\b/iu],
  IT_ACCOUNT: [/(?:IT\s*账号|系统账号)/iu, /\bIT\s+account\b/iu],
  DEVICE: [/(?:电脑|笔记本|办公设备)/u, /\b(?:computer|laptop|device)\b/iu]
} as const;

const completionPatterns = {
  DOCUMENTS: [/(?:已经|已)?(?:收齐|齐全|收全|全部收到|准备齐)/u,
    /\b(?:collected|complete|ready)\b/iu],
  IT_ACCOUNT: [/(?:已经|已)?(?:开好|开通|创建完成|准备好)/u,
    /\b(?:opened|provisioned|created|ready)\b/iu],
  DEVICE: [/(?:已经|已)?(?:准备好|到位|配好|配发完成)/u,
    /\b(?:prepared|provisioned|ready)\b/iu]
} as const;

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function candidateDisplayName(text: string): string | null {
  const genericRoleLabels = new Set(["候选人", "新员工", "员工"]);
  const patterns = [
    /\b([A-Za-z][A-Za-z0-9._-]{0,63})['’]s\s+offer\b/iu,
    /\b([A-Za-z][A-Za-z0-9._-]{0,63})\b\s*的/u,
    /(?:给|为)\s*([A-Za-z][A-Za-z0-9._-]{0,63})\s*(?:发|创建|建立)/u,
    /\b([A-Za-z][A-Za-z0-9._-]{0,63})\b\s*(?:已|已经)?接受/u,
    /(?:给|为)\s*([\p{Script=Han}]{2,8})\s*(?:发|创建|建立)/u,
    /([\p{Script=Han}]{2,8})\s*(?:已|已经)接受(?:录用|聘用)?/u,
    /([\p{Script=Han}]{2,8})\s*的(?:入职文件|入职材料|入职资料|IT\s*账号|系统账号|电脑|笔记本|办公设备)/iu
  ];
  for (const pattern of patterns) {
    const matched = text.match(pattern)?.[1];
    if (matched !== undefined && !genericRoleLabels.has(matched.trim())) return matched.trim();
  }
  return null;
}

function requirementKind(text: string): "DOCUMENTS" | "IT_ACCOUNT" | "DEVICE" | null {
  const matches = (Object.entries(requirementPatterns) as Array<
    ["DOCUMENTS" | "IT_ACCOUNT" | "DEVICE", readonly RegExp[]]
  >).filter(([, patterns]) => matchesAny(text, patterns));
  return matches.length === 1 ? matches[0]![0] : null;
}

function requirementIsExplicitlyCompleted(
  text: string,
  kind: "DOCUMENTS" | "IT_ACCOUNT" | "DEVICE"
): boolean {
  return !matchesAny(text, uncertainCompletionPatterns) && matchesAny(text, completionPatterns[kind]);
}

function handoffRef(text: string): string | undefined {
  return text.match(/\bhandoff[-_][A-Za-z0-9][A-Za-z0-9_-]*\b/iu)?.[0];
}

/**
 * A routing-contract evaluator for Task Navigation. It emits a recommendation only;
 * business execution still requires the selected Skill, strict Tool schema, Gateway,
 * trusted RequestContext, and persistent audit.
 */
export function evaluateCaseIntakeRouting(requestText: string): CaseIntakeRoutingDecision {
  const text = requestText.normalize("NFKC").trim();
  const isIntakeReview = matchesAny(text, intakeReviewPatterns);
  if (isIntakeReview) {
    const ref = handoffRef(text);
    return {
      decision: "ROUTE",
      skillId: "onboarding_case_intake_pack",
      workflowId: "case_intake_candidate",
      businessInput: ref === undefined ? {} : { handoffRef: ref },
      missingConditions: ref === undefined ? ["handoffRef"] : []
    };
  }

  const candidate = candidateDisplayName(text);
  const kind = requirementKind(text);
  const hasRequirementSignal = kind !== null || matchesAny(text,
    Object.values(requirementPatterns).flat());
  if (hasRequirementSignal) {
    const conditions = {
      syntheticContext: matchesAny(text, syntheticContextPatterns),
      candidateDisplayName: candidate !== null,
      requirementKind: kind !== null,
      requirementCompleted: kind !== null && requirementIsExplicitlyCompleted(text, kind)
    };
    const missingConditions = (Object.entries(conditions) as Array<
      [keyof typeof conditions, boolean]
    >).filter(([, satisfied]) => !satisfied).map(([name]) => name);
    if (missingConditions.length === 0 && candidate !== null && kind !== null) {
      return {
        decision: "ROUTE",
        skillId: "onboarding_requirement_tracking_pack",
        workflowId: "synthetic_requirement_completion_update",
        businessInput: { candidateDisplayName: candidate, requirementKind: kind },
        missingConditions: []
      };
    }
    return {
      decision: "CLARIFY",
      skillId: null,
      workflowId: null,
      businessInput: {},
      missingConditions
    };
  }

  const conditions = {
    syntheticContext: matchesAny(text, syntheticContextPatterns),
    candidateDisplayName: candidate !== null,
    offerAccepted: matchesAny(text, acceptedOfferPatterns),
    createCaseIntent: matchesAny(text, createVerbPatterns) && matchesAny(text, onboardingCasePatterns)
  };
  const missingConditions = (Object.entries(conditions) as Array<
    [keyof typeof conditions, boolean]
  >).filter(([, satisfied]) => !satisfied).map(([name]) => name);

  if (missingConditions.length === 0 && candidate !== null) {
    return {
      decision: "ROUTE",
      skillId: "onboarding_case_intake_pack",
      workflowId: "synthetic_case_create_from_accepted_offer",
      businessInput: {
        candidateDisplayName: candidate,
        offerAccepted: true,
        plannedStartAt: null
      },
      missingConditions: []
    };
  }

  return {
    decision: "CLARIFY",
    skillId: null,
    workflowId: null,
    businessInput: {},
    missingConditions
  };
}
