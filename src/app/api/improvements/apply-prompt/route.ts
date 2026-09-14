import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { applyPromptImprovement } from "@/lib/ops-store";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    const result = await applyPromptImprovement(body);
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return jsonError(error, 400);
  }
}
