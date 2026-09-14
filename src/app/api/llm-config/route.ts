import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { getPublicLlmConfig, saveStoredLlmConfig } from "@/lib/llm-config";

export async function GET() {
  try {
    const config = await getPublicLlmConfig();
    return jsonOk({ ok: true, config });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readRequestJson(request);
    await saveStoredLlmConfig({
      provider: typeof body.provider === "string" ? body.provider : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      model: typeof body.model === "string" ? body.model : undefined,
      timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
      jsonMode: typeof body.jsonMode === "boolean" ? body.jsonMode : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    const config = await getPublicLlmConfig();
    return jsonOk({ ok: true, config });
  } catch (error) {
    return jsonError(error, 400);
  }
}
