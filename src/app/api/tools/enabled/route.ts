import { jsonError, jsonOk } from "@/lib/api-response";
import { listEnabledTools } from "@/lib/tool-registry";

export async function GET() {
  try {
    const tools = await listEnabledTools();
    return jsonOk({ ok: true, tools });
  } catch (error) {
    return jsonError(error, 500);
  }
}
