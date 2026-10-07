from app.analysis.normalizers import reviews
from .base import SearchClient


async def fetch(client: SearchClient, place: dict):
    raw = await client.search('google_maps_reviews', {'data_id': place['data_id'], 'sort_by': 'newestFirst', 'hl': 'en'})
    token = (raw.get('serpapi_pagination') or {}).get('next_page_token')
    if isinstance(token, str) and token:
        client.review_tokens[place['data_id']] = token
    return reviews(raw, place)


async def history(client: SearchClient, place: dict):
    token = client.review_tokens.get(place['data_id'])
    if not token:
        return []
    raw = await client.search('google_maps_reviews', {'data_id': place['data_id'], 'sort_by': 'newestFirst', 'hl': 'en', 'next_page_token': token})
    return reviews(raw, place)
