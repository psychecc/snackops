import { SkillsManager } from "@/components/skills-manager";
import { listSkills, listSkillVersions } from "@/lib/skill-registry";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const skills = await listSkills();
  const versionEntries = await Promise.all(
    skills.map(async (skill) => [skill.id, await listSkillVersions(skill.id)] as const),
  );

  return (
    <div className="grid gap-5">
      <section className="ops-panel p-5">
        <BadgeLine label="Skill Registry" />
        <h1 className="mt-3 text-2xl font-black">Skill 管理</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          查看、启用、停用、编辑、测试和保存 Skill 版本。保存修改前会自动保留快照。
        </p>
      </section>
      <SkillsManager initialSkills={skills} initialVersions={Object.fromEntries(versionEntries)} />
    </div>
  );
}

function BadgeLine({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-md border border-[#9fc5d1] bg-[#edf7fa] px-2 py-0.5 text-xs font-semibold text-[#225766]">
      {label}
    </span>
  );
}
