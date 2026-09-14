import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { scoreEvalRun } from "@/lib/eval-store";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);

    if (typeof body.caseId !== "string") {
      return jsonError("caseId 不能为空", 400);
    }

    const result = await scoreEvalRun(body.caseId, body.run);
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return jsonError(error, 400);
  }
}
