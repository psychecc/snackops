import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { createAnnotation } from "@/lib/ops-store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readRequestJson(request);
    const annotation = await createAnnotation({ ...body, runId: decodeURIComponent(id) });

    return jsonOk({ ok: true, annotation });
  } catch (error) {
    return jsonError(error, 500);
  }
}
