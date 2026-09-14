import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { getPlannerConfig, savePlannerConfig } from "@/lib/planner-config";
import { listEnabledSkills } from "@/lib/skill-registry";
import { listEnabledTools } from "@/lib/tool-registry";

export async function GET() {
  try {
    const [config, skills, tools] = await Promise.all([
      getPlannerConfig(),
      listEnabledSkills(),
      listEnabledTools(),
    ]);
    return jsonOk({ ok: true, config, skills, tools });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readRequestJson(request);
    const config = await savePlannerConfig({
      version: typeof body.version === "string" ? body.version : undefined,
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      mandatoryCapabilities: Array.isArray(body.mandatoryCapabilities)
        ? body.mandatoryCapabilities
        : undefined,
    });
    return jsonOk({ ok: true, config });
  } catch (error) {
    return jsonError(error, 400);
  }
}
