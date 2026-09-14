import { OpsCenter } from "@/components/ops-center";
import { Badge } from "@/components/ui/badge";
import { getOpsDashboard } from "@/lib/ops-store";
import { listSkills } from "@/lib/skill-registry";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  let dashboard: Awaited<ReturnType<typeof getOpsDashboard>> | null = null;
  let skills: Awaited<ReturnType<typeof listSkills>> = [];
  let loadError: unknown = null;

  try {
    [dashboard, skills] = await Promise.all([getOpsDashboard(), listSkills()]);
  } catch (error) {
    loadError = error;
  }

  if (loadError || !dashboard) {
    return (
      <div className="ops-panel p-6">
        <Badge tone="danger">错误状态</Badge>
        <h1 className="mt-3 text-2xl font-black">运营中心暂时不可用</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          页面请求失败，但不会影响其他 Agent、Skill 或 Tool 页面。请稍后重试或检查 data JSON 文件。
        </p>
        <pre className="mt-4 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
          {loadError instanceof Error ? loadError.message : String(loadError)}
        </pre>
      </div>
    );
  }

  return <OpsCenter initialDashboard={dashboard} skills={skills} />;
}
