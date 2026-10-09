"""Bounded, user-requested Crossref lookups; no background provider calls."""
import asyncio
import json
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


async def bounded_json(client, url, **kwargs):
    async with client.stream('GET', url, **kwargs) as response:
        if response.status_code==404:raise HTTPException(404,'The provider has no record for this DOI.')
        if response.status_code==429:raise HTTPException(503,'The metadata provider is rate limited. Try again later.')
        response.raise_for_status()
        body=bytearray()
        async for chunk in response.aiter_bytes():
            if len(body)+len(chunk)>1_000_000:raise ValueError('Metadata exceeds the response limit')
            body.extend(chunk)
    return json.loads(body)


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
            async with httpx.AsyncClient(timeout=12, follow_redirects=False, trust_env=False) as client:
                data = await bounded_json(client,'https://api.crossref.org' + path, params=params,
                                            headers={'User-Agent': 'ResearchIntegrity/1.0 (Crossref metadata review)'})
            message = data['message']
            if not isinstance(message, dict):
                raise ValueError('Unexpected metadata')
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise HTTPException(502, 'Crossref could not return usable metadata. The source remains unchecked.')
    _cache[key] = (time.monotonic(), message)
    _cache.move_to_end(key)
    while len(_cache) > 32:
        _cache.popitem(last=False)
    return message


def work_summary(item):
    published=item.get('published') or {}
    date_parts=published.get('date-parts') or [[]]
    parts=date_parts[0] if date_parts else []
    return {
        'doi': item.get('DOI', ''), 'title': ' '.join(item.get('title', [])),
        'url': 'https://doi.org/' + quote(item.get('DOI', ''), safe='/'),
        'date': '-'.join(str(x).zfill(2) if i else str(x) for i, x in enumerate(parts)),
        'language': item.get('language', ''), 'type': item.get('type', ''),
        'abstract': re.sub(r'<[^>]*>', '', item.get('abstract', ''))[:12000],
        'authors': [' '.join(filter(None, [a.get('given'), a.get('family')])) for a in item.get('author', [])],
        'relations':item.get('relation') or {},
        'links':item.get('link') or [],
        'licenses':item.get('license') or [],
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
async def discovery(query: str = Query(min_length=3, max_length=400),source_type:str=Query(default='all'),after_year:int|None=Query(default=None,ge=1800,le=2099)):
    allowed={'all','dissertation','posted-content','report','standard','journal-article'}
    if source_type not in allowed:raise HTTPException(422,'This source type is not supported by Crossref.')
    filters=[]
    if source_type!='all':filters.append('type:'+source_type)
    if after_year is not None:filters.append('from-pub-date:'+str(after_year+1)+'-01-01')
    params={'query.bibliographic':query,'rows':15}
    if filters:params['filter']=','.join(filters)
    message = await crossref('/works',params)
    return {'query': query, 'provider': 'Crossref', 'checked_at': datetime.now(timezone.utc).isoformat(),
            'items': [work_summary(item) for item in message.get('items', [])],
            'coverage': 'Crossref metadata search; language metadata may be absent. Results require relevance review.'}


async def europe_pmc(doi):
    key=('europe-pmc',doi)
    cached=_cache.get(key)
    if cached and time.monotonic()-cached[0]<3600:return cached[1]
    async with _slots:
        try:
            async with httpx.AsyncClient(timeout=12,follow_redirects=False,trust_env=False) as client:
                data=await bounded_json(client,'https://www.ebi.ac.uk/europepmc/webservices/rest/search',
                                          params={'query':'DOI:"'+doi+'"','format':'json','resultType':'core','pageSize':10})
                result=data['resultList']['result']
                if not isinstance(result,list):raise ValueError()
        except (httpx.HTTPError,KeyError,ValueError,TypeError):
            raise HTTPException(502,'Europe PMC access metadata is unavailable.')
    _cache[key]=(time.monotonic(),result)
    while len(_cache)>32:_cache.popitem(last=False)
    return result


@router.get('/access')
async def access_metadata(doi:str=Query(min_length=7,max_length=300)):
    doi=normalize_doi(doi)
    results=await asyncio.gather(crossref('/works/'+quote(doi,safe='')),europe_pmc(doi),return_exceptions=True)
    candidates=[];failures=[];metadata=None
    registry,repository=results
    if isinstance(registry,Exception):failures.append('Crossref metadata unavailable')
    else:
        metadata=work_summary(registry)
        for link in registry.get('link') or []:
            url=link.get('URL','')
            if url.startswith(('https://','http://')):candidates.append({'url':url,'provider':'Crossref','format':link.get('content-type','unknown'),
                                                                      'version':link.get('content-version','unknown'),'license':'not established for this link','availability':'candidate; may require access rights'})
    if isinstance(repository,Exception):failures.append('Europe PMC metadata unavailable')
    else:
        for item in repository:
            if str(item.get('doi','')).lower()!=doi:continue
            for link in (item.get('fullTextUrlList') or {}).get('fullTextUrl',[]):
                url=link.get('url','')
                if link.get('availabilityCode')=='OA' and url.startswith(('http://','https://')):
                    candidates.append({'url':url,'provider':'Europe PMC','format':link.get('documentStyle','unknown'),
                                       'version':'unknown','license':item.get('license') or 'not supplied',
                                       'availability':'provider reports open access; original page not inspected'})
    unique={item['url']:item for item in candidates}
    return {'doi':doi,'work':metadata,'candidates':list(unique.values()),'failures':failures,'checked_at':datetime.now(timezone.utc).isoformat(),
            'coverage':'Crossref and Europe PMC metadata only. No copies are downloaded; verify identity, access, and license on the original host.'}
