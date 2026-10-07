from copy import deepcopy
from datetime import datetime
from app.analysis.scoring import score
from app.analysis.topics import review_matrix
from app.analysis.recommendations import RuleBasedAnalyzer


def revise_report(original, changes, samples, revision_id, generated_at):
    r = deepcopy(original)
    ranks, indices = set(changes.competitor_ranks), set(changes.news_indices)
    if not ranks and not indices:
        raise ValueError('Select at least one result to exclude.')
    if not ranks.issubset({p['rank'] for p in r['competitors']}) or not indices.issubset(set(range(len(r['news'])))):
        raise ValueError('An excluded result does not belong to this report.')
    removed = [p for p in r['competitors'] if p['rank'] in ranks]
    removed_news = [n for i,n in enumerate(r['news']) if i in indices]
    ids, names = {p['data_id'] for p in removed if p['data_id']}, {p['name'] for p in removed}
    def keep_review(item):
        return item.get('data_id') not in ids if item.get('data_id') else item.get('competitor') not in names
    r['competitors'] = [p for p in r['competitors'] if p['rank'] not in ranks]
    r['news'] = [n for i,n in enumerate(r['news']) if i not in indices]
    r['sampled_reviews'] = [s for s in deepcopy(samples) if keep_review(s)]
    r['review_matrix'] = review_matrix(r['sampled_reviews'])
    r['reputation'] = [s for s in r.get('reputation', []) if keep_review(s)]
    for key, rows in [('maps',r['competitors']),('news',r['news']),('reviews',r['sampled_reviews'])]:
        r['sections'][key]['count'] = len(rows)
        if r['sections'][key]['status'] in ('complete','empty'):
            r['sections'][key]['status'] = 'complete' if rows else 'empty'
    # Advertisers cannot always be reliably joined to individual Maps locations.
    # Drop this signal conservatively after competitor exclusions instead of retaining contamination.
    if removed:
        r['advertising'] = []
        r['sections']['ads'] = {'status':'unavailable','count':0,'message':'Neutralized after competitor exclusions; advertiser-to-location identity is uncertain.'}
        r['warnings'].append('Advertising uses neutral 50 in this revision because advertiser-to-excluded-location identity is uncertain.')
    removed_urls = {n['source_url'] for n in removed_news}
    r['evidence'] = [e for e in r['evidence'] if not (
        (e['evidence_type'] in ('maps','reviews') and (e.get('data_id') in ids or (not e.get('data_id') and e['title'] in names))) or
        (e['evidence_type']=='news' and e.get('source_url') in removed_urls) or
        (removed and e['evidence_type']=='ads'))]
    if 'hours' in r['sections']:
        r['sections']['hours']['count'] = sum(bool(p.get('operating_hours')) for p in r['competitors'])
    if 'reputation' in r['sections']:
        r['sections']['reputation']['count'] = len(r['reputation'])
    result = score(r['competitors'],r['trend_series'],r['sampled_reviews'],r['news'],r['advertising'],r['sections'],
                   reference=datetime.fromisoformat(original['methodology']['reference_date'].replace('Z','+00:00')))
    r.update(result)
    r['recommendation'] = RuleBasedAnalyzer().recommend(result,r['sections'],r['news'])
    r['id'] = revision_id
    r['relevance_audit'] = {'source_report_id':original['id'],'generated_at':generated_at,
                            'reason':changes.reason,'excluded_competitors':[{'rank':p['rank'],'name':p['name']} for p in removed],
                            'excluded_news':[{'title':n['title'],'source_url':n['source_url']} for n in removed_news],
                            'original_score':original['overall_score']}
    r['source_search_usage'] = r.get('search_usage',{})
    r['search_usage'] = {'mode':r['data_mode'],'total_requests':0,'total_provider_attempts':0,'logical_requests':{},'provider_attempts':{},'billing_note':'Recalculated from stored evidence. No new searches.'}
    r['warnings'].append('User-filtered revision: exclusions can bias the result. Observation dates and scoring reference time are inherited from the source report.')
    return r
