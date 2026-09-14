import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { getTool, updateToolEnabled } from "@/lib/tool-registry";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const tool = await getTool(decodeURIComponent(id));

    if (!tool) {
      return jsonError(`Tool not found: ${id}`, 404);
    }

    return jsonOk({ ok: true, tool });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readRequestJson(request);

    if (typeof body.enabled !== "boolean") {
      return jsonError("enabled must be boolean", 400);
    }

    const tool = await updateToolEnabled(decodeURIComponent(id), body.enabled);

    if (!tool) {
      return jsonError(`Tool not found: ${id}`, 404);
    }

    return jsonOk({ ok: true, tool });
  } catch (error) {
    return jsonError(error, 400);
  }
}
