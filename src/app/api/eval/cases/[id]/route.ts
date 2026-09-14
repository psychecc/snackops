import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { deleteEvalCase, getEvalCase, updateEvalCase } from "@/lib/eval-store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const evalCase = await getEvalCase(decodeURIComponent(id));

    if (!evalCase) {
      return jsonError(`EvalCase not found: ${id}`, 404);
    }

    return jsonOk({ ok: true, case: evalCase });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readRequestJson(request);
    const evalCase = await updateEvalCase(decodeURIComponent(id), body);
    return jsonOk({ ok: true, case: evalCase });
  } catch (error) {
    return jsonError(error, 400);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = await deleteEvalCase(decodeURIComponent(id));
    return jsonOk({ ok: true, deleted });
  } catch (error) {
    return jsonError(error, 400);
  }
}
