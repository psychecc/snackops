import { jsonError, jsonOk } from "@/lib/api-response";
import { getRunRecord } from "@/lib/run-store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const run = await getRunRecord(decodeURIComponent(id));

    if (!run) {
      return jsonError(`Run not found: ${id}`, 404);
    }

    return jsonOk({ ok: true, run });
  } catch (error) {
    return jsonError(error, 500);
  }
}
