import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { getPublicLlmConfig, saveStoredLlmConfig } from "@/lib/llm-config";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    if (typeof body.provider !== "string") {
      return jsonError("provider 不能为空", 400);
    }
    await saveStoredLlmConfig({
      provider: body.provider,
      model: typeof body.model === "string" ? body.model : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
    });
    const config = await getPublicLlmConfig();
    return jsonOk({ ok: true, config });
  } catch (error) {
    return jsonError(error, 400);
  }
}
