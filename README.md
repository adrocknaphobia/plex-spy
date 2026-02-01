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
| `PLEX_POLL_LIBRARY_IDS` | No | Comma-separated library IDs to monitor |
| `POLL_INTERVAL_MINUTES` | No | Polling interval (default: `15`) |
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

## Architecture

```
src/
├── index.ts              Server entry point (Express + Apollo)
├── schema/
│   ├── typeDefs.ts       GraphQL schema (SDL)
│   └── resolvers.ts      Query resolvers
└── plex/
    ├── client.ts         HTTP client wrapping Plex REST API
    └── normalize.ts      XML-to-GraphQL data normalization
```

## Tech Stack

- **Express** + **Apollo Server 4** — HTTP and GraphQL
- **fast-xml-parser** — Plex XML response parsing
- **TypeScript** — ES Modules with strict mode
