import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { updateRunRecord } from "@/lib/run-store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readRequestJson(request);
    const reason = typeof body.reason === "string" ? body.reason : "人工接管";
    const run = await updateRunRecord(decodeURIComponent(id), {
      status: "handoff",
      error: reason,
    });

    if (!run) {
      return jsonError(`Run not found: ${id}`, 404);
    }

    return jsonOk({ ok: true, run });
  } catch (error) {
    return jsonError(error, 500);
  }
}
