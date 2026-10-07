from datetime import datetime,timezone
import pytest
from app.analysis.scoring import score
from app.analysis.recommendations import RuleBasedAnalyzer
from app.analysis.topics import classify_reviews

SECTIONS = {k:{'status':'complete'} for k in ['maps','reviews','trends','news','ads']}


def test_missing_signals_are_neutral():
    r = score([],[],[],[],[],SECTIONS)
    assert r['overall_score'] == 50
    assert r['confidence_score'] == 0
    assert all(v == 50 for v in r['component_scores'].values())


@pytest.mark.parametrize('previous,latest,expected', [(50,100,100),(100,0,0),(0,0,50),(0,10,100),(20,25,75)])
def test_demand_boundaries(previous, latest, expected):
    series = [{'values':{'q':v}} for v in [10,10,previous,latest]]
    r = score([],series,[],[],[],SECTIONS)
    assert r['component_scores']['demand'] == expected
    assert all(0 <= s <= 100 for s in r['component_scores'].values())


def test_repeat_requires_distinct_competitors():
    base = {'rating':2,'text':'parking and internet','data_id':'1','competitor':'A','source_url':None}
    topics = classify_reviews([base,base])
    assert not any(t['repeated'] for t in topics)
    topics = classify_reviews([base,{**base,'data_id':'2','competitor':'B'}])
    assert all(t['repeated'] for t in topics)


def test_news_word_boundaries_and_unknown_dates():
    news = [{'title':'A demand for regulation','snippet':'','published_at':None}]
    r = score([],[],[],news,[],SECTIONS)
    assert r['component_scores']['market_momentum'] == 50
    assert r['methodology']['confidence_points']['news'] == 0
    assert news[0]['sentiment'] == 'neutral'


def test_unavailable_evidence_not_in_recommendation():
    sections = {k:{'status':'failed'} for k in SECTIONS}
    r = score([],[],[],[],[],sections)
    recommendation = RuleBasedAnalyzer().recommend(r,sections,[])
    assert recommendation['strengths'] == []
    assert recommendation['risks'] == []
    assert len(recommendation['next_checks']) == 1


def test_topic_membership_includes_places_beyond_representative_excerpts():
    rows = [{'rating':2,'text':'parking','data_id':'a','competitor':'A'} for _ in range(4)]
    rows.append({'rating':2,'text':'parking','data_id':'b','competitor':'B'})
    topic = classify_reviews(rows)[0]
    assert len(topic['excerpts']) == 3
    assert {p['data_id'] for p in topic['competitors']} == {'a','b'}
