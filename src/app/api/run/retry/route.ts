import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { runAgent } from "@/lib/executor";
import { getRunRecord } from "@/lib/run-store";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    const runId = typeof body.runId === "string" ? body.runId : "";
    const original = await getRunRecord(runId);

    if (!original) {
      return jsonError(`Run not found: ${runId}`, 404);
    }

    const result = await runAgent({
      userInput: original.question,
      source: "retry",
      conversationId: original.conversationId,
    });

    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return jsonError(error, 500);
  }
}
