import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { compareEvalBatches, EvalBatchRequestError } from "@/lib/eval-store";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);

    if (typeof body.leftBatchId !== "string" || typeof body.rightBatchId !== "string") {
      return jsonError("leftBatchId 和 rightBatchId 不能为空", 400);
    }

    const comparison = await compareEvalBatches(body.leftBatchId, body.rightBatchId);
    return jsonOk({ ok: true, comparison });
  } catch (error) {
    const status = error instanceof EvalBatchRequestError ? error.status : 400;
    return jsonError(error, status);
  }
}
