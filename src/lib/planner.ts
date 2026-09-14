import { callLlm } from "@/lib/llm-provider";
import type { AgentPlan, Skill, Tool } from "@/lib/types";

export type PlannerInput = {
  userInput: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  availableSkills: Skill[];
  availableTools: Tool[];
  mandatoryCapabilities?: string[];
};

export type ScenarioFlags = {
  price: boolean;
  order: boolean;
  logistics: boolean;
  afterSales: boolean;
  risk: boolean;
  recommendation: boolean;
};

export async function createPlan(input: PlannerInput) {
  const llm = await callLlm({
    task: "planner",
    systemPrompt:
      "你是 SnackOps Planner。只能选择当前启用的 Skill/Tool，并输出 JSON Plan。",
    userPayload: input,
    expectJson: true,
  });

  if (!llm.ok) {
    return {
      plan: null,
      provider: llm.provider,
      model: llm.model,
      error: llm.error,
    };
  }

  const flags = detectScenario(input.userInput);
  const plan = buildDeterministicPlan(input, flags, llm.report.notes);

  return {
    plan,
    provider: llm.provider,
    model: llm.model,
    error: null,
  };
}

export function detectScenario(userInput: string): ScenarioFlags {
  const text = userInput.toLowerCase();
  const price = /价格|多少钱|优惠|优惠券|券|满减|预算|便宜|最终价/.test(text);
  const order = /订单|单号|物流|快递|发货|签收|到哪|运输/.test(text);
  const logistics = /物流|快递|发货|签收|到哪|运输/.test(text);
  const afterSales = /售后|退款|退货|换货|破损|缺件|错发|投诉|赔/.test(text);
  const risk = /中奖|转账|验证码|银行卡|保证金|诈骗|保证|不胖|治疗|孕妇|儿童|过敏|投诉|退款/.test(text);
  const shoppingIntent =
    price || /推荐|买|零食|口味|办公室|下午茶|送礼|儿童|孩子|追剧|坚果|芒果|果干|薯片|海苔|巧克力|牛肉干/.test(text);
  return {
    price,
    order,
    logistics,
    afterSales,
    risk,
    recommendation: shoppingIntent && !order && !afterSales,
  };
}

function buildDeterministicPlan(input: PlannerInput, flags: ScenarioFlags, llmNotes: string[]): AgentPlan {
  const mandatory = new Set(input.mandatoryCapabilities ?? ["risk-check"]);
  const skills = new Set<string>();
  const tools = new Set<string>();
  const steps: AgentPlan["steps"] = [];
  const reasoning: string[] = [];

  addSkill("need-extraction", "结构化用户需求");

  if (flags.recommendation || flags.price) {
    addTool("query_products", "查询候选商品");
  }

  if (flags.price) {
    for (const id of ["query_products", "query_activities", "query_coupons", "calculate_price"]) {
      mandatory.add(id);
    }
    addTool("query_activities", "查询活动");
    addTool("query_coupons", "查询优惠券");
    reasoning.push("用户涉及价格/优惠，必须选择价格相关 Tool。");
  }

  if (flags.recommendation || flags.price) {
    addSkill("recommendation-decision", "选择推荐商品");
  }

  if (flags.price) {
    addTool("calculate_price", "计算最终价");
  }

  if (flags.recommendation || flags.price) {
    addSkill("recommendation-reason", "生成推荐理由");
  }

  if (flags.order || flags.logistics) {
    mandatory.add("query_orders");
    mandatory.add("query_logistics");
    addTool("query_orders", "查询订单");
    addTool("query_logistics", "查询物流");
    reasoning.push("用户涉及订单/物流，必须选择订单和物流 Tool。");
  }

  if (flags.afterSales) {
    mandatory.add("query_orders");
    addTool("query_orders", "查询售后关联订单");
    addSkill("after-sales-classification", "识别售后类型");
    reasoning.push("用户涉及售后，需要售后分类能力。");
  }

  if (flags.risk) {
    mandatory.add("risk-check");
    addSkill("human-handoff-decision", "判断是否转人工");
    reasoning.push("用户输入包含风险信号，必须执行风险检查。");
  }

  addSkill("response-generator", "生成客服回复");
  addSkill("risk-check", "最终风险审核");

  return {
    id: `plan_${Date.now()}`,
    selectedSkills: [...skills],
    selectedTools: [...tools],
    reasoning: [...reasoning, ...llmNotes],
    mandatoryCapabilities: [...mandatory],
    riskJudgement: {
      level: flags.risk ? "high" : flags.afterSales ? "medium" : "low",
      reasons: buildRiskReasons(flags),
      needsHandoff: flags.risk && /中奖|转账|验证码|银行卡|保证金|投诉/.test(input.userInput),
    },
    steps,
    fallback: {
      used: true,
      reason: "Planner 使用规则约束计划，确保只选择已注册能力。",
    },
  };

  function addSkill(id: string, purpose: string) {
    if (!skills.has(id)) {
      skills.add(id);
      steps.push({ stepId: `step_${steps.length + 1}`, type: "skill", capabilityId: id, purpose });
    }
  }

  function addTool(id: string, purpose: string) {
    if (!tools.has(id)) {
      tools.add(id);
      steps.push({ stepId: `step_${steps.length + 1}`, type: "tool", capabilityId: id, purpose });
    }
  }
}

function buildRiskReasons(flags: ScenarioFlags) {
  const reasons: string[] = [];
  if (flags.price) reasons.push("涉及价格/优惠");
  if (flags.order) reasons.push("涉及订单");
  if (flags.logistics) reasons.push("涉及物流");
  if (flags.afterSales) reasons.push("涉及售后");
  if (flags.risk) reasons.push("包含高风险词或特殊人群/诈骗风险");
  return reasons;
}
