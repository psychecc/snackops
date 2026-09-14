import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  skillSchema,
  skillVersionSchema,
  type Skill,
  type SkillVersion,
} from "@/lib/types";
import { readJsonFile, updateJsonFile } from "@/lib/store";

const SKILLS_FILE = "skills.json";
const VERSIONS_FILE = "skill-versions.json";
const DEFAULT_SKILLS_DIR = path.join(process.cwd(), "skills");

type SkillMetadata = Omit<Skill, "systemPrompt" | "prompt">;

export type SkillUpdate = Partial<
  Pick<
    Skill,
    | "name"
    | "description"
    | "enabled"
    | "model"
    | "temperature"
    | "maxTokens"
    | "requiredTools"
    | "version"
    | "filePath"
  >
> & {
  systemPrompt?: string;
  changeNote?: string;
};

export async function listSkills() {
  const metadata = await readSkillMetadata();
  return Promise.all(metadata.map((skill) => hydrateSkill(skill)));
}

export async function listEnabledSkills() {
  const skills = await listSkills();
  return skills.filter((skill) => skill.enabled);
}

export async function getSkill(id: string) {
  const skills = await listSkills();
  return skills.find((skill) => skill.id === id) ?? null;
}

export async function updateSkill(id: string, patch: SkillUpdate) {
  const current = await getSkill(id);

  if (!current) {
    throw new Error(`Skill not found: ${id}`);
  }

  const nextFilePath = patch.filePath ?? current.filePath;
  const promptPath = resolveSkillFilePath(nextFilePath);
  const nextPrompt = patch.systemPrompt ?? current.systemPrompt ?? "";
  const nextMetadata = parseSkillMetadata({
    ...parseSkillMetadata(current),
    ...withoutUndefined({
      name: patch.name,
      description: patch.description,
      enabled: patch.enabled,
      model: patch.model,
      temperature: patch.temperature,
      maxTokens: patch.maxTokens,
      requiredTools: patch.requiredTools,
      version: patch.version,
      filePath: nextFilePath,
    }),
  });

  await createSkillVersionSnapshot(current, patch.changeNote || "修改前自动快照");

  const targetBeforeWrite = await readTextFileIfExists(promptPath);
  let promptWritten = false;

  try {
    await writeTextFileAtomic(promptPath, nextPrompt);
    promptWritten = true;

    const updatedMetadata = await updateJsonFile<SkillMetadata[]>(
      SKILLS_FILE,
      (skills) =>
        skills.map((skill) => {
          if (skill.id !== id) {
            return parseSkillMetadata(skill);
          }

          return nextMetadata;
        }),
      [],
    );

    const saved = updatedMetadata.find((skill) => skill.id === id);

    if (!saved) {
      throw new Error(`Skill update failed: ${id}`);
    }

    return hydrateSkill(saved);
  } catch (error) {
    if (promptWritten) {
      await restoreTextFile(promptPath, targetBeforeWrite).catch(() => undefined);
    }

    throw error;
  }
}

export async function createSkillVersionSnapshot(skill: Skill, changeNote: string) {
  const metadata = parseSkillMetadata(skill);
  const systemPrompt = skill.systemPrompt ?? (await readTextFile(resolveSkillFilePath(skill.filePath)));
  const snapshot: SkillVersion = {
    id: `${skill.id}-${Date.now()}-${randomUUID().slice(0, 8)}`,
    skillId: skill.id,
    version: skill.version,
    createdAt: new Date().toISOString(),
    changeNote,
    hash: hashSkill(metadata, systemPrompt),
    filePath: skill.filePath,
    metadata,
    systemPrompt,
  };

  await updateJsonFile<SkillVersion[]>(
    VERSIONS_FILE,
    (versions) => [...versions.map((version) => skillVersionSchema.parse(version)), snapshot],
    [],
  );

  return snapshot;
}

