import asyncio
from datetime import datetime, timezone
from copy import deepcopy
from app.analysis.reputation import compare_reviews
from app.analysis.normalizers import hours
from app.serpapi_clients.base import SearchClient
from app.models.schemas import AnalysisInput
from app.errors import EngineError
from conftest import PUNE


def make_report(client, **extra):
    response = client.post('/api/analyses',json={**PUNE,**extra})
    assert response.status_code in (200,202), response.text
    return client.get('/api/analyses/'+response.json()['id']).json()


def test_planner_disables_optional_searches_and_changes_cache_key(client,monkeypatch):
    calls=[]
    original=SearchClient.search
    async def record(self,engine,params):
        calls.append((engine,params))
        return await original(self,engine,params)
    monkeypatch.setattr(SearchClient,'search',record)
    options={k:False for k in ('ads','keywords','seasonality','hours','reputation')}
    r=make_report(client,options=options)
    assert r['status']=='complete'
    assert len(calls)==6
    assert r['search_usage']['total_requests']==6
    assert r['search_usage']['total_provider_attempts']==0
    assert all(r['sections'][key]['status']=='skipped' for key in options)
    assert r['component_scores']['advertising_gap']==50
    assert AnalysisInput(**PUNE).fingerprint(False)!=AnalysisInput(**PUNE,options=options).fingerprint(False)
    calls.clear()
    full=make_report(client)
    assert len(calls)==16
    assert full['search_usage']['total_requests']==16
    assert sum(bool(p['operating_hours']) for p in full['competitors'])==3
    assert len(full['reputation'])==3
    assert full['reputation'][0]['older_count']==4
    assert 'next_page_token' not in str(full)


def test_hours_normalization_handles_both_provider_shapes():
    assert hours([{'Monday':'9 AM–6 PM'},{'Sunday':'Closed'}])=={'monday':'9 AM–6 PM','sunday':'Closed'}
    assert hours('Open now')=={}
    assert hours({'monday':'Open 24 hours','phone':'private','tuesday':None})=={'monday':'Open 24 hours'}


def test_reputation_date_windows_dedup_and_failures():
    reference=datetime(2026,10,5,tzinfo=timezone.utc)
    place={'data_id':'x','name':'Example'}
    recent=[{'rating':5,'text':str(i),'published_at':f'2026-09-0{i+1}T00:00:00Z'} for i in range(3)]
    older=[{'rating':3,'text':str(i),'published_at':f'2026-04-0{i+1}T00:00:00Z'} for i in range(3)]
    result=compare_reviews(place,recent+older+[recent[0],{'rating':5,'text':'no date','published_at':None}],reference)
    assert result['recent_count']==result['older_count']==3
    assert result['delta']==2
    assert result['ignored_count']==1
    assert compare_reviews(place,recent+older[:2],reference)['delta'] is None
    assert compare_reviews(place,recent+older,reference,'unavailable')['delta'] is None


def test_optional_detail_failures_preserve_primary_report(client,monkeypatch):
    original=SearchClient.search
    async def fail(self,engine,params):
        if params.get('next_page_token') or params.get('type')=='place':
            raise EngineError()
        return await original(self,engine,params)
    monkeypatch.setattr(SearchClient,'search',fail)
    r=make_report(client)
    assert r['status']=='complete'
    assert r['sections']['reviews']['status']=='complete'
    assert r['sections']['reputation']['status']=='partial'
    assert r['sections']['hours']['status']=='partial'
    assert all(p['delta'] is None for p in r['reputation'])


def test_relevance_revises_without_searches_or_original_mutation(client,monkeypatch):
    original=make_report(client)
    snapshot=deepcopy(original)
    async def forbidden(*args):
        raise AssertionError('Relevance review must not search')
    monkeypatch.setattr(SearchClient,'search',forbidden)
    payload={'competitor_ranks':[1],'news_indices':[0],'reason':'Not relevant to our market'}
    response=client.post('/api/analyses/'+original['id']+'/relevance',json=payload)
    assert response.status_code==200,response.text
    r=client.get('/api/analyses/'+response.json()['id']).json()
    assert len(r['competitors'])==5 and len(r['news'])==4
    assert len(r['sampled_reviews'])==16 and len(r['review_matrix'])==2
    assert r['component_scores']['advertising_gap']==50
    assert r['search_usage']['total_requests']==0
    assert r['methodology']['reference_date']==original['methodology']['reference_date']
    assert r['relevance_audit']['source_report_id']==original['id']
    assert r['confidence_score']<original['confidence_score']
    assert client.get('/api/analyses/'+original['id']).json()==snapshot
    assert client.post('/api/analyses/'+original['id']+'/relevance',json=payload).json()==response.json()
    second=client.post('/api/analyses/'+r['id']+'/relevance',json={**payload,'competitor_ranks':[2]})
    assert second.status_code==200
    assert client.post('/api/analyses/'+original['id']+'/relevance',json={**payload,'competitor_ranks':[999]}).status_code==422
    assert client.post('/api/analyses/'+original['id']+'/relevance',json={'reason':'nothing selected'}).status_code==422


def test_usage_counts_provider_attempts_without_network(monkeypatch):
    from app.config import settings
    from app.serpapi_clients import base
    from pydantic import SecretStr
    monkeypatch.setattr(settings,'live_serpapi_enabled',True)
    monkeypatch.setattr(settings,'serpapi_key',SecretStr('fixture-only-test-value'))
    class FakeClient:
        def __init__(self,**kwargs): pass
        def search(self,params): return {'local_results':[]}
    monkeypatch.setattr(base.serpapi,'Client',FakeClient)
    client=SearchClient()
    asyncio.run(client.search('google_maps',{'q':'example'}))
    assert client.usage()['total_provider_attempts']==1
    client.halted=True
    try: asyncio.run(client.search('google_maps',{}))
    except EngineError: pass
    assert client.usage()['total_requests']==1
