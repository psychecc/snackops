import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { createPlan, detectScenario } from "@/lib/planner";
import { getPlannerConfig } from "@/lib/planner-config";
import { validatePlan } from "@/lib/plan-validator";
import { listEnabledSkills } from "@/lib/skill-registry";
import { listEnabledTools } from "@/lib/tool-registry";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    const userInputCandidates = [body.userInput, body.question].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    const userInput = userInputCandidates[0] ?? "";
    const selectedSkillIds = Array.isArray(body.selectedSkillIds) ? new Set(body.selectedSkillIds) : null;
    const selectedToolIds = Array.isArray(body.selectedToolIds) ? new Set(body.selectedToolIds) : null;
    const config = await getPlannerConfig();
    const [enabledSkills, enabledTools] = await Promise.all([listEnabledSkills(), listEnabledTools()]);
    const availableSkills = selectedSkillIds
      ? enabledSkills.filter((skill) => selectedSkillIds.has(skill.id))
      : enabledSkills;
    const availableTools = selectedToolIds
      ? enabledTools.filter((tool) => selectedToolIds.has(tool.id))
      : enabledTools;
    const planner = await createPlan({
      userInput,
      availableSkills,
      availableTools,
      mandatoryCapabilities: Array.isArray(body.mandatoryCapabilities)
        ? body.mandatoryCapabilities
        : config.mandatoryCapabilities,
    });

    if (!planner.plan) {
      return jsonOk({ ok: false, plan: null, validation: null, error: planner.error });
    }

    const validation = validatePlan({
      plan: planner.plan,
      enabledSkills: availableSkills,
      enabledTools: availableTools,
      flags: detectScenario(userInput),
    });

    return jsonOk({ ok: validation.ok, plan: planner.plan, validation, provider: planner.provider, model: planner.model });
  } catch (error) {
    return jsonError(error, 500);
  }
}
