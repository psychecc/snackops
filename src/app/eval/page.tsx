import { EvalCenter } from "@/components/eval-center";
import { Badge } from "@/components/ui/badge";
import { getEvalOverview } from "@/lib/eval-store";

export const dynamic = "force-dynamic";

export default async function EvalPage() {
  let overview: Awaited<ReturnType<typeof getEvalOverview>> | null = null;
  let loadError: unknown = null;

  try {
    overview = await getEvalOverview();
  } catch (error) {
    loadError = error;
  }

  if (!overview) {
    return (
      <div className="ops-panel p-6">
        <Badge tone="danger">错误状态</Badge>
        <h1 className="mt-3 text-2xl font-black">Eval 暂时不可用</h1>
        <p className="mt-2 text-sm text-muted-foreground">评测集读取失败，不会影响 Agent 主链路。</p>
        <pre className="mt-4 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
          {loadError instanceof Error ? loadError.message : String(loadError)}
        </pre>
      </div>
    );
  }

  return <EvalCenter initialOverview={overview} />;
}
