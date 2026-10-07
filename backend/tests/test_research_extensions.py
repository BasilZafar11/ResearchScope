from datetime import datetime, timezone, timedelta
import pytest
from app.analysis.research_normalizers import normalize, safe_url
from app.models.research import ENGINES
from app.models.database import Analysis
from app.db.session import Session
from app.config import settings
from app.serpapi_clients.base import SearchClient
from app.errors import EngineError
from test_api import report


def inputs(tool, parent):
    day = datetime.now(timezone.utc).date() + timedelta(days=7)
    result = {'tool':tool,'query':'coworking Pune'}
    if tool == 'directions':
        result.update(origin='Pune railway station',competitor_ranks=[p['rank'] for p in parent['competitors'][:3]])
    if tool == 'hotels':
        result.update(check_in=str(day),check_out=str(day+timedelta(days=1)))
    if tool == 'flights':
        result.update(departure_airport='DEL',arrival_airport='PNQ',departure_date=str(day))
    return result


@pytest.mark.parametrize('tool', list(ENGINES))
def test_each_source_collects_bounded_saved_fixture_results(client, tool):
    parent=report(client)
    url=f"/api/analyses/{parent['id']}/research"
    data=inputs(tool,parent)
    response=client.post(url,json=data)
    assert response.status_code==200,response.text
    run=client.get(url+'/'+response.json()['id']).json()
    count=3 if tool in ('directions','hotels','autocomplete') else 1
    assert run['status']=='complete',run
    assert len(run['batches'])==count
    assert all(batch['rows'] for batch in run['batches'])
    assert run['usage']['total_requests']==count
    assert run['usage']['total_provider_attempts']==0
    assert run['data_mode']=='fixture' and run['sample_notice']
    assert client.get('/api/analyses/'+parent['id']).json()==parent
    assert client.post(url,json=data).json()=={'id':run['id'],'cached':True}
    assert client.get(url).json()[0]['id']==run['id']
    refreshed=client.post(url,json={**data,'refresh':True}).json()
    assert refreshed['id']!=run['id']
    assert client.get('/api/analyses/00000000-0000-0000-0000-000000000000/research/'+run['id']).status_code==404


@pytest.mark.parametrize('data',[
    {'tool':'directions','origin':'Pune','competitor_ranks':[999]},
    {'tool':'directions','origin':'Pune','competitor_ranks':[1,1]},
    {'tool':'flights','departure_airport':'DEL','arrival_airport':'DEL'},
    {'tool':'hotels','query':'Pune','check_in':'2000-01-01','check_out':'2000-01-02'},
    {'tool':'events','query':'ab'},
    {'tool':'scholar','query':'valid query','api_key':'forbidden'},
])
def test_invalid_inputs_make_no_job(client,data):
    parent=report(client)
    url=f"/api/analyses/{parent['id']}/research"
    assert client.post(url,json=data).status_code==422
    assert client.get(url).json()==[]


def test_partial_failure_retains_results_without_leaking_exception(client,monkeypatch):
    parent=report(client)
    original=SearchClient.search
    async def search(self,engine,params):
        if params.get('q','').endswith(' for'):
            raise RuntimeError('secret API token should never appear')
        return await original(self,engine,params)
    monkeypatch.setattr(SearchClient,'search',search)
    url=f"/api/analyses/{parent['id']}/research"
    run_id=client.post(url,json=inputs('autocomplete',parent)).json()['id']
    response=client.get(url+'/'+run_id)
    assert response.json()['status']=='partial'
    assert [b['status'] for b in response.json()['batches']]==['complete','failed','complete']
    assert 'secret API' not in response.text


def test_quota_halts_remaining_batches(client,monkeypatch):
    parent=report(client)
    async def search(self,*args):
        self.halted=True
        raise EngineError('ALLOWANCE_UNAVAILABLE')
    monkeypatch.setattr(SearchClient,'search',search)
    url=f"/api/analyses/{parent['id']}/research"
    run_id=client.post(url,json=inputs('autocomplete',parent)).json()['id']
    run=client.get(url+'/'+run_id).json()
    assert run['status']=='failed'
    assert run['completed_requests']==1
    assert [b['status'] for b in run['batches']]==['failed','skipped','skipped']


def test_mode_is_bound_to_parent_and_limit_is_shared(client,monkeypatch):
    parent=report(client)
    url=f"/api/analyses/{parent['id']}/research"
    monkeypatch.setattr(settings,'live_serpapi_enabled',True)
    run_id=client.post(url,json=inputs('events',parent)).json()['id']
    assert client.get(url+'/'+run_id).json()['data_mode']=='fixture'
    monkeypatch.setattr(settings,'rate_limit_per_hour',2)
    assert client.post(url,json=inputs('jobs',parent)).status_code==429
    monkeypatch.setattr(settings,'live_serpapi_enabled',False)
    with Session.begin() as db:
        row=db.get(Analysis,parent['id'])
        row.report={**row.report,'data_mode':'live'}
    assert client.post(url,json=inputs('jobs',parent)).status_code==409


def test_normalization_units_missing_values_and_safe_sources():
    route=normalize('directions',{'directions':[{'travel_mode':'Walking','duration':90,'distance':1500}]},{'mode':'walking','rank':1})[0]
    assert route['meta']['Minutes']==1.5 and route['meta']['Kilometres']==1.5
    products=normalize('shopping',{'shopping_results':[{'title':'A','price':'$0','extracted_price':0},{'title':'B','price':'₹5','extracted_price':5},{'title':'C'}]}, {})
    assert products[0]['meta']['Amount']==0
    assert products[0]['meta']['Currency']=='Unspecified $'
    assert products[1]['meta']['Currency']=='INR'
    assert products[2]['meta']['Amount'] is None
    assert safe_url('https://serpapi.com/search?api_key=secret') is None
    assert safe_url('javascript:alert(1)') is None
    assert safe_url('https://example.org/p?token=secret&q=ok')=='https://example.org/p?q=ok'
    assert normalize('jobs',{'search_information':{'total_results':0}}, {})==[]
    with pytest.raises(EngineError):
        normalize('jobs',{'unexpected':'shape'}, {})
