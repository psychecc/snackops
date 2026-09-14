import { jsonOk, readRequestJson } from "@/lib/api-response";
import { runToolTest } from "@/lib/tool-registry";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await readRequestJson(request);
  const result = await runToolTest(decodeURIComponent(id), body);
  return jsonOk(result, { status: result.ok ? 200 : 400 });
}
