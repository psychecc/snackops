import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { createAbTest, listAbTests } from "@/lib/ops-store";

export async function GET() {
  try {
    const abTests = await listAbTests();
    return jsonOk({ ok: true, abTests });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    const abTest = await createAbTest(body);
    return jsonOk({ ok: true, abTest });
  } catch (error) {
    return jsonError(error, 400);
  }
}
