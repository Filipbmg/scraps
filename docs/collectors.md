# Collectors: low-cost ingestion for Snowdrop

Research and live checks: **1 October 2026**.

## Recommended stack

| Need | First choice | Cost | Starting cadence |
| --- | --- | --- | --- |
| Major news/current events | Publisher RSS/Atom + `httpx` + `feedparser` | No API fee | 60 minutes; 15–30 minutes for priority feeds |
| Public Telegram previews | `httpx` + Scrapling parser | No account/API fee | 5–15 minutes |
| Reliable Telegram channel collection | Telethon / Telegram MTProto | No API fee; your own account/app credentials | 1–5 minutes for priority channels; 15–60 minutes otherwise |
| YouTube metadata, captions, comments | yt-dlp + youtube-transcript-api | No API fee; local compute/network | 30–60 minutes per channel; 15 minutes for priority targets |
| X profiles and keyword queries | Twikit with your own saved session | No API fee; maintenance may be needed | Start at 15–30 minutes; adjust to activity and rate limits |
| Storage / scheduling | SQLite + separate asyncio worker | Local machine; no additional hosted service required | Per-source persisted schedules |

The API, worker, provider adapters, storage, and frontend collection feature have separate ownership. No LLM is required for ingestion. The software can run on an existing computer without a subscription; hosting, storage, bandwidth, and any future proxy service are separate costs.

### Scrapling

