import { jsonError, jsonOk } from "@/lib/api-response";
import { getSkillVersion } from "@/lib/skill-registry";

type RouteContext = {
  params: Promise<{
    id: string;
    versionId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id, versionId } = await context.params;
    const version = await getSkillVersion(decodeURIComponent(id), decodeURIComponent(versionId));

    if (!version) {
      return jsonError(`Version not found: ${versionId}`, 404);
    }

    return jsonOk({ ok: true, version });
  } catch (error) {
    return jsonError(error, 500);
  }
}
