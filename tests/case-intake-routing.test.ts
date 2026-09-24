import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateCaseIntakeRouting } from "../src/skills/case-intake-routing-contract.js";
import { parseStep2WorkflowInput } from "../src/skills/runtime-inputs.js";

describe("Mark Turn A natural-language routing contract", () => {
  it("routes the observed Mark request to Synthetic Case Create", () => {
    expect(evaluateCaseIntakeRouting(
      "这是合成测试数据：刚给 Mark 发了一个 Offer，他已经接受。请为 Mark 创建入职案例。"
    )).toEqual({
      decision: "ROUTE",
      skillId: "onboarding_case_intake_pack",
      workflowId: "synthetic_case_create_from_accepted_offer",
      businessInput: { candidateDisplayName: "Mark", offerAccepted: true, plannedStartAt: null },
      missingConditions: []
    });
  });

  it("routes a Lisa accepted-Offer synonym to Synthetic Case Create", () => {
    expect(evaluateCaseIntakeRouting(
      "合成测试：Lisa 已接受 Offer，帮我建立她的入职 Case。"
    )).toMatchObject({
      decision: "ROUTE",
      workflowId: "synthetic_case_create_from_accepted_offer",
      businessInput: { candidateDisplayName: "Lisa", offerAccepted: true, plannedStartAt: null }
    });
  });

  it("routes Chinese accepted-employment wording without inventing a start date", () => {
    expect(evaluateCaseIntakeRouting(
      "测试数据，王小明已经接受录用，请创建入职案例，入职日期暂时还没定。"
    )).toMatchObject({
      decision: "ROUTE",
      workflowId: "synthetic_case_create_from_accepted_offer",
      businessInput: { candidateDisplayName: "王小明", offerAccepted: true, plannedStartAt: null }
    });
  });

  it("routes an explicit Handoff completeness check to Intake Review", () => {
    expect(evaluateCaseIntakeRouting("请检查 handoff-001 的入职交接是否完整。")).toEqual({
      decision: "ROUTE",
      skillId: "onboarding_case_intake_pack",
      workflowId: "case_intake_candidate",
      businessInput: { handoffRef: "handoff-001" },
      missingConditions: []
    });
  });

  it("routes an existing Offer Handoff draft request to Intake Review", () => {
    expect(evaluateCaseIntakeRouting("基于现有 Offer Handoff 帮我生成入职材料草稿。")).toEqual({
      decision: "ROUTE",
      skillId: "onboarding_case_intake_pack",
      workflowId: "case_intake_candidate",
      businessInput: {},
      missingConditions: ["handoffRef"]
    });
  });

  it("clarifies an ambiguous Offer request rather than assuming accepted and create", () => {
    expect(evaluateCaseIntakeRouting("Mark 的 Offer 处理一下。")).toMatchObject({
      decision: "CLARIFY",
      skillId: null,
      workflowId: null,
      missingConditions: expect.arrayContaining(["syntheticContext", "offerAccepted", "createCaseIntent"])
    });
  });

  it("supports English accepted/create semantics through the same four-condition contract", () => {
    expect(evaluateCaseIntakeRouting(
      "Synthetic test data: Lisa's Offer is accepted. Create an onboarding case for Lisa."
    )).toMatchObject({
      decision: "ROUTE",
      workflowId: "synthetic_case_create_from_accepted_offer",
      businessInput: { candidateDisplayName: "Lisa", offerAccepted: true }
    });
  });
});

describe("Synthetic Case Create missing-field contract", () => {
  it("accepts missing plannedStartAt, handoffRef, and expectedSourceVersion", () => {
    expect(parseStep2WorkflowInput("synthetic_case_create_from_accepted_offer", {
      candidateDisplayName: "Mark",
      offerAccepted: true
    })).toEqual({ candidateDisplayName: "Mark", offerAccepted: true, language: "zh-CN" });
  });

  it("rejects a missing candidateDisplayName", () => {
    expect(() => parseStep2WorkflowInput("synthetic_case_create_from_accepted_offer", {
      offerAccepted: true
    })).toThrow();
  });

  it("rejects a missing accepted-Offer assertion", () => {
    expect(() => parseStep2WorkflowInput("synthetic_case_create_from_accepted_offer", {
      candidateDisplayName: "Mark"
    })).toThrow();
  });

  it("rejects a false accepted-Offer assertion", () => {
    expect(() => parseStep2WorkflowInput("synthetic_case_create_from_accepted_offer", {
      candidateDisplayName: "Mark",
      offerAccepted: false
    })).toThrow();
  });

  it("does not route an otherwise complete request without explicit synthetic context", () => {
    expect(evaluateCaseIntakeRouting(
      "Mark 已接受 Offer，请为 Mark 创建入职案例。"
    )).toMatchObject({
      decision: "CLARIFY",
      missingConditions: expect.arrayContaining(["syntheticContext"])
    });
  });

  it("does not route when the candidate cannot be resolved", () => {
    expect(evaluateCaseIntakeRouting(
      "这是合成测试，候选人已接受 Offer，请创建入职案例。"
    )).toMatchObject({
      decision: "CLARIFY",
      missingConditions: expect.arrayContaining(["candidateDisplayName"])
    });
  });
});

describe("OpenClaw routing instruction alignment", () => {
  it("packages the mutually exclusive Synthetic Create and Intake Review contract", () => {
    const navigation = readFileSync(resolve(
      "workspace-template/skills/onboarding_task_navigation_pack/SKILL.md"), "utf8");
    const intake = readFileSync(resolve(
      "workspace-template/skills/onboarding_case_intake_pack/SKILL.md"), "utf8");
    for (const content of [navigation, intake]) {
      expect(content).toContain("synthetic_case_create_from_accepted_offer");
      expect(content).toContain("case_intake_candidate");
      expect(content).toMatch(/plannedStartAt.*(?:可选|Unknown|`null`)/s);
      expect(content).toMatch(/不得.*(?:推断|擅自创建)/s);
    }
  });

  it("keeps Tool descriptions aligned and requires explicit offerAccepted=true", () => {
    const source = readFileSync(resolve("openclaw-test-tool/index.mjs"), "utf8");
    expect(source).toContain("evaluateCaseIntakeRouting");
    expect(source).toContain("offerAccepted: Type.Literal(true)");
    expect(source).not.toContain("offerAccepted: Type.Optional(Type.Literal(true))");
    expect(source).toContain("plannedStartAt optional");
    expect(source).toContain("use case_intake_candidate only to review an existing Handoff");
  });
});
