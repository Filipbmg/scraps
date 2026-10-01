import os
from pathlib import Path


def data_directory() -> Path:
    return Path(os.environ.get("SNOWDROP_DATA_DIR", Path(__file__).resolve().parents[3] / "data")).expanduser().resolve()


def telegram_session() -> Path:
    return Path(os.environ.get("TELEGRAM_SESSION_FILE", data_directory() / "telegram.session")).expanduser()


def x_cookies() -> Path:
    return Path(os.environ.get("X_COOKIES_FILE", data_directory() / "x-cookies.json")).expanduser()
