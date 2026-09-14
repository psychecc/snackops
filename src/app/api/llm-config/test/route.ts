import { jsonOk } from "@/lib/api-response";
import { testLlmConfig } from "@/lib/llm-config";

export async function POST() {
  const result = await testLlmConfig();
  return jsonOk({ ok: result.ok, result }, { status: result.ok ? 200 : 400 });
}
