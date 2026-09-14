import { jsonError, jsonOk } from "@/lib/api-response";
import { getEvalOverview, listEvalCases } from "@/lib/eval-store";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const enabledOnly = url.searchParams.get("enabledOnly") === "true";
    const overview = await getEvalOverview();
    const cases = await listEvalCases({
      enabledOnly,
      category: url.searchParams.get("category") || undefined,
      difficulty: url.searchParams.get("difficulty") || undefined,
      riskLevel: url.searchParams.get("riskLevel") || undefined,
      evalDimension: url.searchParams.get("evalDimension") || undefined,
    });

    return jsonOk({ ok: true, ...overview, cases });
  } catch (error) {
    return jsonError(error, 500);
  }
}
