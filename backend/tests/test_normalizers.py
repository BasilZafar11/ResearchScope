import asyncio
import json
from app.analysis import normalizers as n
from app.serpapi_clients.base import SearchClient, FIXTURES
from app.serpapi_clients import maps, reviews, trends, news, ads
from app.models.schemas import AnalysisInput
from conftest import PUNE


def test_all_fixture_adapters():
    async def run():
        c, request = SearchClient(), AnalysisInput(**PUNE)
        places = await maps.fetch(c, request)
        assert places[0]['data_id']
        assert len(await reviews.fetch(c, places[0])) == 8
        assert len(await trends.fetch(c, request)) == 12
        assert len(await news.fetch(c, request)) == 5
        assert len(await ads.fetch(c, 'WeWork')) == 1
        assert await ads.fetch(c, 'Unrelated advertiser') == []
    asyncio.run(run())


def test_safe_urls_and_missing_values():
    assert n.safe_url('javascript:alert(1)') is None
    assert n.safe_url('https://serpapi.com/search.json?api_key=secret') is None
    assert n.safe_url('https://example.com/path?token=secret&ok=1') == 'https://example.com/path?ok=1'
    assert n.maps({'local_results':[{'title':'Test', 'reviews':'1,200','rating':'NaN','gps_coordinates':{'latitude':999}}]})[0]['review_count'] == 1200
    assert n.reviews({'reviews':[{'rating':0}, {'rating':2,'snippet':'Bad'}]}, {'name':'Test','data_id':'1'})[0]['text'] == 'Bad'
    assert n.iso_date('not a date') is None
    assert n.trends({'interest_over_time':{'timeline_data':[{'date':'x','values':[{'query':'x','value':'<1'}]}]}}) == []


def test_fixture_privacy():
    for path in FIXTURES.glob('*.json'):
        raw = path.read_text()
        assert 'api_key' not in raw and 'author' not in raw and 'user_id' not in raw