[Scrapling](https://github.com/d4vinci/Scrapling) is a useful HTML extraction layer: CSS/XPath selection, adaptive element relocation, HTTP/browser fetchers, and a larger spider framework. Its base install includes the **parser**, while fetchers/spiders require `scrapling[fetchers]`; browser modes also need browser installation.

Snowdrop currently uses the parser for RSS HTML cleanup and public Telegram pages. Platform-specific APIs/libraries handle account-mode Telegram, YouTube captions/comments, and authenticated X collection. That keeps browser automation and proxy costs out of the initial path. Add a publisher-specific Scrapling fetcher when an actual source needs HTML or JavaScript rendering.

### X: free vs official

You selected the free, best-effort route. Twikit uses your own authenticated session and supports profile reads and Latest keyword search. Its unofficial endpoints and sign-in flow can change; the UI records failures, session problems, and rate-limit retries rather than silently reporting success.

The [official X pricing documentation](https://docs.x.com/x-api/getting-started/pricing) currently lists **$0.005 per returned post**: approximately **$5 per 1,000 post reads**, before other resource charges. Daily deduplication is described as a soft guarantee. No official paid X API is connected to this project.

### YouTube: captions are not always available

You selected metadata-first collection: watch links, title/description, author, available captions, and a bounded set of newest comments. At most five videos are processed per run; start with two. Comments can be disabled or unavailable, and captions may be missing, in an unrequested language, or blocked by the network. Their status is stored and shown explicitly.

For reliable metadata/comment collection at larger scale, the [official YouTube Data API](https://developers.google.com/youtube/v3/determine_quota_cost) is another quota-based option. As of the research date, its documentation describes 10,000 daily units for most endpoints and separate daily search/upload buckets. It is not used by the current adapter. Local speech-to-text can be added for videos without captions when audio processing and its compute/storage costs become part of the requirement.

## Run the platform

From `backend/`:

```bash
uv sync --all-extras
```

The `telegram`, `youtube`, and `x` extras install their provider libraries. A base install is sufficient for RSS and public Telegram previews.

**API — terminal 1:**

```bash
uv run --all-extras uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Collector worker — terminal 2:**

```bash
uv run --all-extras python -m app.features.collection.worker
```

**Frontend — terminal 3, from `frontend/`:**

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Use **Collectors** to add/edit sources, set intervals and limits, pause/resume, or queue a run. Use **Collected feed** for actual records. The existing Overview/Mentions/Sources/Saved views remain labeled sample analytics.

Run one collector worker per workspace. The API can stay available when the worker is stopped; queued runs wait. Worker status is derived from its persisted heartbeat.

## Starter Russia / Denmark news sources

Four verified public feeds are created on first use:

- **DR Udland:** https://www.dr.dk/nyheder/service/feeds/udland
- **DR Indland:** https://www.dr.dk/nyheder/service/feeds/indland
- **BBC Europe:** https://feeds.bbci.co.uk/news/world/europe/rss.xml
- **Guardian Russia:** https://www.theguardian.com/world/russia/rss

DR and BBC presets keep English/Danish Russia-related keyword matches. Guardian's feed is already Russia-focused. Every preset starts with hourly polling and a recent-entry limit of 20; edit these separately.

The **Denmark connection** filter looks for words such as Denmark/Danmark, Danish/dansk, Copenhagen/København, Bornholm, Greenland/Grønland, and Faroe/Færø. It is a keyword hint, including relevant Danish territories, not a relevance model or factual assessment. Search the feed for more specific events and actors. RSS records contain the publisher-provided text/summary and original URL, not guaranteed full articles.

## Telegram setup

### Public mode

Add a Telegram source using `@channelname` or `https://t.me/channelname`, with **Public web preview** selected. No credentials are needed. It captures recent visible text posts, including captions; it does not promise complete history or download media files.

### Account mode

1. Create your own application at https://my.telegram.org and obtain its API ID/hash.
2. Copy `backend/.env.example` to `backend/.env`, then fill in `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` locally.
3. From `backend/`, sign in interactively:

```bash
uv run --all-extras --env-file .env python -m app.features.collection.auth telegram
```

The phone, login code, and any two-factor password are entered in your own terminal. The default session path is `backend/data/telegram.session`.

Start **both** API and worker with the same environment:

```bash
uv run --all-extras --env-file .env uvicorn app.main:app --host 127.0.0.1 --port 8000
uv run --all-extras --env-file .env python -m app.features.collection.worker
```

Select **Telegram account** on the source. After the initial recent window, new messages are fetched oldest-first from the saved checkpoint. Flood waits delay the next run. An expired session is reported as setup-needed; the background worker never prompts for credentials.

## X setup

Install the X extra (included by `--all-extras`), then authenticate locally:

```bash
uv run --all-extras python -m app.features.collection.auth x
```

The default saved session is `backend/data/x-cookies.json`. If Twikit's sign-in flow is unavailable, provide your own Twikit-format JSON session through `X_COOKIES_FILE` in `.env`, with the `auth_token` and `ct0` cookie values. Snowdrop never imports browser cookies automatically. Use the same `.env` for the API and worker.

Add either:

- **Profile:** `@profile` or `https://x.com/profile`.
- **Keyword search:** for example `(Russia OR Rusland OR russisk) (Denmark OR Danmark OR dansk)`.

The adapter collects a bounded recent window, up to your item limit, rather than a complete historical archive. Choose cadence/limits based on post volume. Rate limits are recorded and backed off; invalid/locked sessions require local attention.

## YouTube setup

The YouTube extra includes yt-dlp's default dependencies and EJS support. The adapter enables Node as its JavaScript runtime; Node is already a frontend prerequisite.

Add a video URL, `youtu.be` link, or channel `/videos` URL. Set videos per run, comments per video, and caption-language priority (default `da, en, ru`). Use zero comments to skip comment requests.

Optional `YOUTUBE_COOKIES_FILE` points to your own Netscape-format cookie file for yt-dlp requests needing sign-in. Caption fetching uses youtube-transcript-api independently; its cookie-authentication support is not assumed. Keep source limits low before increasing frequency. `uv.lock` pins the verified yt-dlp build; update it deliberately if YouTube changes its extraction behavior.

## Persistence and scheduling

- Data directory: `backend/data/`, overridable with `SNOWDROP_DATA_DIR` (use the same absolute path in both processes).
- SQLite stores sources, schedules, checkpoints, items, worker heartbeat, and recent run outcomes.
- Two jobs can run concurrently; account-mode Telegram reads are serialized within the worker.
- Minimum configured interval is one minute. Publisher RSS TTL, Retry-After, flood waits, and exponential backoff may delay the actual next check. The source card shows its next scheduled time.
- Paused sources keep their records. Manually queued runs can execute while the automatic schedule is paused.
- Five-minute leases recover interrupted jobs. Provider/job failures do not erase previous records or advance checkpoints.
- Repeated items are deduplicated. Refreshes preserve first collection time and original attribution.
- List responses are lightweight summaries; full text, captions, and comments load on opening a record.
- Credentials, session files, cookies, database files, generated assets, and captured data are excluded from Git.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/collection` | Sources, recent runs, connector setup information, worker status, record count |
| POST | `/api/collection/sources` | Add a validated source |
| PATCH | `/api/collection/sources/{id}` | Change cadence, limits, keywords, access mode, or enabled state |
| POST | `/api/collection/sources/{id}/run` | Queue a run; returns 202, not a promise of completion |
| GET | `/api/collection/items` | Paginated/searchable records; platform, source, and Denmark filters |
| GET | `/api/collection/items/{id}` | Full original record, caption status/text, and captured comments |

Interactive schemas: http://127.0.0.1:8000/docs.

## Verification

```bash
# backend/
uv run --all-extras python -m unittest discover -s tests -v

# frontend/
npm run build
npm run lint
npm run test:e2e
```

Automated checks cover API ingestion, deduplication, UTF-8 search, scheduling/retries/checkpoints, leases, HTTP compression, URL validation, Telegram cursor handling, YouTube captions/comments, and X profile/search dispatch. Browser checks cover per-source intervals, editing, pause/queue behavior, feed filters, details, themes, and mobile layouts. Account clients are mocked; these checks do not use real sessions.

Live probes on the research date succeeded for all four starter news feeds, a public Telegram preview, and one YouTube video with captions/comments. Authenticated Telegram and X require your own credentials/session for a live check.

## Primary references

- Scrapling: https://github.com/d4vinci/Scrapling and https://scrapling.readthedocs.io/
- Telethon sign-in: https://docs.telethon.dev/en/stable/basic/signing-in.html
- yt-dlp: https://github.com/yt-dlp/yt-dlp
- youtube-transcript-api: https://github.com/jdepoix/youtube-transcript-api
- Twikit: https://github.com/d60/twikit
- X official pricing: https://docs.x.com/x-api/getting-started/pricing
- YouTube quotas: https://developers.google.com/youtube/v3/determine_quota_cost
