import { jsonError, jsonOk } from "@/lib/api-response";
import { EvalBatchRequestError, getEvalBatch } from "@/lib/eval-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const batch = await getEvalBatch(id);

    if (!batch) {
      throw new EvalBatchRequestError(`EvalBatch not found: ${id}`, 404);
    }

    return jsonOk({ ok: true, batch });
  } catch (error) {
    const status = error instanceof EvalBatchRequestError ? error.status : 500;
    return jsonError(error, status);
  }
}
