from app.analysis.normalizers import maps
from app.models.schemas import AnalysisInput
from .base import SearchClient
from app.analysis.normalizers import hours


async def fetch(client: SearchClient, request: AnalysisInput):
    return maps(await client.search('google_maps', {'type': 'search', 'q': f'{request.business_category} in {request.city}, {request.country}', 'hl': 'en'}))


async def fetch_hours(client: SearchClient, place: dict):
    params = {'type': 'place', 'hl': 'en'}
    if place.get('place_id'):
        params['place_id'] = place['place_id']
    elif place.get('data_cid'):
        params['data_cid'] = place['data_cid']
    elif place.get('data_id') and place.get('latitude') is not None and place.get('longitude') is not None:
        params['data'] = f"!4m5!3m4!1s{place['data_id']}!8m2!3d{place['latitude']}!4d{place['longitude']}"
    else:
        return {}
    raw = await client.search('google_maps', params)
    details = raw.get('place_results') or {}
    # Reject a provider response for a different place when an identity is supplied.
    for key in ('data_id', 'place_id', 'data_cid'):
        if details.get(key) and place.get(key) and str(details[key]) != str(place[key]):
            return {}
    return hours(details.get('hours') or details.get('operating_hours'))
