from copy import deepcopy
from datetime import datetime
from sqlalchemy import select, func
from app.analysis.stress import stress_test
from app.analysis.scoring import score
from app.models.database import Analysis
from app.db.session import Session
from app.serpapi_clients.base import SearchClient
from conftest import PUNE


def test_stress_is_bounded_read_only_and_uses_saved_reference(client, monkeypatch):
    job = client.post('/api/analyses', json=PUNE).json()
    original = client.get('/api/analyses/' + job['id']).json()
    unchanged = deepcopy(original)
    def no_search(*args, **kwargs):
        raise AssertionError('Stress testing must not search')
    monkeypatch.setattr(SearchClient, 'search', no_search)
    response = client.get('/api/analyses/' + job['id'] + '/stress')
    assert response.status_code == 200, response.text
    result = response.json()
    assert len(result['scenarios']) == len(original['competitors']) + 5
    assert result['minimum'] <= original['overall_score'] <= result['maximum']
    assert result['search_requests'] == 0
    assert all(0 <= s['score'] <= 100 and 0 <= s['confidence'] <= 100 for s in result['scenarios'])
    assert result['scenarios'] == sorted(result['scenarios'], key=lambda s: abs(s['delta']), reverse=True)
    without_news = next(s for s in result['scenarios'] if s['name'] == 'Without news')
    expected = score(original['competitors'], original['trend_series'], original['sampled_reviews'], [], original['advertising'], original['sections'], reference=datetime.fromisoformat(original['methodology']['reference_date']))
    assert without_news['score'] == expected['overall_score']
    assert without_news['confidence'] == expected['confidence_score']
    assert stress_test(original, original['sampled_reviews']) == result
    assert original == unchanged
    assert client.get('/api/analyses/' + job['id']).json() == unchanged
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(Analysis)) == 1


def test_stress_revised_and_unknown_reports(client):
    assert client.get('/api/analyses/00000000-0000-0000-0000-000000000000/stress').status_code == 404
    job = client.post('/api/analyses', json=PUNE).json()
    original = client.get('/api/analyses/' + job['id']).json()
    revision = client.post('/api/analyses/' + job['id'] + '/relevance', json={'competitor_ranks':[original['competitors'][0]['rank']], 'news_indices':[], 'reason':'Not a relevant business'}).json()
    data = client.get('/api/analyses/' + revision['id'] + '/stress').json()
    assert len(data['scenarios']) == len(original['competitors']) + 4
    assert not any(s['name'] == 'Without ' + original['competitors'][0]['name'] for s in data['scenarios'])
    with Session.begin() as db:
        row = db.get(Analysis, job['id'])
        row.report = {**row.report, 'methodology_version':'future'}
    assert client.get('/api/analyses/' + job['id'] + '/stress').status_code == 409
