import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { StoreData } from "./types";
import { enrichCandidateFromSource } from "./resume-workflow";

const emptyStore: StoreData = { jobs: [], candidates: [], sessions: [], reports: [], resumeImports: [] };

function dataPath(): string {
  return process.env.SCREENING_DATA_FILE || path.join(process.cwd(), "data", "store.json");
}

export async function readStore(): Promise<StoreData> {
  try {
    const value = await readFile(dataPath(), "utf8");
    const store = { ...emptyStore, ...JSON.parse(value) } as StoreData;
    return { ...store, candidates: store.candidates.map(enrichCandidateFromSource) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return structuredClone(emptyStore);
  }
}

export async function writeStore(store: StoreData): Promise<void> {
  const file = dataPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

export async function updateStore(mutator: (store: StoreData) => StoreData | Promise<StoreData>): Promise<StoreData> {
  const store = await readStore();
  const next = await mutator(store);
  await writeStore(next);
  return next;
}

export function createId(): string {
  return randomUUID();
}

export function createToken(): string {
  return `${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
}
