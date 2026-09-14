import { jsonError, jsonOk, readRequestJson } from "@/lib/api-response";
import { getRunRecord } from "@/lib/run-store";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    const runId = typeof body.runId === "string" ? body.runId : "";
    const run = runId ? await getRunRecord(runId) : null;

    if (!run && runId) {
      return jsonError(`Run not found: ${runId}`, 404);
    }

    const risk = run?.riskResult ?? body.riskResult ?? null;
    return jsonOk({
      ok: true,
      explanation: {
        runId: run?.id ?? null,
        status: run?.status ?? "ad-hoc",
        summary: run
          ? `本次运行共执行 ${run.steps.length} 个步骤，状态为 ${run.status}。`
          : "已根据传入风险结果生成解释。",
        riskExplanation: risk
          ? `风险等级 ${risk.riskLevel}，${risk.passed ? "安全回复可发送" : "危险回复已阻断"}。`
          : "无风险结果。",
        planExplanation: run?.plan?.reasoning ?? [],
      },
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}
