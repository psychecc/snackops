import { PlannerManager } from "@/components/planner-manager";
import { getPlannerConfig } from "@/lib/planner-config";
import { listEnabledSkills } from "@/lib/skill-registry";
import { listEnabledTools } from "@/lib/tool-registry";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const [config, skills, tools] = await Promise.all([
    getPlannerConfig(),
    listEnabledSkills(),
    listEnabledTools(),
  ]);

  return <PlannerManager initialConfig={config} initialSkills={skills} initialTools={tools} />;
}
