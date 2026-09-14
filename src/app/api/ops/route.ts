import { jsonError, jsonOk } from "@/lib/api-response";
import { getOpsDashboard } from "@/lib/ops-store";

export async function GET() {
  try {
    const dashboard = await getOpsDashboard();
    return jsonOk({ ok: true, dashboard });
  } catch (error) {
    return jsonError(error, 500);
  }
}
