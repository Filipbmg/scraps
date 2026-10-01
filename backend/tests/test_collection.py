import importlib.util
import gzip
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from pydantic import ValidationError

from app.features.collection.connectors import rss, telegram, youtube, x
from app.features.collection.connectors.common import CollectionError, Result, make_item
from app.features.collection.connectors.network import check_public_host, fetch
from app.features.collection.schemas import SourceConfig, SourcePatch
from app.features.collection.service import COLLECTORS, collect_source, get_store
from app.features.collection.store import Store
from app.main import app

RSS = b"""<rss version="2.0"><channel><title>News</title><ttl>15</ttl>
<item><title>Rusland og Danmark</title><link>https://news.example/story?utm_source=feed</link>
<description>&lt;p&gt;En russisk fregat i &lt;b&gt;Danmark&lt;/b&gt;.&lt;/p&gt;</description><pubDate>Thu, 01 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Sport</title><link>https://news.example/sport</link><description>A football result.</description></item>
</channel></rss>"""


class CollectionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.store = Store(Path(directory.name) / "collection.sqlite3")
        app.dependency_overrides[get_store] = lambda: self.store
        self.addCleanup(app.dependency_overrides.clear)

    async def test_api_queue_ingestion_dedup_filters_and_record_detail(self):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
            config = {"provider": "rss", "name": "Danish news", "target": "https://news.example/feed", "keywords": ["russisk"], "interval_seconds": 60}
            created = await client.post("/api/collection/sources", json=config)
            self.assertEqual(created.status_code, 201)
            source_id = created.json()["id"]
            self.assertEqual((await client.post("/api/collection/sources", json=config)).status_code, 409)
            self.assertEqual((await client.post("/api/collection/sources", json={**config, "target": "http://127.0.0.1/private"})).status_code, 422)
            self.assertEqual((await client.post(f"/api/collection/sources/{source_id}/run")).status_code, 202)
            source, run_id = self.store.claim(datetime.now(UTC))
            self.assertIsNone(Store(self.store.path).claim(datetime.now(UTC)))
            with patch.object(rss, "fetch", AsyncMock(return_value=httpx.Response(200, content=RSS, headers={"etag": '"v1"'}))):
                await collect_source(self.store, source, run_id)
            feed = (await client.get("/api/collection/items", params={"query": "DANMARK", "denmark_only": True})).json()
            self.assertEqual(feed["total"], 1)
            summary = feed["items"][0]
            self.assertEqual(summary["url"], "https://news.example/story")
            self.assertNotIn("text", summary)
            detail = (await client.get(f"/api/collection/items/{summary['id']}")).json()
            self.assertIn("En russisk fregat i Danmark", detail["text"])
            self.assertNotIn("<b>", detail["text"])
            self.assertIsNone(detail["transcript"])
            self.assertEqual(detail["keywords"], ["russisk"])
            first_collection = detail["collected_at"]
            self.assertEqual(self.store.runs()[0].fetched, 2)
            self.assertEqual(self.store.runs()[0].added, 1)
            self.assertGreaterEqual(self.store.source(source_id).next_run_at, datetime.now(UTC) + timedelta(seconds=890))
            await client.post(f"/api/collection/sources/{source_id}/run")
            source, run_id = self.store.claim(datetime.now(UTC))
            with patch.object(rss, "fetch", AsyncMock(return_value=httpx.Response(200, content=RSS))):
                await collect_source(self.store, source, run_id)
            self.assertEqual(self.store.item_count(), 1)
            self.assertEqual(self.store.runs()[0].added, 0)
            self.assertEqual(self.store.item(summary["id"]).collected_at.isoformat(), datetime.fromisoformat(first_collection).isoformat())
            self.assertEqual((await client.get("/api/collection/items/missing")).status_code, 404)
            self.assertEqual((await client.get("/api/collection/items", params={"limit": 101})).status_code, 422)

    async def test_retry_preserves_data_and_cursor_and_honors_retry_after(self):
        source = self.store.create(SourceConfig(provider="rss", name="News", target="https://news.example/feed", interval_seconds=60))
        source, run_id = self.store.claim(datetime.now(UTC))
        item = make_item(source, "story", "https://news.example/story", "A story", "Stored content")
        self.store.finish(source, run_id, [item], cursor={"etag": "old"})
        self.store.request_run(source.id)
        source, run_id = self.store.claim(datetime.now(UTC))
        with patch.dict(COLLECTORS, {"rss": AsyncMock(side_effect=CollectionError("Rate limited", retry_after=1800))}):
            await collect_source(self.store, source, run_id)
        updated = self.store.source(source.id)
        self.assertEqual(updated.status, "error")
        self.assertEqual(updated.cursor, {"etag": "old"})
        self.assertEqual(self.store.item_count(), 1)
        self.assertGreater(updated.next_run_at, datetime.now(UTC) + timedelta(seconds=1790))
        self.assertIsNone(self.store.claim(datetime.now(UTC)))
        self.store.patch(source.id, SourcePatch(enabled=False))
        self.assertEqual(self.store.source(source.id).cursor, {"etag": "old"})
        self.assertEqual(self.store.source(source.id).status, "paused")
        self.store.request_run(source.id)
        self.assertIsNotNone(self.store.claim(datetime.now(UTC)))

    async def test_lease_recovery_rejects_stale_worker_and_persists_schedule(self):
        self.store.create(SourceConfig(provider="rss", name="News", target="https://news.example/feed", interval_seconds=300))
        old_source, old_run = self.store.claim(datetime.now(UTC))
        with self.assertRaises(RuntimeError):
            self.store.patch(old_source.id, SourcePatch(interval_seconds=60))
        recovered = Store(self.store.path)
        self.assertEqual(recovered.source(old_source.id).interval_seconds, 300)
        source, new_run = recovered.claim(datetime.now(UTC) + timedelta(minutes=6))
        self.store.finish(old_source, old_run, [], cursor={"wrong": True})
        self.assertEqual(recovered.source(source.id).status, "running")
        self.assertEqual(recovered.source(source.id).cursor, {})
        recovered.finish(source, new_run, [], cursor={"correct": True})
        self.assertEqual(recovered.source(source.id).cursor, {"correct": True})
        self.assertEqual(recovered.runs()[1].status, "interrupted")

    async def test_atom_and_public_telegram_parsing_preserve_original_links(self):
        config = SourceConfig(provider="rss", name="Atom", target="https://news.example/atom")
        source = self.store.create(config)
        atom = b'<feed xmlns="http://www.w3.org/2005/Atom"><title>News</title><entry><id>one</id><title>Russia</title><link href="https://news.example/one"/><updated>2026-10-01T10:00:00Z</updated><summary>Denmark</summary></entry></feed>'
        with patch.object(rss, "fetch", AsyncMock(return_value=httpx.Response(200, content=atom))):
            result = await rss.collect(source)
        self.assertEqual(str(result.items[0].url), "https://news.example/one")
        channel = self.store.create(SourceConfig(provider="telegram", name="Channel", target="@ExampleChannel"))
        markup = '<div class="tgme_widget_message" data-post="ExampleChannel/42"><div class="tgme_widget_message_text">Russia<br/>Denmark connection</div><time datetime="2026-10-01T12:00:00+02:00"></time></div>'
        with patch.object(telegram, "fetch", AsyncMock(return_value=httpx.Response(200, text=markup))):
            result = await telegram.collect(channel)
        self.assertEqual(result.items[0].text, "Russia\nDenmark connection")
        self.assertEqual(result.items[0].published_at.hour, 10)
        self.assertEqual(str(result.items[0].url), "https://t.me/ExampleChannel/42")
        with patch.object(telegram, "fetch", AsyncMock(return_value=httpx.Response(200, text="<p>No preview</p>"))):
            with self.assertRaises(CollectionError):
                await telegram.collect(channel)

    async def test_url_and_configuration_boundaries(self):
        for target in ["file:///etc/passwd", "http://localhost/feed", "http://10.0.0.1/feed", "http://user:password@news.example/feed"]:
            with self.assertRaises((ValueError, ValidationError)):
                SourceConfig(provider="rss", name="Invalid", target=target)
        with self.assertRaises(ValidationError):
            SourceConfig(provider="youtube", name="Invalid", target="https://www.youtube.com/@channel", item_limit=20)
        self.assertEqual(SourceConfig(provider="youtube", name="Video", target="https://www.youtube.com/@channel").item_limit, 2)
        with patch("app.features.collection.connectors.network.asyncio.to_thread", AsyncMock(return_value=[(2, 1, 6, "", ("127.0.0.1", 80))])):
            with self.assertRaises(CollectionError):
                await check_public_host("https://news.example/feed")

    async def test_compressed_http_response_is_decoded_once(self):
        encoded = gzip.compress(RSS)
        transport = httpx.MockTransport(lambda request: httpx.Response(200, stream=httpx.ByteStream(encoded),
            headers={"content-encoding": "gzip", "content-length": str(len(encoded)), "etag": '"compressed"'}))
        client = httpx.AsyncClient(transport=transport)
        with patch("app.features.collection.connectors.network.httpx.AsyncClient", return_value=client), \
                patch("app.features.collection.connectors.network.check_public_host", AsyncMock()):
            response = await fetch("https://news.example/feed")
        self.assertEqual(response.content, RSS)
        self.assertEqual(response.headers["etag"], '"compressed"')
        self.assertNotIn("content-encoding", response.headers)

    @unittest.skipUnless(importlib.util.find_spec("telethon"), "Install the telegram extra")
    async def test_telegram_account_cursor_catches_up_oldest_first(self):
        channel = self.store.create(SourceConfig(provider="telegram", name="Account channel", target="@example", telegram_access="account"))
        channel = channel.model_copy(update={"cursor": {"last_message_id": 10}})
        session = self.store.path.parent / "telegram.session"
        session.touch()
        client = MagicMock()
        client.connect = AsyncMock()
        client.disconnect = AsyncMock()
        client.is_user_authorized = AsyncMock(return_value=True)

        async def messages(*args, **kwargs):
            yield SimpleNamespace(id=11, message="A new Denmark post", date=datetime.now(UTC), views=4, forwards=0)
            yield SimpleNamespace(id=12, message="", date=datetime.now(UTC), views=1, forwards=0)

        client.iter_messages.side_effect = messages
        with patch("telethon.TelegramClient", return_value=client), patch("app.features.collection.connectors.telegram.telegram_session", return_value=session), \
                patch.dict("os.environ", {"TELEGRAM_API_ID": "123", "TELEGRAM_API_HASH": "test-only"}):
            result = await telegram.collect(channel)
        self.assertEqual(result.cursor, {"last_message_id": 12})
        self.assertEqual(len(result.items), 1)
        client.iter_messages.assert_called_once_with("example", min_id=10, reverse=True, limit=20)
        client.disconnect.assert_awaited_once()

    @unittest.skipUnless(importlib.util.find_spec("yt_dlp") and importlib.util.find_spec("youtube_transcript_api"), "Install the youtube extra")
    async def test_youtube_video_captions_comments_and_blocked_transcript(self):
        from youtube_transcript_api import FetchedTranscript, FetchedTranscriptSnippet
        from youtube_transcript_api._errors import IpBlocked
        source = self.store.create(SourceConfig(provider="youtube", name="Video", target="https://www.youtube.com/watch?v=jNQXAC9IVRw", item_limit=1, comment_limit=1))
        transcript = FetchedTranscript(snippets=[FetchedTranscriptSnippet(text="Russia and Denmark", start=0, duration=2)], video_id="jNQXAC9IVRw", language="English", language_code="en", is_generated=True)
        info = {"id": "jNQXAC9IVRw", "title": "A video", "description": "Description", "channel": "Publisher", "timestamp": 1790848800,
                "comments": [{"id": "c1", "text": "A useful comment", "author": "Viewer", "like_count": 3}], "comment_count": 1}
        with patch("yt_dlp.YoutubeDL") as downloader, patch("youtube_transcript_api.YouTubeTranscriptApi") as transcript_api:
            downloader.return_value.__enter__.return_value.extract_info.side_effect = [{"id": info["id"]}, info]
            transcript_api.return_value.fetch.return_value = transcript
            result = await youtube.collect(source)
        item = result.items[0]
        self.assertEqual(item.transcript.text, "Russia and Denmark")
        self.assertTrue(item.transcript.generated)
        self.assertEqual(item.comments[0].text, "A useful comment")
        self.assertIn("video files are not downloaded", item.metadata["video_storage"])
        with patch("youtube_transcript_api.YouTubeTranscriptApi") as transcript_api:
            transcript_api.return_value.fetch.side_effect = IpBlocked("jNQXAC9IVRw")
            blocked = youtube.fetch_transcript("jNQXAC9IVRw", ["en"])
        self.assertEqual(blocked.status, "blocked")
        self.assertEqual(blocked.text, "")

    @unittest.skipUnless(importlib.util.find_spec("twikit"), "Install the x extra")
    async def test_x_profile_and_search_use_only_local_session(self):
        cookie_path = self.store.path.parent / "x-cookies.json"
        cookie_path.write_text('{"auth_token":"test-only","ct0":"test-only"}')
        tweet = SimpleNamespace(id="42", text="Russia and Denmark", user=SimpleNamespace(screen_name="example"), created_at_datetime=datetime.now(UTC), favorite_count=3, retweet_count=1)
        client = MagicMock()
        client.get_cookies.return_value = {"auth_token": "test-only", "ct0": "test-only"}
        client.get_user_by_screen_name = AsyncMock(return_value=SimpleNamespace(id="123"))
        client.get_user_tweets = AsyncMock(return_value=[tweet])
        client.search_tweet = AsyncMock(return_value=[tweet])
        client.http.aclose = AsyncMock()
        profile = self.store.create(SourceConfig(provider="x", name="Profile", target="@example", item_limit=1))
        search = self.store.create(SourceConfig(provider="x", name="Query", target="Russia Denmark", x_mode="search", item_limit=1))
        with patch("twikit.Client", return_value=client), patch("app.features.collection.connectors.x.x_cookies", return_value=cookie_path):
            self.assertEqual((await x.collect(profile)).items[0].external_id, "42")
            self.assertEqual((await x.collect(search)).items[0].title, "Russia and Denmark")
        client.get_user_by_screen_name.assert_awaited_once_with("example")
        client.search_tweet.assert_awaited_once_with("Russia Denmark", "Latest", count=1)
        self.assertEqual(client.http.aclose.await_count, 2)


if __name__ == "__main__":
    unittest.main()
