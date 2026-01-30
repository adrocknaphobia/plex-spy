# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A GraphQL API server that wraps the Plex Media Server REST API using Express + Apollo Server 4. Plex returns XML; this project parses it with `fast-xml-parser` and normalizes it into GraphQL types.

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

## Architecture

```
src/
├── index.ts              Server entry point; Express + Apollo setup, startup validation
├── schema/
│   ├── typeDefs.ts       GraphQL schema (SDL)
│   └── resolvers.ts      Query resolvers; calls PlexClient, normalizes results
└── plex/
    ├── client.ts         HTTP client wrapping Plex REST API (XML responses)
    └── normalize.ts      Converts parsed XML nodes to GraphQL-friendly objects
```

**Data flow:** GraphQL query → resolver → `PlexClient` (HTTP + XML parse) → `normalize()` → GraphQL response

**Key patterns:**
- Apollo context injects `plex` (PlexClient instance) and `baseUrl` into all resolvers
- `normalize.ts` handles Plex XML quirks: `asArray()` ensures arrays, `attr()` extracts `@_`-prefixed XML attributes, `normalize()` maps raw nodes to typed objects
- `MediaItem` is a GraphQL interface resolved to Movie/Show/Season/Episode via `__resolveType` based on the `type` field
- Pagination uses `first`/`offset` params mapped to Plex's `X-Plex-Container-Start`/`X-Plex-Container-Size` headers
- Asset URLs (thumb/art) are built by prepending the Plex base URL to relative paths

## TypeScript Configuration

- ES Modules throughout (`"type": "module"` in package.json)
- Imports use `.js` extensions (NodeNext module resolution)
- Strict mode enabled, target ES2022