export async function listSkillVersions(skillId: string) {
  const versions = await readJsonFile<unknown[]>(VERSIONS_FILE, []);
  return versions
    .map((version) => skillVersionSchema.parse(version))
    .filter((version) => version.skillId === skillId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSkillVersion(skillId: string, versionId: string) {
  const versions = await listSkillVersions(skillId);
  return versions.find((version) => version.id === versionId) ?? null;
}

export async function diffSkillVersionWithCurrent(skillId: string, versionId: string) {
  const [skill, version] = await Promise.all([getSkill(skillId), getSkillVersion(skillId, versionId)]);

  if (!skill || !version) {
    return null;
  }

  return {
    skillId,
    versionId,
    fromVersion: version.version,
    toVersion: skill.version,
    diff: createUnifiedDiff(version.systemPrompt, skill.systemPrompt ?? ""),
  };
}

export async function testSkill(id: string, input: unknown) {
  const skill = await getSkill(id);

  if (!skill) {
    throw new Error(`Skill not found: ${id}`);
  }

  return {
    ok: true,
    skillId: id,
    enabled: skill.enabled,
    model: skill.model,
    version: skill.version,
    requiredTools: skill.requiredTools,
    input,
    output: {
      mode: "registry-smoke-test",
      promptPreview: (skill.systemPrompt ?? "").slice(0, 240),
      promptLength: skill.systemPrompt?.length ?? 0,
      message: "Skill 注册、Prompt 文件读取和测试入口正常。",
    },
    executedAt: new Date().toISOString(),
  };
}

async function readSkillMetadata() {
  const skills = await readJsonFile<unknown[]>(SKILLS_FILE, []);
  return skills.map((skill) => parseSkillMetadata(skill));
}

function parseSkillMetadata(value: unknown): SkillMetadata {
  const parsed = skillSchema.parse(value);
  return {
    id: parsed.id,
    name: parsed.name,
    description: parsed.description,
    enabled: parsed.enabled,
    model: parsed.model,
    temperature: parsed.temperature,
    maxTokens: parsed.maxTokens,
    requiredTools: parsed.requiredTools,
    version: parsed.version,
    filePath: parsed.filePath,
  };
}

async function hydrateSkill(metadata: SkillMetadata): Promise<Skill> {
  const promptPath = resolveSkillFilePath(metadata.filePath);
  const systemPrompt = await readTextFile(promptPath);
  return skillSchema.parse({
    ...metadata,
    systemPrompt,
  });
}

function resolveSkillFilePath(filePath: string) {
  if (!filePath || path.isAbsolute(filePath)) {
    throw new Error(`Invalid skill file path: ${filePath}`);
  }

  const normalized = filePath.replaceAll("\\", "/");

  if (!normalized.startsWith("skills/")) {
    throw new Error(`Skill file path must be under skills directory: ${filePath}`);
  }

  const relativeSkillPath = normalized.slice("skills/".length);
  const skillsDir = getSkillsDir();
  const target = path.resolve(skillsDir, relativeSkillPath);
  const relativeToSkills = path.relative(skillsDir, target);
  const insideSkills =
    relativeToSkills === "" ||
    (!relativeToSkills.startsWith("..") && !path.isAbsolute(relativeToSkills));

  if (!insideSkills) {
    throw new Error(`Skill file path is outside skills directory: ${filePath}`);
  }

  return target;
}

function getSkillsDir() {
  const configuredSkillsDir = process.env.SNACKOPS_SKILLS_DIR || process.env.SKILLS_DIR;
  return configuredSkillsDir ? path.resolve(configuredSkillsDir) : DEFAULT_SKILLS_DIR;
}

async function readTextFile(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function readTextFileIfExists(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function writeTextFileAtomic(filePath: string, content: string) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
  );

  try {
    await fs.writeFile(tempPath, content, "utf8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function restoreTextFile(filePath: string, previousContent: string | null) {
  if (previousContent === null) {
    await fs.rm(filePath, { force: true });
    return;
  }

  await writeTextFileAtomic(filePath, previousContent);
}

function hashSkill(metadata: SkillMetadata, systemPrompt: string) {
  return createHash("sha256")
    .update(JSON.stringify(metadata))
    .update("\n")
    .update(systemPrompt)
    .digest("hex");
}

function createUnifiedDiff(previous: string, current: string) {
  const previousLines = previous.split(/\r?\n/);
  const currentLines = current.split(/\r?\n/);
  const dp = Array.from({ length: previousLines.length + 1 }, () =>
    Array<number>(currentLines.length + 1).fill(0),
  );

  for (let i = previousLines.length - 1; i >= 0; i -= 1) {
    for (let j = currentLines.length - 1; j >= 0; j -= 1) {
      dp[i][j] =
        previousLines[i] === currentLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const lines: string[] = ["--- saved-version", "+++ current"];
  let i = 0;
  let j = 0;

  while (i < previousLines.length && j < currentLines.length) {
    if (previousLines[i] === currentLines[j]) {
      lines.push(` ${previousLines[i]}`);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push(`-${previousLines[i]}`);
      i += 1;
    } else {
      lines.push(`+${currentLines[j]}`);
      j += 1;
    }
  }

  while (i < previousLines.length) {
    lines.push(`-${previousLines[i]}`);
    i += 1;
  }

  while (j < currentLines.length) {
    lines.push(`+${currentLines[j]}`);
    j += 1;
  }

  return lines.join("\n");
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
