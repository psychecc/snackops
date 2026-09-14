import { ToolsManager } from "@/components/tools-manager";
import { Badge } from "@/components/ui/badge";
import { listTools } from "@/lib/tool-registry";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const tools = await listTools();

  return (
    <div className="grid gap-5">
      <section className="ops-panel p-5">
        <Badge tone="info">Tool Registry</Badge>
        <h1 className="mt-3 text-2xl font-black">Tool 管理</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          查看 Tool schema、启用状态和真实 data JSON 读取结果。单项测试会调用服务端 handler。
        </p>
      </section>
      <ToolsManager initialTools={tools} />
    </div>
  );
}
