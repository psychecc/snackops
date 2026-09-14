import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { createRating, listRatings } from "@/lib/ops-store";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const score = url.searchParams.get("score");
    const ratings = await listRatings({
      score: score ? Number(score) : undefined,
      problemType: url.searchParams.get("problemType") ?? undefined,
      since: url.searchParams.get("since") ?? undefined,
    });
    return jsonOk({ ok: true, ratings });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    const rating = await createRating(body);
    return jsonOk({ ok: true, rating });
  } catch (error) {
    return jsonError(error, 400);
  }
}
