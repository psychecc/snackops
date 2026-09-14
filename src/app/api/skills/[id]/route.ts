import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { getSkill, updateSkill } from "@/lib/skill-registry";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const skill = await getSkill(decodeURIComponent(id));

    if (!skill) {
      return jsonError(`Skill not found: ${id}`, 404);
    }

    return jsonOk({ ok: true, skill });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readRequestJson(request);
    const skill = await updateSkill(decodeURIComponent(id), body);
    return jsonOk({ ok: true, skill });
  } catch (error) {
    return jsonError(error, 400);
  }
}
