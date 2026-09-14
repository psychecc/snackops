import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { generatePromptImprovement } from "@/lib/ops-store";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    const improvement = await generatePromptImprovement(body);
    return jsonOk({ ok: true, improvement });
  } catch (error) {
    return jsonError(error, 400);
  }
}
