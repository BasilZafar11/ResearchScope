"""Bounded, read-only sensitivity checks against the original observation date."""
from copy import deepcopy
from datetime import datetime
from app.analysis.relevance import revise_report
from app.analysis.scoring import score
from app.analysis.recommendations import RuleBasedAnalyzer
from app.models.schemas import RelevanceInput


def stress_test(original, samples):
    scenarios = []

    def add(name, kind, result, note):
        scenarios.append({'id': str(len(scenarios)), 'name': name, 'kind': kind, 'score': result['overall_score'],
                          'delta': result['overall_score'] - original['overall_score'],
                          'interpretation': result['interpretation'],
                          'confidence': result['confidence_score'],
                          'headline': result['recommendation']['headline'], 'note': note})

    for place in original['competitors'][:20]:
        result = revise_report(original, RelevanceInput(competitor_ranks=[place['rank']], news_indices=[], reason='Sensitivity check'),
                               samples, original['id'], original['created_at'])
        add('Without ' + place['name'], 'competitor', result,
            'Removes this location and its reviews; advertising becomes neutral because advertiser joins are uncertain.')

    fields = {'maps': 'competitors', 'reviews': 'sampled_reviews', 'trends': 'trend_series', 'news': 'news', 'ads': 'advertising'}
    for engine, field in fields.items():
        data = deepcopy(original)
        data['sampled_reviews'] = deepcopy(samples)
        data[field] = []
        data['sections'][engine] = {'status': 'unavailable', 'count': 0}
        if engine == 'maps':
            # Reviews and advertiser selection depend on Maps discovery.
            for dependent, payload in [('reviews', 'sampled_reviews'), ('ads', 'advertising')]:
                data[payload] = []
                data['sections'][dependent] = {'status': 'unavailable', 'count': 0}
        result = score(data['competitors'], data['trend_series'], data['sampled_reviews'], data['news'],
                       data['advertising'], data['sections'],
                       reference=datetime.fromisoformat(original['methodology']['reference_date'].replace('Z', '+00:00')))
        result['recommendation'] = RuleBasedAnalyzer().recommend(result, data['sections'], data['news'])
        add('Without ' + engine, 'source', result,
            'Missing components use neutral 50 with fixed weights.' + (' Also removes dependent reviews and ads.' if engine == 'maps' else ''))
    scores = [original['overall_score']] + [s['score'] for s in scenarios]
    return {'baseline': original['overall_score'], 'minimum': min(scores), 'maximum': max(scores),
            'changed_interpretations': sum(s['interpretation'] != original['interpretation'] for s in scenarios),
            'scenarios': sorted(scenarios, key=lambda s: abs(s['delta']), reverse=True), 'search_requests': 0}
