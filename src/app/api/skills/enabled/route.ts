import { jsonError, jsonOk } from "@/lib/api-response";
import { listEnabledSkills } from "@/lib/skill-registry";

export async function GET() {
  try {
    const skills = await listEnabledSkills();
    return jsonOk({ ok: true, skills });
  } catch (error) {
    return jsonError(error, 500);
  }
}
