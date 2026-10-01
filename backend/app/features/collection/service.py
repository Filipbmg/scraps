import asyncio
import importlib.util
import logging
import os
import sqlite3
from datetime import UTC, datetime
from functools import lru_cache

from app.features.collection.connectors import rss, telegram, x, youtube
from app.features.collection.connectors.common import CollectionError, item_text
from app.features.collection.presets import DENMARK_TERMS, NEWS_PRESETS
from app.features.collection.schemas import Capability, Source, Workspace
from app.features.collection.settings import data_directory, telegram_session, x_cookies
from app.features.collection.store import Store

logger = logging.getLogger(__name__)
COLLECTORS = {"rss": rss.collect, "telegram": telegram.collect, "youtube": youtube.collect, "x": x.collect}


@lru_cache(maxsize=1)
def get_store() -> Store:
    store = Store(data_directory() / "snowdrop.sqlite3")
    for source_id, config in NEWS_PRESETS:
        try:
            store.create(config, source_id)
        except sqlite3.IntegrityError:
            pass
    return store


def capabilities() -> list[Capability]:
    return [
        Capability(provider="rss", installed=True, credentials_configured=True, note="RSS/Atom feeds need no API key. Publisher summaries, not full paid articles."),
        Capability(provider="telegram", installed=True, credentials_configured=bool(os.getenv("TELEGRAM_API_ID") and os.getenv("TELEGRAM_API_HASH") and telegram_session().is_file()),
                   note="Public previews work without sign-in. Account mode needs the Telegram extra, API ID/hash, and a local session."),
        Capability(provider="youtube", installed=importlib.util.find_spec("yt_dlp") is not None and importlib.util.find_spec("youtube_transcript_api") is not None,
                   credentials_configured=True, note="Metadata, caption tracks, and bounded comments. No video downloads. Captions can be missing or blocked."),
        Capability(provider="x", installed=importlib.util.find_spec("twikit") is not None, credentials_configured=x_cookies().is_file(),
                   note="Free Twikit collector. Requires your own local X session; unofficial and best-effort."),
    ]


def workspace(store: Store) -> Workspace:
    last_seen = store.worker_last_seen()
    age = (datetime.now(UTC) - last_seen).total_seconds() if last_seen else None
    return Workspace(sources=store.sources(), runs=store.runs(), capabilities=capabilities(),
                     worker_running=age is not None and 0 <= age < 15, worker_last_seen=last_seen, item_count=store.item_count())


async def collect_source(store: Store, source: Source, run_id: int):
    try:
        result = await asyncio.wait_for(COLLECTORS[source.provider](source), timeout=180)
        matched = []
        for item in result.items:
            text = item_text(item)
            item.keywords = [keyword for keyword in source.keywords if keyword.casefold() in text]
            if source.keywords and not item.keywords:
                continue
            item.denmark_related = any(term in text for term in DENMARK_TERMS)
            matched.append(item)
        note = f"{len(matched)} matched / {len(result.items)} fetched. {result.note or ''}".strip()
        store.finish(source, run_id, matched, cursor=result.cursor, note=note, fetched=len(result.items), retry_after=result.minimum_interval)
        logger.info("%s: %s", source.name, note)
    except CollectionError as error:
        store.finish(source, run_id, [], cursor=source.cursor, error=str(error), setup=error.setup, retry_after=error.retry_after)
        logger.warning("%s: %s", source.name, error)
    except TimeoutError:
        store.finish(source, run_id, [], cursor=source.cursor, error="Collection exceeded the three-minute job deadline. Reduce the item/comment limit or check source access.")
    except Exception as error:
        # Provider exceptions can contain session details; expose the class, never raw cookies or response bodies.
        message = f"Collection failed ({type(error).__name__}). Check the source URL, network, and connector setup."
        store.finish(source, run_id, [], cursor=source.cursor, error=message)
        logger.warning("%s: %s", source.name, message)
