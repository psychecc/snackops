import { randomUUID } from "node:crypto";
import { callLlm, resolveLlmConfig } from "@/lib/llm-provider";
import { createPlan, detectScenario } from "@/lib/planner";
import { getPlannerConfig } from "@/lib/planner-config";
import { validatePlan } from "@/lib/plan-validator";
import { createRunId, saveRunRecord } from "@/lib/run-store";
import { listEnabledSkills } from "@/lib/skill-registry";
import { listEnabledTools, runToolTest } from "@/lib/tool-registry";
import type { AgentPlan, ExecutionStep, RiskResult, RunRecord, Skill, Tool } from "@/lib/types";

export type AgentRunInput = {
  userInput: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  source?: string;
  conversationId?: string;
  mandatoryCapabilities?: string[];
  forceToolError?: string;
};

export type AgentRunOutput = {
  run: RunRecord;
  events: Array<Record<string, unknown>>;
};

type ExecutionContext = {
  question: string;
  extracted?: Record<string, unknown>;
  products?: Array<Record<string, unknown>>;
  activities?: Array<Record<string, unknown>>;
  coupons?: Array<Record<string, unknown>>;
  price?: Record<string, unknown>;
  orders?: Array<Record<string, unknown>>;
  logistics?: Record<string, unknown>;
  selectedProduct?: Record<string, unknown>;
  recommendationReason?: Record<string, unknown>;
  draftReply?: string;
  riskResult?: RiskResult;
};

