import { PlexClient } from "../plex/client.js";
import { asArray, attr } from "../plex/normalize.js";
import { loadState, saveState, type PollerState } from "./state.js";
import { sendSlackNotification } from "../slack/notify.js";

const STATE_PATH = "data/poller-state.json";

export interface NewItem {
  id: string;
  type: string | null;
  title: string | null;
  year: number | null;
  addedAt: number | null;
  // Episode-specific
  grandparentTitle: string | null;    // show name
  grandparentRatingKey: string | null; // show ID
  parentRatingKey: string | null;      // season ID
  parentIndex: number | null;          // season number
  index: number | null;                // episode number
}

function normalizeItem(node: any): NewItem {
  return {
    id: String(attr(node, "ratingKey")),
    type: attr(node, "type"),
    title: attr(node, "title"),
    year: attr(node, "year"),
    addedAt: attr(node, "addedAt"),
    grandparentTitle: attr(node, "grandparentTitle"),
    grandparentRatingKey: attr(node, "grandparentRatingKey") != null ? String(attr(node, "grandparentRatingKey")) : null,
    parentRatingKey: attr(node, "parentRatingKey") != null ? String(attr(node, "parentRatingKey")) : null,
    parentIndex: attr(node, "parentIndex"),
    index: attr(node, "index"),
  };
}

export type AnnouncementType = "new_show" | "new_season" | "new";

export interface Announcement {
  type: AnnouncementType;
  item: NewItem;
  message: string;
}

function formatEpisode(item: NewItem): string {
  return `${item.grandparentTitle} — S${String(item.parentIndex ?? 0).padStart(2, "0")}E${String(item.index ?? 0).padStart(2, "0")} "${item.title}"`;
}

export function formatItem(announcementType: AnnouncementType, item: NewItem): string {
  switch (item.type) {
    case "episode": {
      const label =
        announcementType === "new_show" ? "New Show" :
        announcementType === "new_season" ? "New Season" :
        "New";
      return `${label}: ${formatEpisode(item)}`;
    }
    case "movie":
      return `New: ${item.title} (${item.year ?? "unknown year"})`;
    case "season":
      return `New: ${item.grandparentTitle ?? item.title} — Season ${item.index ?? "?"}`;
    case "show":
      return `New: ${item.title} (${item.year ?? "unknown year"})`;
    default:
      return `New: ${item.title} (${item.type ?? "unknown"})`;
  }
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
  slackWebhookUrl?: string;
}

export function startPoller(
  plex: PlexClient,
  baseUrl: string,
  libraryIds: string[],
  options: PollerOptions = {}
) {
  const intervalMinutes = options.intervalMinutes ?? 15;
  const maxAnnouncedIds = options.maxAnnouncedIds ?? 50;
  const slackWebhookUrl = options.slackWebhookUrl;

  async function tick() {
    console.log("[poller] Checking for new media...");
    const state = await loadState(STATE_PATH);
    const newItems = await poll(plex, libraryIds, state);

    if (newItems.length === 0) {
      console.log("[poller] No new items found.");
    } else {
      for (const item of newItems) {
        let announcementType: AnnouncementType = "new";

        if (item.type === "episode" && item.index === 1) {
          const showId = item.grandparentRatingKey;
          const seasonId = item.parentRatingKey;

          if (item.parentIndex === 1 && showId && !state.announcedShowIds.includes(showId)) {
            announcementType = "new_show";
            state.announcedShowIds.push(showId);
          } else if (seasonId && !state.announcedSeasonIds.includes(seasonId)) {
            announcementType = "new_season";
            state.announcedSeasonIds.push(seasonId);
          }
        }

        const message = formatItem(announcementType, item);
        console.log(`[poller] ${message}`);

        if (slackWebhookUrl) {
          const announcement: Announcement = { type: announcementType, item, message };
          await sendSlackNotification(slackWebhookUrl, announcement);
        }

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
