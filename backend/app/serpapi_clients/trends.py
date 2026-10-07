from app.analysis.normalizers import trends
from app.models.schemas import AnalysisInput
from .base import SearchClient
from urllib.parse import urlencode


async def fetch(client: SearchClient, request: AnalysisInput):
    raw = await client.search('google_trends', {'q': ','.join(request.keywords), 'geo': request.country_code, 'data_type': 'TIMESERIES', 'date': 'today 12-m', 'hl': 'en'})
    return trends(raw)


async def related_queries(client: SearchClient, request: AnalysisInput):
    raw = await client.search('google_trends', {'q': request.keywords[0], 'geo': request.country_code, 'data_type': 'RELATED_QUERIES', 'date': 'today 12-m', 'hl': 'en'})
    related = raw.get('related_queries') or {}
    result, seen = [], set()
    if isinstance(related, dict):
        for kind in ('top', 'rising'):
            items = related.get(kind, [])
            for item in (items if isinstance(items, list) else [])[:20]:
                if isinstance(item, dict) and isinstance(item.get('query'), str):
                    query = item['query'].strip()[:100]
                    if not query or (query.casefold(), kind) in seen:
                        continue
                    seen.add((query.casefold(), kind))
                    result.append({'query': query, 'kind': kind, 'value': str(item.get('value', ''))[:40], 'seed': request.keywords[0],
                                   'source_url': 'https://trends.google.com/trends/explore?' + urlencode({'q': query, 'geo': request.country_code, 'date': 'today 12-m'})})
    return result


async def seasonality(client: SearchClient, request: AnalysisInput):
    raw = await client.search('google_trends', {'q': ','.join(request.keywords), 'geo': request.country_code, 'data_type': 'TIMESERIES', 'date': 'today 5-y', 'hl': 'en'})
    return trends(raw)
