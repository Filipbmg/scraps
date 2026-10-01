from datetime import UTC

from app.features.collection.connectors.common import CollectionError, Result, make_item
from app.features.collection.schemas import Source
from app.features.collection.settings import x_cookies


async def collect(source: Source) -> Result:
    try:
        from twikit import Client
        from twikit.errors import AccountLocked, AccountSuspended, Forbidden, TooManyRequests, Unauthorized
    except ImportError:
        raise CollectionError("Install X support with: uv sync --extra x", setup=True) from None
    if not x_cookies().is_file():
        raise CollectionError("Sign in locally with: uv run --extra x python -m app.features.collection.auth x, or configure X_COOKIES_FILE.", setup=True)
    client = Client("en-US", timeout=20)
    try:
        try:
            client.load_cookies(str(x_cookies()))
        except (OSError, ValueError, TypeError):
            raise CollectionError("The local X session file could not be loaded. Use a valid Twikit-format cookie file.", setup=True) from None
        if not {"auth_token", "ct0"}.issubset(client.get_cookies()):
            raise CollectionError("The X session file must contain your own auth_token and ct0 cookies.", setup=True)
        if source.x_mode == "profile":
            user = await client.get_user_by_screen_name(source.target)
            page = await client.get_user_tweets(user.id, "Tweets", count=min(20, source.item_limit))
        else:
            page = await client.search_tweet(source.target, "Latest", count=min(20, source.item_limit))
        items = []
        while page and len(items) < source.item_limit:
            for tweet in page:
                text = tweet.text or ""
                author = tweet.user.screen_name
                items.append(make_item(source, str(tweet.id), f"https://x.com/{author}/status/{tweet.id}", text.splitlines()[0][:160] if text else "X post", text,
                    published_at=tweet.created_at_datetime.astimezone(UTC), author=author,
                    metadata={"likes": tweet.favorite_count, "reposts": tweet.retweet_count, "coverage": "recent posts via an unofficial authenticated client"}))
                if len(items) >= source.item_limit:
                    break
            if len(items) < source.item_limit:
                page = await page.next()
        return Result(items, note=f"Recent-window collection: up to {source.item_limit} posts. Free, unofficial, and best-effort.")
    except TooManyRequests as error:
        from app.features.collection.connectors.network import retry_seconds
        import httpx
        headers = httpx.Headers(getattr(error, "headers", {}) or {})
        reset = headers.get("x-rate-limit-reset", "")
        from datetime import datetime
        delay = max(0, int(reset) - int(datetime.now(UTC).timestamp())) if reset.isdigit() else 0
        raise CollectionError("X rate-limited this session; collection will back off.", retry_after=max(delay, retry_seconds(headers), 900)) from None
    except (AccountLocked, AccountSuspended, Unauthorized, Forbidden):
        raise CollectionError("X requires session reauthentication or account attention. Sign in locally and check the account.", setup=True) from None
    finally:
        await client.http.aclose()
