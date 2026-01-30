import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";

import { typeDefs } from "./schema/typeDefs.js";
import { resolvers } from "./schema/resolvers.js";
import { PlexClient } from "./plex/client.js";

const PORT = Number(process.env.PORT ?? 4000);
const baseUrl = process.env.PLEX_BASE_URL ?? "http://localhost:32400";
const token = process.env.PLEX_TOKEN ?? "";

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
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
