import pytest
from app.analysis.topics import review_matrix
from app.errors import EngineError
from app.serpapi_clients.base import SearchClient
from conftest import PUNE

def test_matrix_separates_ratings_and_keeps_evidence():
    rows = review_matrix([dict(data_id='a', competitor='Same', rating=r, text=t, source_url='https://example.com') for r,t in [(5,'Helpful staff and clean desks'),(2,'Rude staff')]] + [dict(data_id='b',competitor='Same',rating=4,text='No topic')])
    assert len(rows) == 2
    assert rows[0]['sample_size'] == 2
    assert len(rows[0]['topics']['Service']['positive']) == 1
    assert len(rows[0]['topics']['Service']['negative']) == 1
    assert rows[1]['topics'] == {}

def test_research_end_to_end(client):
    created = client.post('/api/analyses', json=PUNE).json()
    result = client.get(created['report_url'].replace('/reports/', '/api/analyses/')).json()
    assert result['status'] == 'complete'
    assert len(result['related_queries']) == 4
    assert len(result['seasonality_series']) == 60
    assert len(result['review_matrix']) == 3
    assert result['sections']['keywords']['status'] == 'complete'

@pytest.mark.parametrize('data_type,date,key',[('RELATED_QUERIES','today 12-m','keywords'),('TIMESERIES','today 5-y','seasonality')])
def test_research_failures_preserve_report(client,monkeypatch,data_type,date,key):
    original = SearchClient.search
    async def fail(self,engine,params):
        if params.get('data_type') == data_type and params.get('date') == date:
            raise EngineError()
        return await original(self,engine,params)
    monkeypatch.setattr(SearchClient,'search',fail)
    created = client.post('/api/analyses',json=PUNE).json()
    result = client.get('/api/analyses/'+created['id']).json()
    assert result['status'] == 'complete'
    assert result['sections'][key]['status'] == 'unavailable'
    assert result['sections']['trends']['status'] == 'complete'
    assert len(result['competitors']) == 6
