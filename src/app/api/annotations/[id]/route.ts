import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { listAnnotations, updateAnnotation } from "@/lib/ops-store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const annotations = await listAnnotations();
    const annotation = annotations.find((item) => item.id === decodeURIComponent(id));

    if (!annotation) {
      return jsonError(`Annotation not found: ${id}`, 404);
    }

    return jsonOk({ ok: true, annotation });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readRequestJson(request);
    const annotation = await updateAnnotation(decodeURIComponent(id), body);
    return jsonOk({ ok: true, annotation });
  } catch (error) {
    return jsonError(error, 400);
  }
}
