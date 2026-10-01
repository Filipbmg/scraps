# Snowdrop

**A little clarity in a world of conversation.** A modular starting point for a media monitoring and scraping platform.

React + TypeScript on the frontend, Python + FastAPI on the backend. A labeled demo dashboard sits alongside a real, locally persisted collection workspace for news/RSS, Telegram, YouTube, and X.

## Run locally

Requirements: Node.js 22.12+ (or a newer supported release), Python 3.11+, and [uv](https://docs.astral.sh/uv/getting-started/installation/).

**Terminal 1 — API**

```bash
cd backend
uv sync --all-extras
uv run --all-extras uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — collector worker, from `backend/`**

```bash
uv run --all-extras python -m app.features.collection.worker
```

**Terminal 3 — frontend**

```bash
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. API documentation: **http://127.0.0.1:8000/docs**.

The frontend proxies `/api` to the Python server. The API serves the workspace; the independent worker executes source schedules. If the API is unavailable, the UI displays recovery instructions and retry controls. Run one worker per workspace.

## What works

- Responsive overview with summary metrics, source-filtered mention trends, and a sentiment breakdown.
- Mention search, sentiment filters, 7-/30-day sample periods, and article preview dialogs.
- Browser-persisted bookmarks and a Saved mentions view.
- Source directory with publisher links and sample activity.
- CSV export of the currently filtered sample mentions.
- Persistent light/dark themes, system-theme default, keyboard shortcuts, and native accessible dialogs.
- A real Collectors workspace: editable per-source intervals/limits, pause/resume, queued runs, worker heartbeat, and run history.
- Actual Collected feed: searchable records, platform/source filters, Denmark keyword hints, original links, caption status/text, and captured comments.
- RSS/Atom ingestion, public/account-mode Telegram adapters, YouTube metadata/captions/comments, and free best-effort Twikit X profile/search adapters.
- SQLite-backed schedules, checkpoints, deduplication, leases, and rate-limit-aware retry backoff.

Overview, Mentions, Sources, Saved mentions, and activity are explicitly **sample analytics**. Their fictional headlines link to publisher homepages and their bookmarks stay in the browser. **Collectors and Collected feed use actual source data** and real run outcomes; no sentiment or estimated reach is invented for collected records.

The four starter news feeds are DR Udland, DR Indland, BBC Europe, and Guardian Russia, with hourly polling and Russia-focused keywords where relevant. Public Telegram and YouTube can be collected without API keys. Account-mode Telegram and X need your own local session. Full setup, recommendations, costs, coverage limits, and research references: **[docs/collectors.md](docs/collectors.md)**.

## Structure

```text
snowdrop/
├── frontend/
│   ├── src/
│   │   ├── app/                    # Shell and global styling
│   │   ├── components/             # Shared branding, layout, UI
│   │   ├── features/dashboard/     # Dashboard, cards, API types, export
│   │   ├── features/collection/    # Source configuration, actual feed, record details
│   │   ├── hooks/                  # Shared theme behavior
│   │   └── lib/                    # Small shared helpers
│   └── tests/                      # Browser acceptance checks
├── backend/
│   ├── app/
│   │   ├── api/                    # Route composition and health
│   │   └── features/
│   │       ├── dashboard/          # Route, schemas, service, demo data
│   │       └── collection/         # Connectors, schemas, store, API, worker, auth CLI
│   └── tests/                      # API contract checks
├── .opencode/skills/               # Reusable project knowledge
├── docs/collectors.md              # Collector setup and researched stack guidance
└── AGENTS.md                       # Project conventions for coding agents
```

Features own their UI, contracts, and logic. Shared code stays shared only where it has actual consumers. React state, CSS, SVG charts, and native browser controls keep the foundation small.

## Checks

```bash
# From backend/
uv run --all-extras python -m unittest discover -s tests -v

# From frontend/
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
```

Browser tests start the API and frontend automatically and cover themes, filters, bookmarks, downloads, mobile navigation, collector configuration, record details, and API recovery. Collection-write tests use isolated mocked API responses; backend checks use temporary databases and mocked account clients. Visual captures are written to ignored `frontend/test-results/`.

## Build and local state

`npm run build` creates `frontend/dist/`. The default API binding is local, `127.0.0.1`; this is an operator workspace. Authentication and deployment ownership can be added as a separate feature when making the platform multi-user.

Collection state is in ignored `backend/data/`, or the same `SNOWDROP_DATA_DIR` configured for both processes. See `backend/.env.example` for local credential paths and `docs/collectors.md` for account setup. Generated files, captured data, environments, and credentials are not committed.

## OpenCode skills

Project-specific workflows live in `.opencode/skills/snowdrop-ui/`, `snowdrop-api/`, and `snowdrop-collectors/`. Future work should update these or add a focused skill when new reusable knowledge is acquired. Restart OpenCode to discover the new skills. These are project-local files, not global OpenCode settings or plugins.
