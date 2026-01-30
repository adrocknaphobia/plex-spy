import { PlexClient } from "../plex/client.js";
import { asArray, attr } from "../plex/normalize.js";
import { loadState, saveState, type PollerState } from "./state.js";

const STATE_PATH = "data/poller-state.json";

interface NewItem {
  id: string;
  type: string | null;
  title: string | null;
  year: number | null;
  addedAt: number | null;
}

function normalizeItem(node: any): NewItem {
  return {
    id: String(attr(node, "ratingKey")),
    type: attr(node, "type"),
    title: attr(node, "title"),
    year: attr(node, "year"),
    addedAt: attr(node, "addedAt"),
  };
}

async function poll(
  plex: PlexClient,
  libraryIds: string[],
  state: PollerState
): Promise<NewItem[]> {
  const newItems: NewItem[] = [];

  for (const libId of libraryIds) {
    const path = `/library/sections/${encodeURIComponent(libId)}/recentlyAdded`
      + `?X-Plex-Container-Start=0&X-Plex-Container-Size=20`;

    let data: any;
    try {
      data = await plex.get(path);
    } catch (err) {
      console.error(`[poller] Failed to fetch library ${libId}:`, err);
      continue;
    }

    const mc = data?.MediaContainer;
    const items = [...asArray(mc?.Video), ...asArray(mc?.Directory)];

    for (const raw of items) {
      const item = normalizeItem(raw);
      const addedAt = item.addedAt ?? 0;

      if (addedAt > state.lastPollTimestamp && !state.announcedIds.includes(item.id)) {
        newItems.push(item);
      }
    }
  }

  return newItems;
}

export interface PollerOptions {
  intervalMinutes?: number;
  maxAnnouncedIds?: number;
}

export function startPoller(
  plex: PlexClient,
  baseUrl: string,
  libraryIds: string[],
  options: PollerOptions = {}
) {
  const intervalMinutes = options.intervalMinutes ?? 15;
  const maxAnnouncedIds = options.maxAnnouncedIds ?? 50;

  async function tick() {
    console.log("[poller] Checking for new media...");
    const state = await loadState(STATE_PATH);
    const newItems = await poll(plex, libraryIds, state);

    if (newItems.length === 0) {
      console.log("[poller] No new items found.");
    } else {
      for (const item of newItems) {
        console.log(`[poller] New: ${item.title} (${item.type}, ${item.year ?? "unknown year"})`);
        state.announcedIds.push(item.id);
      }
    }

    state.lastPollTimestamp = Math.floor(Date.now() / 1000);
    await saveState(STATE_PATH, state, maxAnnouncedIds);
  }

  // Run immediately, then on interval
  tick().catch((err) => console.error("[poller] Error during initial poll:", err));
  setInterval(() => {
    tick().catch((err) => console.error("[poller] Error during poll:", err));
  }, intervalMinutes * 60 * 1000);

  console.log(`[poller] Started — checking libraries [${libraryIds.join(", ")}] every ${intervalMinutes} minutes`);
}
