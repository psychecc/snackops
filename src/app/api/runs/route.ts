import { jsonError, jsonOk } from "@/lib/api-response";
import { listRunRecords } from "@/lib/run-store";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const page = Number(url.searchParams.get("page") ?? 1);
    const result = await listRunRecords(limit, page);
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return jsonError(error, 500);
  }
}
