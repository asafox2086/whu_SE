import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export function createLocalDatabase(options = {}) {
  const dataDir = resolve(options.dataDir ?? "data");
  const fileName = options.fileName ?? "state.local.json";
  return {
    dataDir,
    fileName,
    filePath: join(dataDir, fileName),
    seedState: options.seedState ?? {}
  };
}

export async function readLocalState(database) {
  try {
    const content = await readFile(database.filePath, "utf8");
    return mergeState(database.seedState, JSON.parse(content));
  } catch (error) {
    if (error.code === "ENOENT") {
      return clone(database.seedState);
    }
    throw error;
  }
}

export async function localStateExists(database) {
  try {
    await access(database.filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function writeLocalState(database, state) {
  await mkdir(database.dataDir, { recursive: true });
  const tempPath = `${database.filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(tempPath, database.filePath);
  return {
    filePath: database.filePath
  };
}

function mergeState(seedState, storedState) {
  return {
    ...clone(seedState),
    ...storedState,
    admins: storedState.admins ?? seedState.admins ?? [],
    certificateCollectors: storedState.certificateCollectors ?? seedState.certificateCollectors ?? [],
    usageEvents: storedState.usageEvents ?? seedState.usageEvents ?? [],
    feedbackEntries: storedState.feedbackEntries ?? seedState.feedbackEntries ?? []
  };
}

function clone(value) {
  return globalThis.structuredClone
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}
