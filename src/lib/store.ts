import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

type LockRelease = () => void;

const fileLocks = new Map<string, Promise<void>>();
const DEFAULT_DATA_DIR = path.join(process.cwd(), "data");

export class StoreError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

export function getDataDir() {
  const configuredDataDir = process.env.SNACKOPS_DATA_DIR || process.env.DATA_DIR;

  if (configuredDataDir) {
    return path.resolve(/* turbopackIgnore: true */ configuredDataDir);
  }

  return DEFAULT_DATA_DIR;
}

export function resolveDataPath(relativeFile: string) {
  if (!relativeFile || path.isAbsolute(relativeFile)) {
    throw new StoreError(`Invalid data file path: ${relativeFile}`);
  }

  const dataDir = getDataDir();
  const target =
    dataDir === DEFAULT_DATA_DIR
      ? path.resolve(process.cwd(), "data", relativeFile)
      : path.resolve(dataDir, relativeFile);
  const relativeToDataDir = path.relative(dataDir, target);
  const isInsideDataDir =
    relativeToDataDir === "" ||
    (!relativeToDataDir.startsWith("..") && !path.isAbsolute(relativeToDataDir));

  if (!isInsideDataDir) {
    throw new StoreError(`Data file path escapes data dir: ${relativeFile}`);
  }

  return target;
}

async function withFileLock<T>(filePath: string, task: () => Promise<T>) {
  const key = path.resolve(filePath);
  const previous = fileLocks.get(key) ?? Promise.resolve();

  let release: LockRelease;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const active = previous.then(() => current, () => current);
  fileLocks.set(key, active);

  await previous.catch(() => undefined);

  try {
    return await task();
  } finally {
    release!();
    if (fileLocks.get(key) === active) {
      fileLocks.delete(key);
    }
  }
}

async function readJsonUnlocked<T>(filePath: string, fallback?: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new StoreError(`Failed to read JSON file: ${filePath}`, error);
  }
}

async function writeJsonUnlocked<T>(filePath: string, data: T) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });

  const tempFile = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
  );

  try {
    const serialized = `${JSON.stringify(data, null, 2)}\n`;
    await fs.writeFile(tempFile, serialized, "utf8");

    const verification = await fs.readFile(tempFile, "utf8");
    JSON.parse(verification);

    await fs.rename(tempFile, filePath);
  } catch (error) {
    await fs.rm(tempFile, { force: true }).catch(() => undefined);
    throw new StoreError(`Failed to atomically write JSON file: ${filePath}`, error);
  }
}

export async function readJsonFile<T>(relativeFile: string, fallback?: T): Promise<T> {
  const filePath = resolveDataPath(relativeFile);
  return withFileLock(filePath, () => readJsonUnlocked(filePath, fallback));
}

export async function writeJsonFile<T>(relativeFile: string, data: T) {
  const filePath = resolveDataPath(relativeFile);
  await withFileLock(filePath, () => writeJsonUnlocked(filePath, data));
}

export async function updateJsonFile<T>(
  relativeFile: string,
  updater: (current: T) => T | Promise<T>,
  fallback: T,
) {
  const filePath = resolveDataPath(relativeFile);

  return withFileLock(filePath, async () => {
    const current = await readJsonUnlocked<T>(filePath, fallback);
    const next = await updater(current);
    await writeJsonUnlocked(filePath, next);
    return next;
  });
}
