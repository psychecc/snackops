import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { createAnnotation, listAnnotations } from "@/lib/ops-store";
import type { AnnotationStatus } from "@/lib/ops-types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus === "pending" || rawStatus === "accepted" || rawStatus === "rejected"
        ? (rawStatus as AnnotationStatus)
        : undefined;
    const annotations = await listAnnotations({
      status,
      runId: url.searchParams.get("runId") ?? undefined,
    });
    return jsonOk({ ok: true, annotations });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    const annotation = await createAnnotation(body);
    return jsonOk({ ok: true, annotation });
  } catch (error) {
    return jsonError(error, 400);
  }
}
