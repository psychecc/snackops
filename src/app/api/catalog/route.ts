import { jsonError, jsonOk } from "@/lib/api-response";
import { getCatalogSummaries } from "@/lib/catalog";

export async function GET() {
  try {
    const catalog = await getCatalogSummaries();
    return jsonOk({ ok: true, catalog });
  } catch (error) {
    return jsonError(error, 500);
  }
}
