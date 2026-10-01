---
name: snowdrop-collectors
description: Build, configure, or troubleshoot Snowdrop's RSS/news, Telegram, YouTube, and X collectors and their polling schedules. Use for backend/app/features/collection, the collector worker, or collected-data flows.
---

# Snowdrop collectors

## Ownership and execution

- Backend feature: `app/features/collection/`. `schemas.py` defines validated contracts, `store.py` owns SQLite persistence, `service.py` dispatches collectors and applies keywords, `router.py` exposes `/api/collection`.
- Each provider is an async `collect(source) -> Result` function in `connectors/`. `Result` contains normalized items, a checkpoint, a human-readable outcome, and any publisher minimum polling interval.
- Run the API and `python -m app.features.collection.worker` separately. One worker per workspace, two concurrent jobs. Account-mode Telegram jobs are serialized because they share one session file.
- The database lives at `backend/data/snowdrop.sqlite3`, or under `SNOWDROP_DATA_DIR`. SQLite transactions claim sources with five-minute leases; expired runs become interrupted. A stale worker cannot overwrite a replacement run.
- Schedules, source settings, and checkpoints persist across restarts. Pausing a source stops automatic collection; a manually queued run may still execute. Editing/rerunning an actively leased source returns 409.
- Job deadlines are three minutes; synchronous YouTube work uses a thread with socket timeouts and bounded item/comment counts. Thread cancellation does not terminate an already-running third-party request.
- Retry-After and Telegram flood waits are honored. Other failures use capped exponential backoff; errors retain existing items and checkpoints. RSS TTL can make the actual next check later than the configured cadence.
- Record IDs hash provider + external ID. News IDs use canonical URLs without tracking parameters; duplicates preserve first-source attribution and first collection time.

## Provider behavior

- **News:** `feedparser` handles RSS/Atom; `httpx` fetches with ETag/Last-Modified and 304 support. Store publisher-provided summaries, not fabricated full text. Starter feeds are DR Udland, DR Indland, BBC Europe, and Guardian Russia.
- **Scrapling:** base parser only, used for feed HTML cleanup and public Telegram extraction. Browser fetchers require the separate `fetchers` extra and browser installation; do not import them from a parser-only install.
- **Telegram public:** fetch `t.me/s/<username>`, extract visible text posts and actual timestamps. This is a recent preview, not complete history.
- **Telegram account:** optional Telethon extra, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and a local session. First poll takes recent posts; later polls use `min_id` and oldest-first order so bounded batches can catch up without advancing past unread posts. No sign-in prompts in the worker.
- **YouTube:** optional `youtube` extra provides yt-dlp + its default/EJS dependencies and youtube-transcript-api. Node is enabled as the installed JS runtime. Video/channel URLs are accepted; at most five videos and 200 comments per video per run. Metadata/watch links are stored, not video binaries.
- Caption statuses are available/unavailable/blocked/error. Preserve language, generated-caption flag, and time-coded segments. Do not treat missing/blocked captions as a successful empty transcript. Optional cookies belong to yt-dlp; transcript-library cookie authentication is not assumed to work.
- **X:** optional Twikit extra. Load only the operator's local Twikit-format cookie file; profiles and Latest queries have bounded recent-window coverage. It is unofficial and best-effort. Authentication/lock errors become setup-needed, rate limits back off. No paid X API is connected.
- Interactive local setup: `uv run --all-extras --env-file .env python -m app.features.collection.auth telegram` or `... auth x`. Sessions/cookies are ignored by Git. Never read browser credentials automatically.

## Data and HTTP invariants

- Item timestamps are timezone-aware UTC; unknown publication times remain null. Keep coarse YouTube upload days in metadata instead of fabricating midnight timestamps.
- Keyword filtering is case-insensitive substring matching across titles, source text, captions, and captured comments. Denmark connection is a keyword hint, not geopolitical classification.
- Public URLs are validated; the HTTP helper checks DNS addresses and redirect destinations, rejects private destinations, and bounds decoded responses to 4 MB. The operator API is a local workflow, not an authenticated multi-user deployment.
- **Compression regression:** `httpx.aiter_bytes()` already decompresses responses. When rebuilding a buffered Response, remove `Content-Encoding` and `Content-Length`; retaining them caused every live RSS source to fail with DecodingError.
- `/api/collection/items` returns paginated summaries; `/items/{id}` returns the full record. Avoid shipping caption/comment payloads in the list response.

## Verified workflow

- `uv sync --all-extras`; `uv run --all-extras python -m unittest discover -s tests -v`.
- Frontend: `npm run build`, `npm run lint`, `npm run test:e2e`.
- Tests exercise queue-to-ingestion flow, keyword search, URL validation, compression, deduplication, retry/checkpoint preservation, leases, Telegram catch-up, YouTube caption/comment normalization, and X profile/search dispatch. Use temporary stores and mocked account clients.
- Live verification on 2026-10-01 succeeded for all four starter news feeds, an official public Telegram preview, and one YouTube video with captions and a comment. X and authenticated Telegram still need the operator's own session to verify live access.
- Detailed setup, cadence guidance, and research links: `docs/collectors.md`.
