import asyncio
import ipaddress
import socket
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlsplit

import httpx

from app.features.collection.connectors.common import CollectionError
from app.features.collection.schemas import public_url


def retry_seconds(headers: httpx.Headers) -> int:
    value = headers.get("retry-after", "")
    if value.isdigit():
        return int(value)
    try:
        return max(0, int((parsedate_to_datetime(value) - datetime.now(UTC)).total_seconds()))
    except (ValueError, TypeError):
        return 0


async def check_public_host(url: str):
    host = urlsplit(public_url(url)).hostname
    addresses = await asyncio.to_thread(socket.getaddrinfo, host, None, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(address[4][0]).is_global for address in addresses):
        raise CollectionError("Collector URLs must resolve to public internet addresses.")


async def fetch(url: str, headers: dict[str, str] | None = None) -> httpx.Response:
    async with httpx.AsyncClient(timeout=25, follow_redirects=False, trust_env=False,
                                 headers={"User-Agent": "Snowdrop/0.2 media-monitoring", **(headers or {})}) as client:
        for _ in range(6):
            await check_public_host(url)
            async with client.stream("GET", url) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    if not response.headers.get("location"):
                        raise CollectionError("The source returned a redirect without a destination.")
                    url = urljoin(url, response.headers["location"])
                    continue
                if response.status_code in {429, 503}:
                    raise CollectionError(f"The source returned HTTP {response.status_code}; collection will back off.",
                                          retry_after=retry_seconds(response.headers))
                if response.status_code != 304 and response.is_error:
                    raise CollectionError(f"The source returned HTTP {response.status_code}.")
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > 4 * 1024 * 1024:
                        raise CollectionError("The source response exceeded the 4 MB collection limit.")
                # aiter_bytes() has already decompressed the body. Do not decode it a second time.
                decoded_headers = httpx.Headers(response.headers)
                decoded_headers.pop("content-encoding", None)
                decoded_headers.pop("content-length", None)
                return httpx.Response(response.status_code, headers=decoded_headers, content=bytes(body), request=response.request)
    raise CollectionError("The source redirected too many times.")
