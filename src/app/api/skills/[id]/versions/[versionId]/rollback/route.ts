import { jsonError, jsonOk } from "@/lib/api-response";
import { rollbackSkillPrompt } from "@/lib/ops-store";

type RouteContext = {
  params: Promise<{
    id: string;
    versionId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id, versionId } = await context.params;
    const skill = await rollbackSkillPrompt(decodeURIComponent(id), decodeURIComponent(versionId));
    return jsonOk({ ok: true, skill });
  } catch (error) {
    return jsonError(error, 400);
  }
}
