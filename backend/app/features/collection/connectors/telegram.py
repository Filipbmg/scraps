import asyncio
import os
from datetime import datetime

from scrapling.parser import Selector

from app.features.collection.connectors.common import CollectionError, Result, make_item
from app.features.collection.connectors.network import fetch
from app.features.collection.schemas import Source
from app.features.collection.settings import telegram_session

# ponytail: one account session per worker process; use a shared long-lived client if many channels need faster polling.
account_lock = asyncio.Lock()


async def collect(source: Source) -> Result:
    if source.telegram_access == "account":
        async with account_lock:
            return await collect_account(source)
    response = await fetch(f"https://t.me/s/{source.target}")
    page = Selector(response.text)
    messages = page.css(".tgme_widget_message[data-post]")
    if not messages:
        raise CollectionError("No public channel preview was found. Check the username, or use Telegram account mode.")
    items = []
    for message in messages[-source.item_limit:]:
        external_id = message.attrib["data-post"]
        body = message.css(".tgme_widget_message_text")
        text = body[0].get_all_text(separator="\n", strip=True) if body else ""
        if not text:
            continue
        timestamp = message.css("time::attr(datetime)").get()
        try:
            published = datetime.fromisoformat(timestamp.replace("Z", "+00:00")) if timestamp else None
        except ValueError:
            published = None
        items.append(make_item(source, external_id.lower(), f"https://t.me/{external_id}", text.splitlines()[0][:160], text,
                               published_at=published, author=source.target, metadata={"access": "public web preview", "coverage": "recent visible text posts"}))
    return Result(items, note="Public preview only: the most recent visible text posts, not full channel history.")


async def collect_account(source: Source) -> Result:
    try:
        from telethon import TelegramClient
        from telethon.errors import FloodWaitError
    except ImportError:
        raise CollectionError("Install Telegram support with: uv sync --extra telegram", setup=True) from None
    api_id, api_hash = os.getenv("TELEGRAM_API_ID", ""), os.getenv("TELEGRAM_API_HASH", "")
    if not api_id.isdigit() or not api_hash or not telegram_session().is_file():
        raise CollectionError("Configure TELEGRAM_API_ID/HASH, then run: uv run --extra telegram python -m app.features.collection.auth telegram", setup=True)
    client = TelegramClient(str(telegram_session()), int(api_id), api_hash, timeout=15,
                            request_retries=1, connection_retries=1, flood_sleep_threshold=0, receive_updates=False)
    try:
        await client.connect()
        if not await client.is_user_authorized():
            raise CollectionError("The Telegram session needs sign-in. Run the local Telegram authentication command.", setup=True)
        last_id = int(source.cursor.get("last_message_id", 0))
        highest_id, items = last_id, []
        async for message in client.iter_messages(source.target, min_id=last_id, reverse=bool(last_id), limit=source.item_limit):
            highest_id = max(highest_id, message.id)
            text = message.message or ""
            if not text:
                continue
            items.append(make_item(source, f"{source.target}/{message.id}", f"https://t.me/{source.target}/{message.id}", text.splitlines()[0][:160], text,
                published_at=message.date, author=source.target, metadata={"access": "Telegram account", "views": message.views, "forwards": message.forwards}))
        return Result(items, {"last_message_id": highest_id}, "Incremental text posts; media binaries are not downloaded.")
    except FloodWaitError as error:
        raise CollectionError(f"Telegram requested a {error.seconds}-second flood wait.", retry_after=error.seconds) from None
    finally:
        await client.disconnect()
