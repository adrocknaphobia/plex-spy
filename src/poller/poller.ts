import { PlexClient } from "../plex/client.js";
import { asArray, attr } from "../plex/normalize.js";
import { loadState, saveState, type PollerState } from "./state.js";
import { sendSlackNotification } from "../slack/notify.js";
import { TmdbClient } from "../tmdb/client.js";

const STATE_PATH = "data/poller-state.json";

export interface NewItem {
  id: string;
  type: string | null;
  title: string | null;
  year: number | null;
  addedAt: number | null;
  thumb: string | null;
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
    thumb: attr(node, "thumb"),
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
  imageUrl?: string;
  overview?: string;
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
  state: PollerState,
  fetchLimit: number
): Promise<NewItem[]> {
  const newItems: NewItem[] = [];

  for (const libId of libraryIds) {
    const path = `/library/sections/${encodeURIComponent(libId)}/recentlyAdded`
      + `?X-Plex-Container-Start=0&X-Plex-Container-Size=${fetchLimit}`;

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
  fetchLimit?: number;
  slackWebhookUrl?: string;
  tmdbApiKey?: string;
}

async function lookupTmdb(
  tmdb: TmdbClient,
  item: NewItem
): Promise<{ imageUrl?: string; overview?: string }> {
  try {
    switch (item.type) {
      case "movie": {
        const result = await tmdb.searchMovie(item.title ?? "", item.year ?? undefined);
        return {
          imageUrl: result?.imageUrl ?? undefined,
          overview: result?.overview ?? undefined,
        };
      }
      case "show": {
        const result = await tmdb.searchTv(item.title ?? "");
        return {
          imageUrl: result?.imageUrl ?? undefined,
          overview: result?.overview ?? undefined,
        };
      }
      case "season": {
        const showTitle = item.grandparentTitle ?? item.title ?? "";
        const result = await tmdb.searchTv(showTitle);
        return {
          imageUrl: result?.imageUrl ?? undefined,
          overview: result?.overview ?? undefined,
        };
      }
      case "episode": {
        const showTitle = item.grandparentTitle ?? "";
        const showResult = await tmdb.searchTv(showTitle);
        if (!showResult) return {};

        const seasonNum = item.parentIndex ?? 0;
        const episodeNum = item.index ?? 0;
        if (seasonNum > 0 && episodeNum > 0) {
          const epResult = await tmdb.getEpisode(showResult.id, seasonNum, episodeNum);
          return {
            imageUrl: epResult?.imageUrl ?? showResult.imageUrl ?? undefined,
            overview: epResult?.overview ?? undefined,
          };
        }
        return {
          imageUrl: showResult.imageUrl ?? undefined,
          overview: showResult.overview ?? undefined,
        };
      }
      default:
        return {};
    }
  } catch (err) {
    console.error("[poller] TMDB lookup failed:", err);
    return {};
  }
}

export function startPoller(
  plex: PlexClient,
  baseUrl: string,
  libraryIds: string[],
  options: PollerOptions = {}
) {
  const intervalMinutes = options.intervalMinutes ?? 15;
  const maxAnnouncedIds = options.maxAnnouncedIds ?? 50;
  const fetchLimit = options.fetchLimit ?? 50;
  const slackWebhookUrl = options.slackWebhookUrl;
  const tmdb = options.tmdbApiKey ? new TmdbClient(options.tmdbApiKey) : null;

  async function tick() {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const timestamp = `${mm}/${dd}/${yy} ${hh}:${min}`;
    console.log(`[poller][${timestamp}] Checking for new media...`);
    const state = await loadState(STATE_PATH);
    const newItems = await poll(plex, libraryIds, state, fetchLimit);

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

          if (tmdb) {
            const tmdbData = await lookupTmdb(tmdb, item);
            announcement.imageUrl = tmdbData.imageUrl;
            announcement.overview = tmdbData.overview;
          }

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
