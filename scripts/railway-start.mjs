import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const projectRoot = process.cwd();
const volumeRoot = path.resolve(process.env.SNACKOPS_RAILWAY_VOLUME_ROOT || "/data/snackops");
const sourceDataDir = path.join(projectRoot, "data");
const sourceSkillsDir = path.join(projectRoot, "skills");

process.env.SNACKOPS_DATA_DIR ||= path.join(volumeRoot, "data");
process.env.SNACKOPS_SKILLS_DIR ||= path.join(volumeRoot, "skills");

await seedDirectory({
  label: "data",
  sourceDir: sourceDataDir,
  targetDir: process.env.SNACKOPS_DATA_DIR,
  allowedExtensions: [".json"],
});

await seedDirectory({
  label: "skills",
  sourceDir: sourceSkillsDir,
  targetDir: process.env.SNACKOPS_SKILLS_DIR,
  allowedExtensions: [".md"],
});

const port = process.env.PORT || process.env.DEPLOY_RUN_PORT || "5000";
const host = process.env.DEPLOY_RUN_HOST || "0.0.0.0";
const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");

console.log(
  JSON.stringify({
    ok: true,
    message: "Railway data directories are ready.",
    dataDir: process.env.SNACKOPS_DATA_DIR,
    skillsDir: process.env.SNACKOPS_SKILLS_DIR,
    port,
    host,
  }),
);

const child = spawn(process.execPath, [nextCli, "start", "-p", port, "-H", host], {
  stdio: "inherit",
  shell: false,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

async function seedDirectory({ label, sourceDir, targetDir, allowedExtensions }) {
  const resolvedSource = path.resolve(sourceDir);
  const resolvedTarget = path.resolve(targetDir);

  await fs.access(resolvedSource, fsConstants.R_OK);
  await fs.mkdir(resolvedTarget, { recursive: true });

  const copied = await copyMissingFiles({
    sourceRoot: resolvedSource,
    currentSource: resolvedSource,
    targetRoot: resolvedTarget,
    allowedExtensions,
  });

  console.log(
    JSON.stringify({
      ok: true,
      label,
      targetDir: resolvedTarget,
      copiedMissingFiles: copied,
    }),
  );
}

async function copyMissingFiles({ sourceRoot, currentSource, targetRoot, allowedExtensions }) {
  const entries = await fs.readdir(currentSource, { withFileTypes: true });
  let copied = 0;

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.startsWith("__")) {
      continue;
    }

    const sourcePath = path.join(currentSource, entry.name);
    const relativePath = path.relative(sourceRoot, sourcePath);
    const targetPath = path.resolve(targetRoot, relativePath);
    const relativeToTarget = path.relative(targetRoot, targetPath);
    const isInsideTarget =
      relativeToTarget === "" ||
      (!relativeToTarget.startsWith("..") && !path.isAbsolute(relativeToTarget));

    if (!isInsideTarget) {
      throw new Error(`Refusing to seed outside ${targetRoot}: ${relativePath}`);
    }

    if (entry.isDirectory()) {
      copied += await copyMissingFiles({
        sourceRoot,
        currentSource: sourcePath,
        targetRoot,
        allowedExtensions,
      });
      continue;
    }

    if (!entry.isFile() || !allowedExtensions.includes(path.extname(entry.name))) {
      continue;
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    try {
      await fs.copyFile(sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
      copied += 1;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
    }
  }

  return copied;
}
