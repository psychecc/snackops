import { jsonError, jsonOk } from "@/lib/api-response";
import { diffSkillVersionWithCurrent } from "@/lib/skill-registry";

type RouteContext = {
  params: Promise<{
    id: string;
    versionId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id, versionId } = await context.params;
    const diff = await diffSkillVersionWithCurrent(
      decodeURIComponent(id),
      decodeURIComponent(versionId),
    );

    if (!diff) {
      return jsonError(`Diff not found for version: ${versionId}`, 404);
    }

    return jsonOk({ ok: true, ...diff });
  } catch (error) {
    return jsonError(error, 500);
  }
}
