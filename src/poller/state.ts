import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface PollerState {
  lastPollTimestamp: number;
  announcedIds: string[];
}

function defaultState(): PollerState {
  return {
    lastPollTimestamp: Math.floor(Date.now() / 1000),
    announcedIds: [],
  };
}

export async function loadState(filePath: string): Promise<PollerState> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      lastPollTimestamp: parsed.lastPollTimestamp ?? defaultState().lastPollTimestamp,
      announcedIds: Array.isArray(parsed.announcedIds) ? parsed.announcedIds : [],
    };
  } catch {
    return defaultState();
  }
}

export async function saveState(filePath: string, state: PollerState, maxAnnouncedIds: number): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const trimmed: PollerState = {
    lastPollTimestamp: state.lastPollTimestamp,
    announcedIds: state.announcedIds.slice(-maxAnnouncedIds),
  };
  await writeFile(filePath, JSON.stringify(trimmed, null, 2), "utf-8");
}
