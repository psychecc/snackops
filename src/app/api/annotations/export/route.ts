import { jsonError } from "@/lib/api-response";
import { listAnnotations } from "@/lib/ops-store";

export async function GET() {
  try {
    const annotations = await listAnnotations();
    return new Response(JSON.stringify({ ok: true, exportedAt: new Date().toISOString(), annotations }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="snackops-annotations-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}
