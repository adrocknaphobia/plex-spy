# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A GraphQL API server that wraps the Plex Media Server REST API using Express + Apollo Server 5. Plex returns XML; this project parses it with `fast-xml-parser` and normalizes it into GraphQL types. Includes a polling service that monitors Plex libraries for new media and sends Slack notifications enriched with TMDB metadata.

## Commands

- `npm run dev` — Run in development mode (uses tsx for live TypeScript execution)
- `npm run build` — Compile TypeScript to `dist/` via `tsc`
- `npm start` — Run compiled output (`node dist/index.js`)

No test runner or linter is configured.

## Environment

Requires a `.env` file (see `.env.example`):
- `PLEX_TOKEN` — Required. Server fails fast without it.
- `PLEX_BASE_URL` — Optional, defaults to `http://localhost:32400`
- `PORT` — Optional, defaults to `4000`
- `PLEX_POLL_LIBRARY_IDS` — Comma-separated library IDs to monitor (enables poller)
- `POLL_INTERVAL_MINUTES` — Optional, defaults to `15`
- `POLL_MAX_ANNOUNCED_IDS` — Optional, defaults to `50` (caps state array size)
- `POLL_FETCH_LIMIT` — Optional, defaults to `50` (number of recently added items to fetch per library per poll)
- `SLACK_WEBHOOK_URL` — Optional. Slack incoming webhook for notifications
- `TMDB_API_KEY` — Optional. Enables poster images and plot summaries in Slack messages

## Architecture

```
src/
├── index.ts              Server entry point; Express + Apollo setup, startup validation, poller init
├── schema/
│   ├── typeDefs.ts       GraphQL schema (SDL)
│   └── resolvers.ts      Query resolvers; calls PlexClient, normalizes results
├── plex/
│   ├── client.ts         HTTP client wrapping Plex REST API (XML responses)
│   └── normalize.ts      Converts parsed XML nodes to GraphQL-friendly objects
├── poller/
│   ├── poller.ts         Polls Plex libraries on an interval, detects new media
│   └── state.ts          Persists poller state to data/poller-state.json
├── slack/
│   └── notify.ts         Formats and sends Slack Block Kit notifications
└── tmdb/
    └── client.ts         TMDB API client for poster images and plot summaries
```

**GraphQL data flow:** Query → resolver → `PlexClient` (HTTP + XML parse) → `normalize()` → GraphQL response

**Poller data flow:** `startPoller()` → poll Plex for recently added items → detect new items via timestamp + state → optionally enrich with TMDB metadata → optionally send Slack notification → persist state

**Key patterns:**
- Apollo context injects `plex` (PlexClient instance) and `baseUrl` into all resolvers
- `normalize.ts` handles Plex XML quirks: `asArray()` ensures arrays, `attr()` extracts `@_`-prefixed XML attributes, `normalize()` maps raw nodes to typed objects
- `MediaItem` is a GraphQL interface resolved to Movie/Show/Season/Episode via `__resolveType` based on the `type` field
- Pagination uses `first`/`offset` params mapped to Plex's `X-Plex-Container-Start`/`X-Plex-Container-Size` headers
- Asset URLs (thumb/art) are built by prepending the Plex base URL to relative paths
- Poller uses three deduplication arrays (item IDs, show IDs, season IDs) to avoid repeat announcements
- Poller classifies episodes as `new_show` (S1E1), `new_season` (E1 of later season), or `new` (regular)
- Slack/TMDB integrations degrade gracefully — failures are logged but don't block the poller
- Poller state is persisted to `data/poller-state.json` with array trimming to prevent unbounded growth

## TypeScript Configuration

- ES Modules throughout (`"type": "module"` in package.json)
- Imports use `.js` extensions (NodeNext module resolution)
- Strict mode enabled, target ES2023
- Requires Node.js 20+
