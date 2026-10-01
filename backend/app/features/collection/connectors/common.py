from dataclasses import dataclass, field
from datetime import UTC, datetime
from hashlib import sha256
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from scrapling.parser import Selector

from app.features.collection.schemas import Item, Source


class CollectionError(Exception):
    def __init__(self, message: str, *, setup: bool = False, retry_after: int = 0):
        super().__init__(message)
        self.setup = setup
        self.retry_after = retry_after


@dataclass
class Result:
    items: list[Item]
    cursor: dict[str, Any] = field(default_factory=dict)
    note: str | None = None
    minimum_interval: int = 0


def clean_html(markup: str) -> str:
    return " ".join(Selector(markup or "<span></span>").get_all_text(separator=" ", strip=True).split())


def canonical_url(url: str) -> str:
    parts = urlsplit(url)
    query = [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True)
             if not key.lower().startswith(("utm_", "at_")) and key.lower() not in {"fbclid", "gclid"}]
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path, urlencode(query), ""))


def make_item(source: Source, external_id: str, url: str, title: str, text: str, **kwargs) -> Item:
    return Item(
        id=sha256(f"{source.provider}:{external_id}".encode()).hexdigest()[:32],
        source_id=source.id, provider=source.provider, external_id=external_id,
        url=url, title=title, text=text, collected_at=datetime.now(UTC), **kwargs,
    )


def item_text(item: Item) -> str:
    return " ".join([item.title, item.text, item.author or "", item.transcript.text if item.transcript else "",
                     *(comment.text for comment in item.comments)]).casefold()
