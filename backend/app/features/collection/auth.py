"""Interactive account setup. Credentials stay in the operator's local terminal."""

import argparse
import asyncio
import os
from getpass import getpass

from app.features.collection.settings import telegram_session, x_cookies


async def sign_in(provider: str):
    if provider == "telegram":
        from telethon import TelegramClient
        api_id, api_hash = os.getenv("TELEGRAM_API_ID", ""), os.getenv("TELEGRAM_API_HASH", "")
        if not api_id.isdigit() or not api_hash:
            raise SystemExit("Set TELEGRAM_API_ID and TELEGRAM_API_HASH from my.telegram.org first.")
        path = telegram_session()
        path.parent.mkdir(parents=True, exist_ok=True)
        client = TelegramClient(str(path), int(api_id), api_hash)
        try:
            await client.start()
        finally:
            await client.disconnect()
    else:
        from twikit import Client
        path = x_cookies()
        path.parent.mkdir(parents=True, exist_ok=True)
        client = Client("en-US", timeout=25)
        try:
            await client.login(auth_info_1=input("X username: ").strip(), auth_info_2=input("X email: ").strip(),
                               password=getpass("X password: "), cookies_file=str(path))
        finally:
            await client.http.aclose()
    path.chmod(0o600)
    print(f"Local {provider} session saved. Start/restart the worker with the same environment.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Authenticate a local Telegram or X collector.")
    parser.add_argument("provider", choices=["telegram", "x"])
    arguments = parser.parse_args()
    try:
        asyncio.run(sign_in(arguments.provider))
    except ImportError:
        raise SystemExit(f"Install support first: uv sync --extra {arguments.provider}") from None
    except Exception as error:
        raise SystemExit(f"Sign-in failed ({type(error).__name__}). Check the account in its official app; for X, a saved Twikit-format session can also be supplied.") from None
