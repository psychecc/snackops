import { readJsonFile, writeJsonFile } from "@/lib/store";

export type PlannerConfig = {
  version: string;
  prompt: string;
  mandatoryCapabilities: string[];
  updatedAt: string;
};

const PLANNER_CONFIG_FILE = "planner-config.json";

const defaultPlannerConfig: PlannerConfig = {
  version: "planner-1.0.0",
  prompt:
    "你是 SnackOps Planner。只能选择当前启用的 Skill 和 Tool；价格场景必须选择价格 Tool；订单/物流场景必须选择订单与物流 Tool；风险场景必须包含 risk-check。",
  mandatoryCapabilities: ["risk-check"],
  updatedAt: new Date().toISOString(),
};

export async function getPlannerConfig() {
  return readJsonFile<PlannerConfig>(PLANNER_CONFIG_FILE, defaultPlannerConfig);
}

export async function savePlannerConfig(config: Partial<PlannerConfig>) {
  const current = await getPlannerConfig();
  const next: PlannerConfig = {
    ...current,
    ...config,
    mandatoryCapabilities: Array.isArray(config.mandatoryCapabilities)
      ? config.mandatoryCapabilities
      : current.mandatoryCapabilities,
    updatedAt: new Date().toISOString(),
  };

  await writeJsonFile(PLANNER_CONFIG_FILE, next);
  return next;
}
