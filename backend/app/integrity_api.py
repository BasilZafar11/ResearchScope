"""Bounded, user-requested Crossref lookups; no background provider calls."""
import asyncio
import hashlib
import secrets
import re
import time
from collections import OrderedDict, deque
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request

_requests = OrderedDict()
_salt = secrets.token_bytes(32)


async def admit(request: Request):
    """Per-process admission budget independent of paid SerpApi calls."""
    identity = hashlib.sha256(_salt + (request.client.host if request.client else 'unknown').encode()).hexdigest()
    current = time.monotonic()
    recent = _requests.setdefault(identity, deque())
    while recent and current - recent[0] >= 3600:
        recent.popleft()
    if len(recent) >= 30:
        raise HTTPException(429, 'Metadata lookup limit reached. Try again in an hour.')
    recent.append(current)
    _requests.move_to_end(identity)
    while len(_requests) > 2048:
        _requests.popitem(last=False)


router = APIRouter(prefix='/api/research-integrity', tags=['Research integrity'], dependencies=[Depends(admit)])
_cache = OrderedDict()
_slots = asyncio.Semaphore(3)


def normalize_doi(value: str) -> str:
    value = re.sub(r'^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)', '', value.strip(), flags=re.I)
    if not re.fullmatch(r'10\.\d{4,9}/[^\s,?#]+', value, flags=re.I):
        raise HTTPException(422, 'Enter a valid DOI, for example 10.1234/example.')
    return value.lower()


async def crossref(path: str, params=None):
    key = (path, tuple(sorted((params or {}).items())))
    cached = _cache.get(key)
    if cached and time.monotonic() - cached[0] < 3600:
        return cached[1]
    async with _slots:
        try:
            async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
                response = await client.get('https://api.crossref.org' + path, params=params,
                                            headers={'User-Agent': 'ResearchIntegrity/1.0 (Crossref metadata review)'})
            if response.status_code == 404:
                raise HTTPException(404, 'Crossref has no record for this DOI.')
            if response.status_code == 429:
                raise HTTPException(503, 'Crossref is rate limited. Try again later.')
            response.raise_for_status()
            message = response.json()['message']
            if not isinstance(message, dict):
                raise ValueError('Unexpected metadata')
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise HTTPException(502, 'Crossref could not return usable metadata. The source remains unchecked.')
    _cache[key] = (time.monotonic(), message)
    _cache.move_to_end(key)
    while len(_cache) > 256:
        _cache.popitem(last=False)
    return message


def work_summary(item):
    parts = item.get('published', {}).get('date-parts', [[]])[0]
    return {
        'doi': item.get('DOI', ''), 'title': ' '.join(item.get('title', [])),
        'url': 'https://doi.org/' + quote(item.get('DOI', ''), safe='/'),
        'date': '-'.join(str(x).zfill(2) if i else str(x) for i, x in enumerate(parts)),
        'language': item.get('language', ''), 'type': item.get('type', ''),
        'abstract': re.sub(r'<[^>]*>', '', item.get('abstract', ''))[:12000],
        'authors': [' '.join(filter(None, [a.get('given'), a.get('family')])) for a in item.get('author', [])],
    }


@router.get('/publication-updates')
async def publication_updates(doi: str = Query(min_length=7, max_length=300)):
    doi = normalize_doi(doi)
    work = await crossref('/works/' + quote(doi, safe=''))
    updates = await crossref('/works', {'filter': 'updates:' + doi, 'rows': 100})
    notices = []
    seen = set()
    for item in updates.get('items', []):
        for update in item.get('update-to', []):
            if str(update.get('DOI', '')).lower() != doi:
                continue
            identity = (item.get('DOI'), update.get('type'))
            if identity in seen:
                continue
            seen.add(identity)
            notices.append({**work_summary(item), 'kind': update.get('type', 'update'),
                            'provenance': update.get('source', 'publisher')})
    # Some third-party notices live directly on the original work record.
    direct = [u for u in work.get('update-to', []) if u.get('source') == 'retraction-watch']
    for update in direct:
        identity = (update.get('DOI'), update.get('type'))
        if identity in seen:
            continue
        seen.add(identity)
        notice_doi = update.get('DOI', '')
        notices.append({'doi': notice_doi, 'title': 'Retraction Watch update',
                        'url': 'https://doi.org/' + quote(notice_doi, safe='/') if notice_doi else '',
                        'date': '', 'kind': update.get('type', 'update'), 'provenance': 'retraction-watch'})
    notices.sort(key=lambda notice: (notice.get('doi', ''), notice.get('kind', ''), notice.get('provenance', '')))
    return {'work': work_summary(work), 'notices': notices, 'checked_at': datetime.now(timezone.utc).isoformat(),
            'truncated': updates.get('total-results', 0) > 100,
            'coverage': 'Crossref registered updates only. No returned notice is not proof that a work is unchanged.'}


@router.get('/discovery')
async def discovery(query: str = Query(min_length=3, max_length=400)):
    message = await crossref('/works', {'query.bibliographic': query, 'rows': 15})
    return {'query': query, 'provider': 'Crossref', 'checked_at': datetime.now(timezone.utc).isoformat(),
            'items': [work_summary(item) for item in message.get('items', [])],
            'coverage': 'Crossref metadata search; language metadata may be absent. Results require relevance review.'}
