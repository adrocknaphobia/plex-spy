import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";

import { typeDefs } from "./schema/typeDefs.js";
import { resolvers } from "./schema/resolvers.js";
import { PlexClient } from "./plex/client.js";
import { startPoller } from "./poller/poller.js";

const PORT = Number(process.env.PORT ?? 4000);
const baseUrl = process.env.PLEX_BASE_URL ?? "http://localhost:32400";
const token = process.env.PLEX_TOKEN ?? "";
const pollLibraryIds = (process.env.PLEX_POLL_LIBRARY_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const pollIntervalMinutes = Number(process.env.POLL_INTERVAL_MINUTES ?? 15);
const pollMaxAnnouncedIds = Number(process.env.POLL_MAX_ANNOUNCED_IDS ?? 50);
const pollFetchLimit = Number(process.env.POLL_FETCH_LIMIT ?? 50);
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL ?? "";
const tmdbApiKey = process.env.TMDB_API_KEY ?? "";

if (!token) {
  console.error("Missing PLEX_TOKEN");
  process.exit(1);
}

async function main() {
  const plex = new PlexClient({ baseUrl, token });
  process.stdout.write("Checking Plex connectivity... ");
  await plex.assertReachable();
  console.log("OK");

  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  app.use("/graphql", expressMiddleware(server, {
    context: async () => ({ plex, baseUrl })
  }));

  app.get("/health", (_req, res) => res.json({ ok: true, plexBaseUrl: baseUrl }));

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);

    if (pollLibraryIds.length > 0) {
      startPoller(plex, baseUrl, pollLibraryIds, {
        intervalMinutes: pollIntervalMinutes,
        maxAnnouncedIds: pollMaxAnnouncedIds,
        fetchLimit: pollFetchLimit,
        slackWebhookUrl: slackWebhookUrl || undefined,
        tmdbApiKey: tmdbApiKey || undefined,
      });
    } else {
      console.log("No PLEX_POLL_LIBRARY_IDS configured — poller disabled");
    }
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
