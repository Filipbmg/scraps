import asyncio
import os
import re
from datetime import UTC, datetime
from itertools import islice
from pathlib import Path

from app.features.collection.connectors.common import CollectionError, Result, make_item
from app.features.collection.schemas import Comment, Source, Transcript


def fetch_transcript(video_id: str, languages: list[str]) -> Transcript:
    from requests import Session
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import IpBlocked, NoTranscriptFound, RequestBlocked, TranscriptsDisabled

    class TimedSession(Session):
        def request(self, *args, **kwargs):
            kwargs.setdefault("timeout", (5, 20))
            return super().request(*args, **kwargs)

    try:
        with TimedSession() as session:
            transcript = YouTubeTranscriptApi(http_client=session).fetch(video_id, languages=languages)
        segments = transcript.to_raw_data()[:10000]
        return Transcript(status="available", language=transcript.language_code, generated=transcript.is_generated,
                          text="\n".join(segment["text"] for segment in segments), segments=segments,
                          note="Limited to the first 10,000 caption segments." if len(transcript) > 10000 else None)
    except (NoTranscriptFound, TranscriptsDisabled):
        return Transcript(status="unavailable", note="No caption track was available in the selected languages.")
    except (RequestBlocked, IpBlocked):
        return Transcript(status="blocked", note="YouTube blocked transcript access from this network.")
    except Exception as error:
        return Transcript(status="error", note=f"Transcript request failed ({type(error).__name__}); metadata is still available.")


def collect_sync(source: Source) -> Result:
    try:
        from yt_dlp import YoutubeDL
        from youtube_transcript_api import YouTubeTranscriptApi  # noqa: F401 - verify the optional extra is installed
    except ImportError:
        raise CollectionError("Install YouTube support with: uv sync --extra youtube", setup=True) from None
    options = {"quiet": True, "no_warnings": True, "skip_download": True, "socket_timeout": 15,
               "retries": 1, "extractor_retries": 1, "playlistend": source.item_limit,
               "js_runtimes": {"node": {}}, "noplaylist": True}
    cookies = os.getenv("YOUTUBE_COOKIES_FILE")
    if cookies:
        if not Path(cookies).expanduser().is_file():
            raise CollectionError("YOUTUBE_COOKIES_FILE does not point to a readable cookie file.", setup=True)
        options["cookiefile"] = str(Path(cookies).expanduser())
    with YoutubeDL({**options, "extract_flat": "in_playlist", "lazy_playlist": True}) as downloader:
        overview = downloader.extract_info(source.target, download=False)
    if not overview:
        raise CollectionError("YouTube returned no video metadata.")
    entries = islice(overview.get("entries", [overview]), source.item_limit)
    items, failures = [], 0
    for entry in entries:
        if not entry or not re.fullmatch(r"[A-Za-z0-9_-]{11}", entry.get("id", "")):
            failures += 1
            continue
        video_id = entry["id"]
        url = f"https://www.youtube.com/watch?v={video_id}"
        try:
            with YoutubeDL({**options, "getcomments": source.comment_limit > 0,
                "extractor_args": {"youtube": {"max_comments": [str(source.comment_limit)], "comment_sort": ["new"]}}}) as downloader:
                info = downloader.extract_info(url, download=False)
            comments = [Comment(id=str(comment.get("id", index)), text=comment.get("text", ""), author=comment.get("author"),
                likes=comment.get("like_count"), published_at=datetime.fromtimestamp(comment["timestamp"], UTC) if comment.get("timestamp") else None)
                for index, comment in enumerate(info.get("comments", [])[:source.comment_limit])]
            published = datetime.fromtimestamp(info["timestamp"], UTC) if info.get("timestamp") else None
            items.append(make_item(source, video_id, url, info.get("title") or video_id, info.get("description") or "",
                published_at=published, author=info.get("channel") or info.get("uploader"),
                transcript=fetch_transcript(video_id, source.transcript_languages), comments=comments,
                metadata={"video_id": video_id, "upload_date": info.get("upload_date"), "duration_seconds": info.get("duration"), "view_count": info.get("view_count"),
                          "thumbnail": info.get("thumbnail"), "comment_count": info.get("comment_count"),
                          "comments_scope": f"Up to {source.comment_limit} newest comments" if source.comment_limit else "Not requested",
                          "video_storage": "watch link; video files are not downloaded"}))
        except Exception:
            failures += 1
    if not items:
        raise CollectionError("YouTube video extraction failed. Check the URL, network access, and yt-dlp version.")
    missing = sum(item.transcript.status != "available" for item in items)
    return Result(items, note=f"{len(items)} videos; {missing} transcripts unavailable/blocked; {failures} video extractions failed. Comments are bounded, not a full archive.")


async def collect(source: Source) -> Result:
    return await asyncio.to_thread(collect_sync, source)
