import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { createEvalCase } from "@/lib/eval-store";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    const evalCase = await createEvalCase(body);
    return jsonOk({ ok: true, case: evalCase });
  } catch (error) {
    return jsonError(error, 400);
  }
}
