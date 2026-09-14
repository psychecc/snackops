import type { AgentPlan, Skill, Tool } from "@/lib/types";
import type { ScenarioFlags } from "@/lib/planner";

export type PlanValidationResult = {
  ok: boolean;
  blocked: boolean;
  errors: Array<{ code: string; message: string; severity: "error" | "warning" }>;
};

export function validatePlan({
  plan,
  enabledSkills,
  enabledTools,
  flags,
}: {
  plan: AgentPlan;
  enabledSkills: Skill[];
  enabledTools: Tool[];
  flags: ScenarioFlags;
}): PlanValidationResult {
  const errors: PlanValidationResult["errors"] = [];
  const skillIds = new Set(enabledSkills.map((skill) => skill.id));
  const toolIds = new Set(enabledTools.map((tool) => tool.id));
  const selected = new Set([...plan.selectedSkills, ...plan.selectedTools]);

  for (const id of plan.selectedSkills) {
    if (!skillIds.has(id)) {
      errors.push({ code: "SKILL_NOT_ENABLED", message: `Skill 未启用或不存在：${id}`, severity: "error" });
    }
  }

  for (const id of plan.selectedTools) {
    if (!toolIds.has(id)) {
      errors.push({ code: "TOOL_NOT_ENABLED", message: `Tool 未启用或不存在：${id}`, severity: "error" });
    }
  }

  for (const id of plan.mandatoryCapabilities) {
    if (!selected.has(id)) {
      errors.push({ code: "MANDATORY_MISSING", message: `遗漏强制能力：${id}`, severity: "error" });
    }
  }

  if (flags.price && !plan.selectedTools.includes("calculate_price")) {
    errors.push({ code: "PRICE_TOOL_MISSING", message: "价格场景缺少 calculate_price Tool", severity: "error" });
  }

  if ((flags.order || flags.logistics) && !plan.selectedTools.includes("query_orders")) {
    errors.push({ code: "ORDER_TOOL_MISSING", message: "订单/物流场景缺少 query_orders Tool", severity: "error" });
  }

  if (flags.logistics && !plan.selectedTools.includes("query_logistics")) {
    errors.push({ code: "LOGISTICS_TOOL_MISSING", message: "物流场景缺少 query_logistics Tool", severity: "error" });
  }

  if (flags.risk && !plan.selectedSkills.includes("risk-check")) {
    errors.push({ code: "RISK_CHECK_MISSING", message: "风险场景缺少 risk-check，必须阻断或降级", severity: "error" });
  }

  return {
    ok: errors.every((error) => error.severity !== "error"),
    blocked: errors.some((error) => error.severity === "error"),
    errors,
  };
}
