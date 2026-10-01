import json
import sqlite3
from contextlib import closing
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from app.features.collection.connectors.common import item_text
from app.features.collection.schemas import Feed, Item, ItemSummary, Run, Source, SourceConfig, SourcePatch


class Store:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self.connect()) as connection:
            connection.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS sources (
                    id TEXT PRIMARY KEY, provider TEXT NOT NULL, target TEXT NOT NULL,
                    config TEXT NOT NULL, cursor TEXT NOT NULL DEFAULT '{}', enabled INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'never_run', next_run_at TEXT NOT NULL, last_run_at TEXT,
                    last_error TEXT, last_note TEXT, failures INTEGER NOT NULL DEFAULT 0,
                    lease_until TEXT, run_requested INTEGER NOT NULL DEFAULT 0, UNIQUE(provider, target)
                );
                CREATE TABLE IF NOT EXISTS items (
                    id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
                    published_at TEXT NOT NULL, payload TEXT NOT NULL, search_text TEXT NOT NULL,
                    denmark_related INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS items_source ON items(source_id);
                CREATE INDEX IF NOT EXISTS items_date ON items(published_at DESC, id);
                CREATE TABLE IF NOT EXISTS runs (
                    id INTEGER PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
                    started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL,
                    fetched INTEGER NOT NULL DEFAULT 0, added INTEGER NOT NULL DEFAULT 0, note TEXT
                );
                CREATE TABLE IF NOT EXISTS worker (id INTEGER PRIMARY KEY CHECK(id=1), last_seen TEXT NOT NULL);
            """)

    def connect(self):
        connection = sqlite3.connect(self.path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def sources(self) -> list[Source]:
        with closing(self.connect()) as connection:
            rows = connection.execute("SELECT *, (SELECT count(*) FROM items WHERE source_id=sources.id) AS item_count FROM sources ORDER BY rowid").fetchall()
        return [self._source(row) for row in rows]

    def source(self, source_id: str) -> Source:
        return next(source for source in self.sources() if source.id == source_id)

    @staticmethod
    def _source(row) -> Source:
        status = row["status"]
        if not row["enabled"] and status not in {"running", "queued"}:
            status = "paused"
        return Source(**json.loads(row["config"]), id=row["id"], status=status,
                      item_count=row["item_count"], last_run_at=row["last_run_at"], next_run_at=row["next_run_at"],
                      last_error=row["last_error"], last_note=row["last_note"], failures=row["failures"], cursor=json.loads(row["cursor"]))

    def create(self, config: SourceConfig, source_id: str | None = None) -> Source:
        source_id = source_id or uuid4().hex[:12]
        with closing(self.connect()) as connection, connection:
            connection.execute("INSERT INTO sources (id,provider,target,config,enabled,next_run_at) VALUES (?,?,?,?,?,?)",
                               (source_id, config.provider, config.target, config.model_dump_json(), config.enabled, datetime.now(UTC).isoformat()))
        return self.source(source_id)

    def patch(self, source_id: str, patch: SourcePatch) -> Source:
        source = self.source(source_id)
        config = SourceConfig.model_validate({**{key: getattr(source, key) for key in SourceConfig.model_fields}, **patch.model_dump(exclude_unset=True)})
        with closing(self.connect()) as connection, connection:
            cursor = {} if source.provider == "rss" and {"keywords", "item_limit"}.intersection(patch.model_fields_set) else source.cursor
            timestamp = datetime.now(UTC).isoformat()
            changed = connection.execute("""UPDATE sources SET config=?,enabled=?,cursor=?,next_run_at=?
                WHERE id=? AND (lease_until IS NULL OR lease_until<=?)""",
                (config.model_dump_json(), config.enabled, json.dumps(cursor), timestamp, source_id, timestamp)).rowcount
            if not changed:
                raise RuntimeError("Wait for the current collection to finish before editing this source.")
        return self.source(source_id)

    def request_run(self, source_id: str) -> Source:
        self.source(source_id)
        with closing(self.connect()) as connection, connection:
            changed = connection.execute("UPDATE sources SET run_requested=1,status='queued' WHERE id=? AND (lease_until IS NULL OR lease_until<=?)",
                                         (source_id, datetime.now(UTC).isoformat())).rowcount
        if not changed:
            raise RuntimeError("This source is already being collected.")
        return self.source(source_id)

    def claim(self, now: datetime) -> tuple[Source, int] | None:
        timestamp = now.isoformat()
        with closing(self.connect()) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("""SELECT id FROM sources WHERE
                (run_requested=1 OR (enabled=1 AND next_run_at<=?)) AND (lease_until IS NULL OR lease_until<=?)
                ORDER BY run_requested DESC, next_run_at LIMIT 1""", (timestamp, timestamp)).fetchone()
            if not row:
                return None
            source_id = row["id"]
            # Recover an interrupted run when its lease expires.
            connection.execute("UPDATE runs SET status='interrupted',finished_at=?,note='Worker lease expired; retrying.' WHERE source_id=? AND finished_at IS NULL", (timestamp, source_id))
            connection.execute("UPDATE sources SET lease_until=?,status='running',run_requested=0 WHERE id=?", ((now + timedelta(minutes=5)).isoformat(), source_id))
            run_id = connection.execute("INSERT INTO runs (source_id,started_at,status) VALUES (?,?,'running')", (source_id, timestamp)).lastrowid
        return self.source(source_id), run_id

    def finish(self, source: Source, run_id: int, items: list[Item], *, cursor: dict, note: str | None = None,
               error: str | None = None, setup: bool = False, retry_after: int = 0, fetched: int | None = None):
        now = datetime.now(UTC)
        failures = source.failures + 1 if error else 0
        delay = max(source.interval_seconds, retry_after, 3600 if setup else 0)
        if error:
            delay = max(delay, min(21600, source.interval_seconds * 2 ** min(failures, 8)))
        status = "needs_setup" if setup else "error" if error else "ok"
        with closing(self.connect()) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            if not connection.execute("SELECT id FROM runs WHERE id=? AND source_id=? AND finished_at IS NULL", (run_id, source.id)).fetchone():
                return
            added = 0
            for item in items:
                added += connection.execute("""INSERT OR IGNORE INTO items (id,source_id,published_at,payload,search_text,denmark_related)
                    VALUES (?,?,?,?,?,?)""", (item.id, item.source_id, (item.published_at or item.collected_at).isoformat(), item.model_dump_json(),
                    item_text(item), item.denmark_related)).rowcount
                # Preserve first-source attribution and first collection time on subsequent refreshes.
                connection.execute("""UPDATE items SET payload=json_set(?, '$.source_id',source_id,'$.collected_at',json_extract(payload,'$.collected_at')),
                    search_text=?,denmark_related=?,published_at=COALESCE(json_extract(?,'$.published_at'),published_at) WHERE id=?""",
                    (item.model_dump_json(), item_text(item), item.denmark_related, item.model_dump_json(), item.id))
            connection.execute("UPDATE runs SET status=?,finished_at=?,fetched=?,added=?,note=? WHERE id=?",
                               (status, now.isoformat(), len(items) if fetched is None else fetched, added, error or note, run_id))
            connection.execute("""UPDATE sources SET status=?,last_run_at=?,last_error=?,last_note=?,failures=?,
                next_run_at=?,lease_until=NULL,cursor=? WHERE id=?""", (status, now.isoformat(), error, note, failures,
                (now + timedelta(seconds=delay)).isoformat(), json.dumps(source.cursor if error else cursor), source.id))

    def feed(self, *, query: str = "", provider: str | None = None, source_id: str | None = None,
             denmark_only: bool = False, limit: int = 25, offset: int = 0) -> Feed:
        where, parameters = ["1=1"], []
        if query:
            where.append("search_text LIKE ? ESCAPE '\\'")
            escaped = query.casefold().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            parameters.append(f"%{escaped}%")
        if provider:
            where.append("json_extract(payload,'$.provider')=?")
            parameters.append(provider)
        if source_id:
            where.append("source_id=?")
            parameters.append(source_id)
        if denmark_only:
            where.append("denmark_related=1")
        condition = " AND ".join(where)
        with closing(self.connect()) as connection:
            total = connection.execute(f"SELECT count(*) FROM items WHERE {condition}", parameters).fetchone()[0]
            rows = connection.execute(f"SELECT payload FROM items WHERE {condition} ORDER BY published_at DESC,id LIMIT ? OFFSET ?", [*parameters, limit, offset]).fetchall()
        summaries = []
        for row in rows:
            item = Item.model_validate_json(row[0])
            fields = item.model_dump(include={"id", "source_id", "provider", "url", "title", "published_at", "collected_at", "author", "keywords", "denmark_related"})
            summaries.append(ItemSummary(**fields, excerpt=item.text[:500], transcript_status=item.transcript.status if item.transcript else None, comment_count=len(item.comments)))
        return Feed(items=summaries, total=total, limit=limit, offset=offset)

    def item(self, item_id: str) -> Item:
        with closing(self.connect()) as connection:
            row = connection.execute("SELECT payload FROM items WHERE id=?", (item_id,)).fetchone()
        if not row:
            raise LookupError(item_id)
        return Item.model_validate_json(row[0])

    def runs(self) -> list[Run]:
        with closing(self.connect()) as connection:
            rows = connection.execute("SELECT runs.*,json_extract(sources.config,'$.name') AS source_name FROM runs JOIN sources ON sources.id=runs.source_id ORDER BY id DESC LIMIT 20").fetchall()
        return [Run(**dict(row)) for row in rows]

    def item_count(self) -> int:
        with closing(self.connect()) as connection:
            return connection.execute("SELECT count(*) FROM items").fetchone()[0]

    def heartbeat(self):
        with closing(self.connect()) as connection, connection:
            connection.execute("INSERT INTO worker VALUES (1,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen", (datetime.now(UTC).isoformat(),))

    def worker_last_seen(self) -> datetime | None:
        with closing(self.connect()) as connection:
            row = connection.execute("SELECT last_seen FROM worker WHERE id=1").fetchone()
        return datetime.fromisoformat(row[0]) if row else None
