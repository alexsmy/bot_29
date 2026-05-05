from __future__ import annotations

from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.background import BackgroundTask

router = APIRouter(prefix="/api/radio/proxy", tags=["radio-proxy"])

ALLOWED_SCHEMES = {"http", "https"}
STREAM_HEADERS = {
    "user-agent",
    "accept",
    "accept-language",
    "range",
    "origin",
    "referer",
    "icy-metadata",
    "cache-control",
    "pragma",
}

RADIO_BROWSER_SEARCH_URL = "https://de1.api.radio-browser.info/json/stations/search"


def _validate_target_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    if parsed.scheme not in ALLOWED_SCHEMES or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Неверный URL для проксирования")
    return raw_url


def _pick_stream_headers(request: Request) -> dict[str, str]:
    headers: dict[str, str] = {
        "User-Agent": request.headers.get("user-agent", "VibeRadioProxy/1.0 (+render)")
    }
    for key in STREAM_HEADERS:
        value = request.headers.get(key)
        if value:
            headers[key.title()] = value
    headers.setdefault("Accept", "*/*")
    return headers


@router.get("/search")
async def proxy_search(query: str = Query(..., min_length=1, max_length=256)):
    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0), follow_redirects=True) as client:
        try:
            response = await client.get(RADIO_BROWSER_SEARCH_URL, params={"name": query})
            response.raise_for_status()
            data = response.json()
            return JSONResponse(data)
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail="Ошибка поиска радиостанций") from exc
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail="Не удалось выполнить серверный поиск") from exc
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="Поисковый API вернул некорректный JSON") from exc


@router.get("/stream")
async def proxy_stream(request: Request, url: str = Query(..., min_length=8, max_length=2048)):
    target_url = _validate_target_url(url)

    client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, connect=10.0, read=None),
        follow_redirects=True,
    )

    try:
        upstream_request = client.build_request("GET", target_url, headers=_pick_stream_headers(request))
        upstream_response = await client.send(upstream_request, stream=True)
    except httpx.RequestError as exc:
        await client.aclose()
        raise HTTPException(status_code=502, detail="Не удалось подключиться к аудиопотоку") from exc

    response_headers: dict[str, str] = {}
    for key in (
        "content-type",
        "cache-control",
        "accept-ranges",
        "icy-metaint",
        "icy-name",
        "icy-genre",
        "icy-url",
    ):
        value = upstream_response.headers.get(key)
        if value:
            response_headers[key] = value

    async def stream_iterator():
        try:
            async for chunk in upstream_response.aiter_bytes():
                yield chunk
        finally:
            await upstream_response.aclose()
            await client.aclose()

    media_type = upstream_response.headers.get("content-type", "audio/mpeg")
    return StreamingResponse(
        stream_iterator(),
        status_code=upstream_response.status_code,
        media_type=media_type,
        headers=response_headers,
        background=BackgroundTask(upstream_response.aclose),
    )
