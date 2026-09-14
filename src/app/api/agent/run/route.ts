import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { runAgent } from "@/lib/executor";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    const userInput = typeof body.userInput === "string" ? body.userInput : "";

    if (!userInput.trim()) {
      return jsonError("userInput 不能为空", 400);
    }

    const result = await runAgent({
      userInput,
      conversationHistory: Array.isArray(body.conversationHistory) ? body.conversationHistory : [],
      source: typeof body.source === "string" ? body.source : "web",
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      mandatoryCapabilities: Array.isArray(body.mandatoryCapabilities) ? body.mandatoryCapabilities : undefined,
      forceToolError: typeof body.forceToolError === "string" ? body.forceToolError : undefined,
    });

    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return jsonError(error, 500);
  }
}
