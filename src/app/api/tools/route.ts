import { jsonError, jsonOk } from "@/lib/api-response";
import { listTools } from "@/lib/tool-registry";

export async function GET() {
  try {
    const tools = await listTools();
    return jsonOk({ ok: true, tools });
  } catch (error) {
    return jsonError(error, 500);
  }
}
