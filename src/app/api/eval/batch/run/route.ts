import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { createEvalBatchRun, EvalBatchRequestError } from "@/lib/eval-store";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    const batch = await createEvalBatchRun(body);
    return jsonOk({ ok: true, batchId: batch.id, batch });
  } catch (error) {
    const status = error instanceof EvalBatchRequestError ? error.status : 400;
    return jsonError(error, status);
  }
}
