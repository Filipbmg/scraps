"""Run separately from the API: python -m app.features.collection.worker."""

import asyncio
import logging
from datetime import UTC, datetime

from app.features.collection.service import collect_source, get_store


async def run_worker():
    store = get_store()
    pending: set[asyncio.Task] = set()
    logging.info("Snowdrop collector worker started (2 concurrent jobs).")
    try:
        while True:
            store.heartbeat()
            # ponytail: two local jobs; move to per-platform queues if slow sources delay urgent collection.
            while len(pending) < 2:
                claimed = store.claim(datetime.now(UTC))
                if not claimed:
                    break
                source, run_id = claimed
                pending.add(asyncio.create_task(collect_source(store, source, run_id)))
            if pending:
                done, pending = await asyncio.wait(pending, timeout=2, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    task.result()
            else:
                await asyncio.sleep(2)
    finally:
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        pass