export async function runAgent(input: AgentRunInput): Promise<AgentRunOutput> {
  const started = Date.now();
  const createdAt = new Date().toISOString();
  const runId = createRunId();
  const source = input.source ?? "web";
  const conversationId = input.conversationId ?? `conv_${randomUUID().slice(0, 8)}`;
  const events: Array<Record<string, unknown>> = [];
  const steps: ExecutionStep[] = [];
  const providerConfig = await resolveLlmConfig();
  const plannerConfig = await getPlannerConfig();
  const [skills, tools] = await Promise.all([listEnabledSkills(), listEnabledTools()]);
  const flags = detectScenario(input.userInput);

  const plannerResult = await createPlan({
    userInput: input.userInput,
    conversationHistory: input.conversationHistory,
    availableSkills: skills,
    availableTools: tools,
    mandatoryCapabilities: input.mandatoryCapabilities ?? plannerConfig.mandatoryCapabilities,
  });

  if (!plannerResult.plan) {
    const run = await persistRun({
      runId,
      input,
      source,
      conversationId,
      createdAt,
      started,
      plan: null,
      steps,
      status: "failed",
      finalReply: "",
      riskResult: null,
      error: plannerResult.error?.message ?? "Planner 失败",
      provider: plannerResult.provider,
      model: plannerResult.model,
      skills,
      tools,
    });
    events.push({ type: "error", error: run.error }, { type: "done", runId });
    return { run, events };
  }

  events.push({ type: "plan", plan: plannerResult.plan });

  const validation = validatePlan({
    plan: plannerResult.plan,
    enabledSkills: skills,
    enabledTools: tools,
    flags,
  });

  steps.push({
    stepId: "validator",
    type: "validator",
    capabilityId: "plan-validator",
    capabilityName: "Plan Validator",
    input: plannerResult.plan,
    output: validation,
    durationMs: 0,
    status: validation.ok ? "success" : "blocked",
    error: validation.ok ? null : validation.errors.map((error) => error.message).join("；"),
  });
  events.push({ type: "step", step: steps.at(-1) });

  if (validation.blocked) {
    const run = await persistRun({
      runId,
      input,
      source,
      conversationId,
      createdAt,
      started,
      plan: plannerResult.plan,
      steps,
      status: "blocked",
      finalReply: "当前启用能力不足，无法安全执行。建议启用缺失能力或转人工处理。",
      riskResult: null,
      error: validation.errors.map((error) => error.message).join("；"),
      provider: plannerResult.provider,
      model: plannerResult.model,
      skills,
      tools,
    });
    events.push({ type: "final", finalReply: run.finalReply }, { type: "done", runId });
    return { run, events };
  }

  const context: ExecutionContext = { question: input.userInput };
  let status: RunRecord["status"] = "success";
  let error: string | null = null;

  for (const planStep of plannerResult.plan.steps) {
    const startedStep = Date.now();
    const capabilityName = getCapabilityName(planStep.type, planStep.capabilityId, skills, tools);
    const stepInput = buildStepInput(planStep.capabilityId, context, input.userInput);
    let shouldStop = false;

    try {
      if (planStep.type === "tool") {
        if (input.forceToolError === planStep.capabilityId) {
          throw new Error(`人为触发 Tool 错误：${planStep.capabilityId}`);
        }

        const result = await runToolTest(planStep.capabilityId, stepInput);
        if (!result.ok) {
          throw new Error(result.error ?? `Tool failed: ${planStep.capabilityId}`);
        }
        applyToolOutput(planStep.capabilityId, result.output, context);
        pushStep("success", result.output, null);
      } else {
        const output = await runSkillWithTimeout(planStep.capabilityId, stepInput, 8000);
        applySkillOutput(planStep.capabilityId, output, context);
        pushStep("success", output, null);
      }
    } catch (stepError) {
      status = "failed";
      error = stepError instanceof Error ? stepError.message : String(stepError);
      pushStep("error", undefined, error);
      shouldStop = true;
    }

    events.push({ type: "step", step: steps.at(-1) });

    if (shouldStop) {
      break;
    }

    function pushStep(stepStatus: ExecutionStep["status"], output: unknown, stepError: string | null) {
      steps.push({
        stepId: planStep.stepId,
        type: planStep.capabilityId === "risk-check" ? "risk" : planStep.type,
        capabilityId: planStep.capabilityId,
        capabilityName,
        input: stepInput,
        output,
        durationMs: Date.now() - startedStep,
        status: stepStatus,
        error: stepError,
      });
    }
  }

  const riskResult = context.riskResult ?? null;
  const finalReply = riskResult?.safeReply || context.draftReply || "";

  if (status === "success" && riskResult && !riskResult.passed) {
    status = "blocked";
    error = riskResult.blockedReason;
  }

  const run = await persistRun({
    runId,
    input,
    source,
    conversationId,
    createdAt,
    started,
    plan: plannerResult.plan,
    steps,
    status,
    finalReply,
    riskResult,
    error,
    provider: providerConfig.provider,
    model: providerConfig.model,
    skills,
    tools,
  });

  events.push(
    { type: status === "failed" ? "error" : "final", finalReply: run.finalReply, error: run.error },
    { type: "done", runId },
  );

  return { run, events };
}

async function persistRun({
  runId,
  input,
  source,
  conversationId,
  createdAt,
  started,
  plan,
  steps,
  status,
  finalReply,
  riskResult,
  error,
  provider,
  model,
  skills,
  tools,
}: {
  runId: string;
  input: AgentRunInput;
  source: string;
  conversationId: string;
  createdAt: string;
  started: number;
  plan: AgentPlan | null;
  steps: ExecutionStep[];
  status: RunRecord["status"];
  finalReply: string;
  riskResult: RiskResult | null;
  error: string | null;
  provider: string;
  model: string;
  skills: Skill[];
  tools: Tool[];
}) {
  const run: RunRecord = {
    id: runId,
    question: input.userInput,
    source,
    conversationId,
    createdAt,
    status,
    finalReply,
    plan,
    steps,
    riskResult,
    durationMs: Date.now() - started,
    error,
    provider,
    model,
    skillVersions: Object.fromEntries(skills.map((skill) => [skill.id, skill.version])),
    toolVersions: Object.fromEntries(tools.map((tool) => [tool.id, "1.0.0"])),
  };

  return saveRunRecord(run);
}

