import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { testSkill } from "@/lib/skill-registry";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readRequestJson(request);
    const result = await testSkill(decodeURIComponent(id), body);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}
