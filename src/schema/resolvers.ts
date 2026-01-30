import { url } from "inspector";
import { asArray, attr } from "../plex/normalize.js";

function asset(baseUrl: string, path: string | null) {
  return path ? baseUrl.replace(/\/+$/, "") + path : null;
}

function normalize(node: any, baseUrl: string) {
  return {
    id: String(attr(node, "ratingKey")),
    type: attr(node, "type"),
    title: attr(node, "title"),
    year: attr(node, "year"),
    summary: attr(node, "summary"),
    addedAt: attr(node, "addedAt"),
    viewCount: attr(node, "viewCount"),
    thumb: asset(baseUrl, attr(node, "thumb")),
    art: asset(baseUrl, attr(node, "art"))
  };
}


export const resolvers = {
  MediaItem: {__resolveType(obj: any) {
      switch (obj.type) {
        case "movie":
          return "Movie";
        case "episode":
          return "Episode";
        case "season":
          return "Season";
        case "show":
          return "Show";
        case "track":
          return "Track"; // if you add music later
        default:
          return null; // will throw if truly unknown
      }
    }
  },


  Query: {
    health: (_: any, __: any, ctx: any) => ({ ok: true, plexBaseUrl: ctx.baseUrl }),

    libraries: async (_: any, __: any, ctx: any) => {
      const data = await ctx.plex.get("/library/sections");
      return asArray(data?.MediaContainer?.Directory).map((d: any) => ({
        id: String(attr(d, "key")),
        title: attr(d, "title"),
        type: attr(d, "type")
      }));
    },

    movies: async (_: any, args: any, ctx: any) => {
      const data = await ctx.plex.get(
        `/library/sections/${args.libraryId}/all?type=1&X-Plex-Container-Start=${args.offset}&X-Plex-Container-Size=${args.first}`
      );
      return asArray(data?.MediaContainer?.Video).map((v: any) => ({
        ...normalize(v, ctx.baseUrl),
        duration: attr(v, "duration"),
        rating: attr(v, "rating")
      }));
    },

    shows: async (_: any, args: any, ctx: any) => {
      const data = await ctx.plex.get(
        `/library/sections/${args.libraryId}/all?type=2&X-Plex-Container-Start=${args.offset}&X-Plex-Container-Size=${args.first}`
      );
      return asArray(data?.MediaContainer?.Directory).map((d: any) => ({
        ...normalize(d, ctx.baseUrl),
        childCount: attr(d, "childCount")
      }));
    },

    seasons: async (_: any, args: any, ctx: any) => {
      const data = await ctx.plex.get(`/library/metadata/${args.showId}/children`);
      return asArray(data?.MediaContainer?.Directory).map((d: any) => ({
        ...normalize(d, ctx.baseUrl),
        index: attr(d, "index")
      }));
    },

    episodes: async (_: any, args: any, ctx: any) => {
      const plexurl = `/library/metadata/${args.seasonId}/children`;
      const data = await ctx.plex.get(`/library/metadata/${args.seasonId}/children`);

      const mc = data?.MediaContainer;
      console.log("EPISODES DEBUG", {
        seasonId: args.seasonId,
        returnedVideos: Array.isArray(mc?.Video) ? mc.Video.length : (mc?.Video ? 1 : 0),
        returnedDirectories: Array.isArray(mc?.Directory) ? mc.Directory.length : (mc?.Directory ? 1 : 0),
        offset: mc?.["@_offset"],
        size: mc?.["@_size"],
        totalSize: mc?.["@_totalSize"],
        plexurl
      });

      return asArray(data?.MediaContainer?.Video).map((v: any) => ({
        ...normalize(v, ctx.baseUrl),
        index: attr(v, "index"),
        parentIndex: attr(v, "parentIndex"),
        duration: attr(v, "duration")
      }));
    },

    media: async (_: any, args: any, ctx: any) => {
      const data = await ctx.plex.get(`/library/metadata/${args.id}`);
      const mc = data?.MediaContainer;
      const node = mc?.Video ?? mc?.Directory;
      if (!node) return null;
      return normalize(node, ctx.baseUrl);
    },

    search: async (_: any, args: any, ctx: any) => {
      const data = await ctx.plex.get(`/search?query=${encodeURIComponent(args.query)}`);
      const mc = data?.MediaContainer;
      const results = [
        ...asArray(mc?.Video),
        ...asArray(mc?.Directory)
      ];
      return results.map((n: any) => normalize(n, ctx.baseUrl));
    },

    latest: async (_: any, args: { libraryId: string; first: number }, ctx: any) => {
      const path = `/library/sections/${encodeURIComponent(args.libraryId)}/recentlyAdded` + `?X-Plex-Container-Start=0` + `&X-Plex-Container-Size=${args.first}`;
      const data = await ctx.plex.get(path);
      const mc = data?.MediaContainer;
      const items = [
        ...asArray(mc?.Video),
        ...asArray(mc?.Directory)
      ];
      return items.map((n: any) => normalize(n, ctx.baseUrl));
    }
  }
};
