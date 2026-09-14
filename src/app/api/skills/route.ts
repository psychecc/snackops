import { jsonError, jsonOk } from "@/lib/api-response";
import { listSkills } from "@/lib/skill-registry";

export async function GET() {
  try {
    const skills = await listSkills();
    return jsonOk({ ok: true, skills });
  } catch (error) {
    return jsonError(error, 500);
  }
}
