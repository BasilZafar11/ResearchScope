import json
from pathlib import Path
from app.config import settings
from app.db.session import Session
from app.models.database import Analysis
from app.models.schemas import AnalysisInput
from app.errors import EngineError
from app.serpapi_clients.base import SearchClient
from conftest import PUNE
import pytest


def report(client, data=None):
    created = client.post('/api/analyses', json=data or PUNE)
    assert created.status_code == 202, created.text
    return client.get('/api/analyses/' + created.json()['id']).json()


def test_end_to_end_and_cache(client):
    result = report(client)
    assert result['status'] == 'complete', result
    assert len(result['competitors']) == 6
    assert result['methodology']['components']['unmet_need']['sample_size'] == 24
    assert result['data_mode'] == 'fixture'
    assert result['confidence_score'] >= 65
    assert client.get('/api/analyses').json()[0]['id'] == result['id']
    cached = client.post('/api/analyses', json={**PUNE, 'keywords':list(reversed(PUNE['keywords']))})
    assert cached.status_code == 200
    assert cached.json()['id'] == result['id']
    assert cached.json()['cached']
    refreshed = report(client, {**PUNE, 'refresh':True})
    assert refreshed['id'] != result['id']


@pytest.mark.parametrize('field,value', [('business_category',''),('keywords',[]),('keywords',['ab']*6),('city','Pu\nne'),('country','unrecognized-land'),('known_competitors',['a']),('keywords',['abc','ABC'])])
def test_bad_inputs(client, field, value):
    response = client.post('/api/analyses', json={**PUNE, field:value})
    assert response.status_code == 422
    assert 'error' in response.json()


def test_running_duplicate(client):
    with Session.begin() as db:
        row = Analysis(fingerprint=AnalysisInput(**PUNE).fingerprint(False), **PUNE)
        db.add(row)
    response = client.post('/api/analyses', json=PUNE)
    assert response.status_code == 409
    assert response.json()['error']['code'] == 'ANALYSIS_RUNNING'


@pytest.mark.parametrize('engine,key,score_key', [('google_trends','trends','demand'),('google_maps_reviews','reviews','unmet_need'),('google_news','news','market_momentum'),('google_ads_transparency_center','ads','advertising_gap')])
def test_optional_engine_failure(client, monkeypatch, engine, key, score_key):
    original = SearchClient.search
    async def fail(self, name, params):
        if name == engine:
            raise EngineError()
        return await original(self, name, params)
    monkeypatch.setattr(SearchClient, 'search', fail)
    result = report(client)
    assert result['status'] == 'complete', result
    assert result['sections'][key]['status'] == 'failed'
    assert result['component_scores'][score_key] == 50
    assert result['methodology']['confidence_points'][key] == 0
    assert len(result['competitors']) == 6


def test_maps_and_auth_failure_do_not_leak(client, monkeypatch):
    secret = 'TEST_SECRET_MUST_NEVER_LEAK'
    async def fail(*args):
        raise RuntimeError('provider URL?api_key=' + secret)
    monkeypatch.setattr(SearchClient, 'search', fail)
    result = report(client)
    assert result['status'] == 'failed'
    assert secret not in json.dumps(result)


def test_auth_error_in_optional_engine_fails_job(client, monkeypatch):
    original = SearchClient.search
    async def fail(self, name, params):
        if name == 'google_news':
            raise EngineError('AUTH_ERROR')
        return await original(self, name, params)
    monkeypatch.setattr(SearchClient, 'search', fail)
    result = report(client)
    assert result['status'] == 'failed'
    assert 'configuration' in result['error_message']


def test_empty_maps_neutral(client, monkeypatch):
    original = SearchClient.search
    async def empty(self, name, params):
        return {} if name == 'google_maps' else await original(self, name, params)
    monkeypatch.setattr(SearchClient, 'search', empty)
    result = report(client)
    assert result['status'] == 'complete'
    assert result['component_scores']['competition_gap'] == 50
    assert result['methodology']['confidence_points']['maps'] == 0
    assert result['sections']['reviews']['status'] == 'skipped'


def test_health_unknown_report_and_fixture_guard(client):
    assert client.get('/health').json()['live_serpapi_enabled'] is False
    assert client.get('/api/analyses/00000000-0000-0000-0000-000000000000').status_code == 404
    assert client.post('/api/analyses', json={**PUNE, 'city':'Delhi'}).status_code == 422


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(settings, 'rate_limit_per_hour', 1)
    report(client)
    assert client.post('/api/analyses', json={**PUNE, 'refresh':True}).status_code == 429


def test_request_limits_and_error_envelope(client):
    assert client.post('/api/analyses', content='a'*20000).status_code == 413
    assert client.get('/missing').json()['error']['code'] == 'HTTP_ERROR'
    assert client.get('/api/analyses/not-a-uuid').status_code == 422


def test_partial_review_failure_preserves_excerpts(client, monkeypatch):
    original = SearchClient.search
    async def fail_one(self, name, params):
        if name == 'google_maps_reviews' and params['data_id'] == 'fixture-place-0':
            raise EngineError()
        return await original(self,name,params)
    monkeypatch.setattr(SearchClient,'search',fail_one)
    result=report(client)
    assert result['status']=='complete'
    assert result['component_scores']['unmet_need']==50
    assert result['methodology']['confidence_points']['reviews']==0
    assert result['review_topics']
    assert result['sections']['reviews']['count']==16
