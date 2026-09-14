import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { createSkillVersionSnapshot, getSkill, listSkillVersions } from "@/lib/skill-registry";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const versions = await listSkillVersions(decodeURIComponent(id));
    return jsonOk({ ok: true, versions });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readRequestJson(request);
    const skill = await getSkill(decodeURIComponent(id));

    if (!skill) {
      return jsonError(`Skill not found: ${id}`, 404);
    }

    const version = await createSkillVersionSnapshot(
      skill,
      typeof body.changeNote === "string" ? body.changeNote : "手动保存版本",
    );

    return jsonOk({ ok: true, version });
  } catch (error) {
    return jsonError(error, 400);
  }
}
