import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError

from app.features.collection.schemas import Feed, Item, Provider, Source, SourceConfig, SourcePatch, Workspace
from app.features.collection.service import get_store, workspace
from app.features.collection.store import Store

router = APIRouter()
CollectionStore = Annotated[Store, Depends(get_store)]


@router.get("", response_model=Workspace)
def get_workspace(store: CollectionStore):
    return workspace(store)


@router.post("/sources", response_model=Source, status_code=201)
def create_source(config: SourceConfig, store: CollectionStore):
    try:
        return store.create(config)
    except sqlite3.IntegrityError:
        raise HTTPException(409, "This provider/target is already configured.") from None


@router.patch("/sources/{source_id}", response_model=Source)
def patch_source(source_id: str, patch: SourcePatch, store: CollectionStore):
    try:
        return store.patch(source_id, patch)
    except StopIteration:
        raise HTTPException(404, "Source not found.") from None
    except ValidationError as error:
        raise HTTPException(422, error.errors(include_context=False, include_input=False)) from None
    except RuntimeError as error:
        raise HTTPException(409, str(error)) from None


@router.post("/sources/{source_id}/run", response_model=Source, status_code=202)
def queue_run(source_id: str, store: CollectionStore):
    try:
        return store.request_run(source_id)
    except StopIteration:
        raise HTTPException(404, "Source not found.") from None
    except RuntimeError as error:
        raise HTTPException(409, str(error)) from None


@router.get("/items", response_model=Feed)
def get_items(store: CollectionStore, query: str = Query(default="", max_length=200),
              provider: Provider | None = None, source_id: str | None = Query(default=None, max_length=100),
              denmark_only: bool = False, limit: int = Query(default=25, ge=1, le=100), offset: int = Query(default=0, ge=0)):
    return store.feed(query=query, provider=provider, source_id=source_id, denmark_only=denmark_only, limit=limit, offset=offset)


@router.get("/items/{item_id}", response_model=Item)
def get_item(item_id: str, store: CollectionStore):
    try:
        return store.item(item_id)
    except LookupError:
        raise HTTPException(404, "Collected item not found.") from None
