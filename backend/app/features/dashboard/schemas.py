from typing import Literal

from pydantic import BaseModel, HttpUrl

SourceKind = Literal["News", "Social", "Blogs", "Forums"]
Sentiment = Literal["positive", "neutral", "negative"]


class Metric(BaseModel):
    label: str
    value: str
    change: str
    detail: str
    icon: Literal["mentions", "sources", "sentiment", "reach"]
    sparkline: list[int]


class TrendPoint(BaseModel):
    label: str
    news: int
    social: int
    other: int


class SentimentBreakdown(BaseModel):
    positive: int
    neutral: int
    negative: int


class Period(BaseModel):
    metrics: list[Metric]
    trend: list[TrendPoint]
    sentiment: SentimentBreakdown
    mentions: int
    change: str


class Source(BaseModel):
    id: str
    name: str
    kind: SourceKind
    mark: str
    color: str
    mentions: int
    url: HttpUrl


class Mention(BaseModel):
    id: str
    source_id: str
    title: str
    excerpt: str
    published_at: str
    sentiment: Sentiment
    keywords: list[str]
    saved: bool = False


class Activity(BaseModel):
    id: str
    title: str
    description: str
    time: str


class Dashboard(BaseModel):
    mode: Literal["demo"]
    updated_at: str
    periods: dict[Literal["7d", "30d"], Period]
    sources: list[Source]
    mentions: list[Mention]
    activity: list[Activity]