async function runSkillWithTimeout(skillId: string, input: unknown, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout>;

  try {
    return await Promise.race([
      runSkill(skillId, input, timeoutMs),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Skill 超时：${skillId}`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout!);
  }
}

async function runSkill(skillId: string, input: unknown, timeoutMs: number) {
  const llm = await callLlm({
    task: skillId,
    systemPrompt: `执行 SnackOps Skill：${skillId}`,
    userPayload: input,
    expectJson: true,
    timeoutMs,
  });

  if (!llm.ok) {
    throw new Error(llm.error?.message ?? `LLM 调用失败：${skillId}`);
  }

  return buildSkillOutput(skillId, input);
}

function buildStepInput(capabilityId: string, context: ExecutionContext, question: string) {
  const orderNo = question.match(/SO\d{12}/)?.[0];
  const quantity = /2|两|二/.test(question) ? 2 : 1;
  const userId = /新客/.test(question) ? "u001" : undefined;

  if (capabilityId === "query_products") {
    return {
      query: extractProductQuery(question),
      limit: 5,
    };
  }

  if (capabilityId === "query_activities") {
    return { productIds: context.products?.map((product) => String(product.id)) ?? [] };
  }

  if (capabilityId === "query_coupons") {
    return {
      userId,
      productIds: context.products?.map((product) => String(product.id)) ?? [],
      subtotal: Number(context.price?.subtotal ?? 89),
    };
  }

  if (capabilityId === "calculate_price") {
    return {
      productId: String(context.selectedProduct?.id ?? context.products?.[0]?.id ?? "p001"),
      quantity,
      userId,
    };
  }

  if (capabilityId === "query_orders") {
    return orderNo ? { orderNo } : { userId: "u002" };
  }

  if (capabilityId === "query_logistics") {
    return orderNo ? { orderNo } : { region: "华东" };
  }

  return {
    question,
    context,
  };
}

function applyToolOutput(capabilityId: string, output: unknown, context: ExecutionContext) {
  const data = output as Record<string, unknown>;
  if (capabilityId === "query_products") context.products = data.products as Array<Record<string, unknown>>;
  if (capabilityId === "query_activities") context.activities = data.activities as Array<Record<string, unknown>>;
  if (capabilityId === "query_coupons") context.coupons = data.coupons as Array<Record<string, unknown>>;
  if (capabilityId === "calculate_price") context.price = data;
  if (capabilityId === "query_orders") context.orders = data.orders as Array<Record<string, unknown>>;
  if (capabilityId === "query_logistics") context.logistics = data;
}

function applySkillOutput(capabilityId: string, output: unknown, context: ExecutionContext) {
  const data = output as Record<string, unknown>;
  if (capabilityId === "need-extraction") context.extracted = data;
  if (capabilityId === "recommendation-decision") context.selectedProduct = data.selectedProduct as Record<string, unknown>;
  if (capabilityId === "recommendation-reason") context.recommendationReason = data;
  if (capabilityId === "response-generator") context.draftReply = String(data.reply ?? "");
  if (capabilityId === "risk-check") context.riskResult = data as RiskResult;
}

function buildSkillOutput(skillId: string, input: unknown) {
  const payload = input as { question?: string; context?: ExecutionContext };
  const question = payload.question ?? "";
  const context = payload.context ?? { question };

  if (skillId === "need-extraction") {
    return {
      intent: detectScenario(question),
      keywords: extractProductQuery(question) ? [extractProductQuery(question)] : [],
      needRiskCheck: true,
    };
  }

  if (skillId === "recommendation-decision") {
    const selectedProduct = context.products?.[0] ?? null;
    return {
      selectedProduct,
      selectedProductIds: selectedProduct ? [selectedProduct.id] : [],
      decisionSummary: selectedProduct ? "按匹配度、库存和价格选择首个候选商品。" : "没有可推荐商品。",
    };
  }

  if (skillId === "recommendation-reason") {
    return {
      reason: context.selectedProduct
        ? `${context.selectedProduct.name} 与用户需求匹配，库存和规格可用。`
        : "缺少候选商品，需要澄清需求。",
      priceFact: context.price ?? null,
    };
  }

  if (skillId === "after-sales-classification") {
    return {
      afterSalesType: /破损/.test(question) ? "破损" : /缺件/.test(question) ? "缺件" : "售后咨询",
      shouldHandoff: true,
    };
  }

  if (skillId === "human-handoff-decision") {
    return {
      shouldHandoff: /中奖|转账|验证码|银行卡|保证金|投诉|退款/.test(question),
      priority: /中奖|转账|验证码|银行卡|保证金/.test(question) ? "critical" : "medium",
      reason: "存在资金安全、投诉或售后风险信号。",
    };
  }

  if (skillId === "response-generator") {
    return { reply: buildDraftReply(question, context) };
  }

  if (skillId === "risk-check") {
    return buildRiskResult(question, context.draftReply ?? "");
  }

  return {
    summary: `${skillId} 已执行。`,
  };
}

function buildDraftReply(question: string, context: ExecutionContext) {
  if (/中奖|转账|验证码|银行卡|保证金/.test(question)) {
    return "这个情况请先不要转账，也不要提供验证码、银行卡等敏感信息；平台不会要求私下支付保证金或通过非官方链接兑奖。建议通过官方客服入口核验，我也可以为你转人工继续处理。";
  }

  if (context.orders?.length || context.logistics?.order) {
    const order = (context.orders?.[0] ?? context.logistics?.order ?? {}) as Record<string, unknown>;
    return `查到订单 ${order?.orderNo ?? "对应订单"} 当前物流状态为 ${order?.logisticsStatus ?? "以订单页为准"}，承运商 ${order?.carrier ?? "以物流页为准"}。如有异常可以继续转人工核实。`;
  }

  const product = context.selectedProduct ?? context.products?.[0];
  if (product) {
    const price = context.price;
    const priceText = price
      ? `按当前工具计算，${price.productName} ${price.quantity} 件最终价 ${price.finalPrice} 元，已节省 ${price.savedAmount} 元。`
      : `这款 ${product.name} 比较匹配。`;
    return `${priceText} 口味和场景上也比较贴合你的需求；如有儿童、孕妇或过敏人群食用，建议先看配料表和过敏原。`;
  }

  return "我需要再确认一下口味、预算和是否有过敏/特殊人群要求，再给你更稳妥的推荐。";
}

function buildRiskResult(question: string, reply: string): RiskResult {
  if (/中奖|转账|验证码|银行卡|保证金/.test(question)) {
    return {
      passed: true,
      riskLevel: "high",
      issues: ["疑似中奖诈骗或资金安全风险，已使用安全提醒话术。"],
      safeReply: reply,
      blockedReason: null,
    };
  }

  if (/保证不胖|一定退款|肯定退款|全网最低|治疗/.test(reply)) {
    return {
      passed: false,
      riskLevel: "high",
      issues: ["回复包含绝对化承诺或超范围售后承诺。"],
      safeReply: "这类问题需要以页面规则和人工核实为准，我可以帮你转人工继续处理。",
      blockedReason: "危险回复已阻断",
    };
  }

  return {
    passed: true,
    riskLevel: /儿童|孕妇|过敏|投诉|退款/.test(question) ? "medium" : "low",
    issues: [],
    safeReply: reply,
    blockedReason: null,
  };
}

function extractProductQuery(question: string) {
  if (/酸甜|芒果|果干/.test(question)) return "酸甜";
  if (/坚果|健康|办公室/.test(question)) return "坚果";
  if (/麻辣|牛肉/.test(question)) return "麻辣";
  if (/海苔|儿童/.test(question)) return "海苔";
  if (/薯片|追剧/.test(question)) return "薯片";
  if (/巧克力|低甜|控糖/.test(question)) return "低甜";
  return "";
}

function getCapabilityName(type: "skill" | "tool", id: string, skills: Skill[], tools: Tool[]) {
  if (type === "skill") {
    return skills.find((skill) => skill.id === id)?.name ?? id;
  }

  return tools.find((tool) => tool.id === id)?.name ?? id;
}
