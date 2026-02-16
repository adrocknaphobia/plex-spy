# plex-spy

A GraphQL API server that wraps the Plex Media Server REST API. Plex returns XML; this project parses it and normalizes it into a clean GraphQL schema. Includes a poller that monitors libraries for new media and sends Slack notifications with TMDB metadata.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your configuration:

| Variable | Required | Description |
|---|---|---|
| `PLEX_TOKEN` | Yes | Your Plex authentication token |
| `PLEX_BASE_URL` | No | Plex server URL (default: `http://localhost:32400`) |
| `PORT` | No | Server port (default: `4000`) |
| `PLEX_POLL_LIBRARY_IDS` | No | Comma-separated library IDs to monitor (enables poller) |
| `POLL_INTERVAL_MINUTES` | No | Polling interval (default: `15`) |
| `POLL_MAX_ANNOUNCED_IDS` | No | Max tracked IDs in state (default: `50`) |
| `SLACK_WEBHOOK_URL` | No | Slack webhook for new media notifications |
| `TMDB_API_KEY` | No | TMDB API key for poster images and plot summaries |

## Usage

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

The GraphQL playground is available at `http://localhost:4000/graphql`.

## GraphQL API

### Queries

- `health` — Server health check
- `libraries` — List all Plex libraries
- `movies(libraryId, first, offset)` — Paginated movies from a library
- `shows(libraryId, first, offset)` — Paginated shows from a library
- `seasons(showId)` — Seasons for a show
- `episodes(seasonId)` — Episodes for a season
- `media(id)` — Single media item by ID
- `search(query)` — Search across all media
- `latest(libraryId, first)` — Recently added media

## Poller

When `PLEX_POLL_LIBRARY_IDS` is set, the server starts a background poller that periodically checks for newly added media. New items are classified as:

- **New show** — first episode of a brand new series (S1E1)
- **New season** — first episode of a new season
- **New** — any other new item

If `SLACK_WEBHOOK_URL` is configured, notifications are sent as Slack Block Kit messages. If `TMDB_API_KEY` is also set, notifications are enriched with poster images and plot summaries.

Poller state is persisted to `data/poller-state.json` to survive restarts and avoid duplicate announcements.

## Architecture

```
src/
├── index.ts              Server entry point (Express + Apollo, poller init)
├── schema/
│   ├── typeDefs.ts       GraphQL schema (SDL)
│   └── resolvers.ts      Query resolvers
├── plex/
│   ├── client.ts         HTTP client wrapping Plex REST API
│   └── normalize.ts      XML-to-GraphQL data normalization
├── poller/
│   ├── poller.ts         Polls Plex libraries for new media on an interval
│   └── state.ts          Persists poller state to disk
├── slack/
│   └── notify.ts         Formats and sends Slack Block Kit notifications
└── tmdb/
    └── client.ts         TMDB API client for poster images and summaries
```

## Tech Stack

- **Express** + **Apollo Server 5** — HTTP and GraphQL
- **fast-xml-parser** — Plex XML response parsing
- **TypeScript** — ES Modules with strict mode
- **Node.js 20+** required
