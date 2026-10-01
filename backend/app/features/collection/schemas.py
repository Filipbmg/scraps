import re
import ipaddress
from datetime import UTC, datetime
from typing import Any, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

Provider = Literal["rss", "telegram", "youtube", "x"]
Status = Literal["never_run", "queued", "running", "ok", "error", "needs_setup", "paused"]


def public_url(value: str) -> str:
    url = HttpUrl(value)
    host = (url.host or "").lower().rstrip(".")
    if url.username or url.password or host == "localhost" or host.endswith((".localhost", ".local")):
        raise ValueError("Use a public HTTP(S) URL without embedded credentials.")
    try:
        address = ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        address = None
    if address and not address.is_global:
        raise ValueError("Use a public internet address.")
    return str(url)


class SourceConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    provider: Provider
    name: str = Field(min_length=1, max_length=100)
    target: str = Field(min_length=1, max_length=2048)
    interval_seconds: int = Field(default=3600, ge=60, le=604800)
    enabled: bool = True
    keywords: list[str] = Field(default_factory=list, max_length=30)
    item_limit: int = Field(default=20, ge=1, le=100)
    telegram_access: Literal["public", "account"] = "public"
    x_mode: Literal["profile", "search"] = "profile"
    comment_limit: int = Field(default=40, ge=0, le=200)
    transcript_languages: list[str] = Field(default_factory=lambda: ["da", "en", "ru"], min_length=1, max_length=10)

    @model_validator(mode="after")
    def validate_target(self):
        if any(not keyword.strip() or len(keyword) > 80 for keyword in self.keywords):
            raise ValueError("Keywords must contain 1–80 characters each.")
        self.keywords = list(dict.fromkeys(keyword.strip() for keyword in self.keywords))
        if any(not re.fullmatch(r"[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})?", language) for language in self.transcript_languages):
            raise ValueError("Use language codes such as da, en, or ru.")
        if self.provider == "rss":
            self.target = public_url(self.target)
        elif self.provider == "telegram":
            channel = self.target.removeprefix("https://t.me/").removeprefix("s/").strip("/@")
            if not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_]{3,31}", channel):
                raise ValueError("Use a public Telegram channel username or its t.me link.")
            self.target = channel.lower()
        elif self.provider == "youtube":
            self.target = public_url(self.target)
            if urlsplit(self.target).hostname not in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}:
                raise ValueError("Use a youtube.com video/channel URL or a youtu.be video link.")
            if "item_limit" not in self.model_fields_set:
                self.item_limit = 2
            if self.item_limit > 5:
                raise ValueError("YouTube sources collect at most 5 videos per run. Start with 2.")
        elif self.x_mode == "profile":
            handle = self.target.removeprefix("https://x.com/").removeprefix("https://twitter.com/").strip("/@")
            if not re.fullmatch(r"[a-zA-Z0-9_]{1,15}", handle):
                raise ValueError("Use an X profile handle, such as @example.")
            self.target = handle.lower()
        elif len(self.target) > 512:
            raise ValueError("X search queries must be at most 512 characters.")
        return self


class SourcePatch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=100)
    interval_seconds: int | None = Field(default=None, ge=60, le=604800)
    enabled: bool | None = None
    keywords: list[str] | None = Field(default=None, max_length=30)
    item_limit: int | None = Field(default=None, ge=1, le=100)
    telegram_access: Literal["public", "account"] | None = None
    comment_limit: int | None = Field(default=None, ge=0, le=200)
    transcript_languages: list[str] | None = Field(default=None, min_length=1, max_length=10)


class Source(SourceConfig):
    id: str
    status: Status
    item_count: int
    last_run_at: datetime | None
    next_run_at: datetime
    last_error: str | None
    last_note: str | None
    failures: int
    cursor: dict[str, Any] = Field(default_factory=dict, exclude=True)


class Transcript(BaseModel):
    status: Literal["available", "unavailable", "blocked", "error"]
    language: str | None = None
    generated: bool | None = None
    text: str = ""
    segments: list[dict[str, Any]] = Field(default_factory=list)
    note: str | None = None


class Comment(BaseModel):
    id: str
    text: str
    author: str | None = None
    likes: int | None = None
    published_at: datetime | None = None


class Item(BaseModel):
    id: str
    source_id: str
    provider: Provider
    external_id: str
    url: HttpUrl
    title: str
    text: str
    published_at: datetime | None = None
    collected_at: datetime
    author: str | None = None
    keywords: list[str] = Field(default_factory=list)
    denmark_related: bool = False
    transcript: Transcript | None = None
    comments: list[Comment] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("published_at", "collected_at")
    @classmethod
    def normalize_time(cls, value):
        if value is not None:
            if value.utcoffset() is None:
                raise ValueError("Collection timestamps must include a timezone.")
            return value.astimezone(UTC)
        return value


class Run(BaseModel):
    id: int
    source_id: str
    source_name: str
    started_at: datetime
    finished_at: datetime | None
    status: str
    fetched: int
    added: int
    note: str | None


class Capability(BaseModel):
    provider: Provider
    installed: bool
    credentials_configured: bool
    note: str


class Workspace(BaseModel):
    sources: list[Source]
    runs: list[Run]
    capabilities: list[Capability]
    worker_running: bool
    worker_last_seen: datetime | None
    item_count: int


class ItemSummary(BaseModel):
    id: str
    source_id: str
    provider: Provider
    url: HttpUrl
    title: str
    excerpt: str
    published_at: datetime | None
    collected_at: datetime
    author: str | None
    keywords: list[str]
    denmark_related: bool
    transcript_status: str | None
    comment_count: int


class Feed(BaseModel):
    items: list[ItemSummary]
    total: int
    limit: int
    offset: int
