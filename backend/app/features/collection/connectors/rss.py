from datetime import UTC, datetime

import feedparser

from app.features.collection.connectors.common import CollectionError, Result, canonical_url, clean_html, make_item
from app.features.collection.connectors.network import fetch
from app.features.collection.schemas import Source, public_url


async def collect(source: Source) -> Result:
    headers = {}
    if source.cursor.get("etag"):
        headers["If-None-Match"] = source.cursor["etag"]
    if source.cursor.get("last_modified"):
        headers["If-Modified-Since"] = source.cursor["last_modified"]
    response = await fetch(source.target, headers)
    if response.status_code == 304:
        return Result([], source.cursor, "Feed unchanged (HTTP 304).", source.cursor.get("minimum_interval", 0))
    parsed = feedparser.parse(response.content)
    if not parsed.version or (parsed.bozo and not parsed.entries):
        raise CollectionError("The source did not return a readable RSS or Atom feed.")
    items = []
    skipped = 0
    for entry in parsed.entries[:source.item_limit]:
        try:
            url = canonical_url(public_url(entry.get("link", "")))
        except ValueError:
            skipped += 1
            continue
        title = clean_html(entry.get("title", ""))
        if not title:
            skipped += 1
            continue
        published = entry.get("published_parsed") or entry.get("updated_parsed")
        items.append(make_item(source, url, url, title, clean_html(entry.get("summary", "")),
            published_at=datetime(*published[:6], tzinfo=UTC) if published else None,
            author=entry.get("author"), metadata={"feed_title": parsed.feed.get("title"), "content_scope": "publisher feed summary"}))
    ttl = str(parsed.feed.get("ttl", ""))
    minimum_interval = int(ttl) * 60 if ttl.isdigit() else 0
    cursor = {"etag": response.headers.get("etag"), "last_modified": response.headers.get("last-modified"), "minimum_interval": minimum_interval}
    note = f"Read {len(items)} recent feed entries; {skipped} invalid entries skipped."
    if minimum_interval:
        note += f" Publisher feed TTL: {minimum_interval // 60} min."
    return Result(items, cursor, note, minimum_interval)
