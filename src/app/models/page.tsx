import { ModelManager } from "@/components/model-manager";
import { getPublicLlmConfig } from "@/lib/llm-config";

export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  const config = await getPublicLlmConfig();
  return <ModelManager initialConfig={config} />;
}
