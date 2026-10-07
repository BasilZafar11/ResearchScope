"""Auditable next steps derived only from returned metadata and excerpts."""
from collections import Counter
import re


DIMENSIONS = {
    'method': ('method', 'model', 'algorithm', 'architecture', 'training', 'process', 'workflow'),
    'dataset': ('dataset', 'data', 'corpus', 'sample', 'benchmark', 'images', 'records'),
    'application': ('application', 'domain', 'setting', 'deployment', 'use', 'device', 'population'),
    'evaluation': ('evaluation', 'experiment', 'metric', 'accuracy', 'baseline', 'validation', 'trial'),
    'combination': ('combine', 'integrate', 'hybrid', 'joint', 'together', 'end-to-end'),
}


def tokens(value):
    return set(re.findall(r'[a-z0-9]+', (value or '').lower()))


def contribution_breakdown(report):
    evidence = (report['papers'] + report['patents'])[:40]
    proposal = ' '.join([report['input']['title'], report['input']['abstract'], *report['input']['claims']])
    proposal_terms = tokens(proposal)
    result = []
    for name, cues in DIMENSIONS.items():
        found = sorted(set(cues) & proposal_terms)
        matches = []
        if found:
            for item in evidence:
                shared = sorted(set(found) & tokens(item['title'] + ' ' + item['summary_text']))
                if shared:
                    matches.append({'evidence_id': item['id'], 'title': item['title'], 'source_url': item.get('source_url'),
                                    'shared_terms': shared, 'excerpt': item['summary_text'][:500]})
        result.append({'dimension': name, 'proposal_terms': found, 'evidence_matches': matches[:3],
                       'assessment': 'overlap in retrieved text' if matches else ('needs a targeted search' if found else 'not specified in proposal')})
    return result


def closest_work(report):
    proposal = tokens(' '.join([report['input']['title'], report['input']['abstract'], *report['input']['claims']]))
    items = sorted(report['papers'] + report['patents'], key=lambda item: item['similarity_score'], reverse=True)[:3]
    result = []
    for item in items:
        evidence = tokens(item['title'] + ' ' + item['summary_text'])
        shared = sorted(proposal & evidence)
        distinct = sorted((proposal - evidence) - {'the','and','for','with','from','this','that','our','using'})
        result.append({'evidence_id': item['id'], 'title': item['title'], 'source_url': item.get('source_url'),
                       'source_type': item['source_type'], 'similarity_score': item['similarity_score'],
                       'shared_terms': shared[:12], 'proposal_terms_not_in_excerpt': distinct[:12],
                       'excerpt': item['summary_text'][:650],
                       'limitation': 'Differences reflect returned excerpts only; inspect full text before asserting a contribution.'})
    return result


def search_coverage(report):
    engines = Counter(q['engine'] for q in report['queries'])
    sources = {'scholar': len(report['papers']), 'patent': len(report['patents']), 'web': len(report['web_results'])}
    years = [int(m.group()) for item in report['papers'] + report['patents']
             if (m := re.search(r'\b(?:19|20)\d{2}\b', item.get('priority_date') or item.get('publication_date') or ''))]
    needs = []
    if not sources['scholar']: needs.append('Search another academic index and review results manually.')
    if not sources['patent']: needs.append('Check patent databases and jurisdictions beyond this search.')
    if not years: needs.append('Verify publication and priority dates in original records.')
    if report['warnings']: needs.append('Review source warnings and rerun any failed searches.')
    needs.append('Inspect full texts of close results; search snippets cannot establish absence of prior work.')
    return {'queries_by_engine': dict(engines), 'records_by_source': sources,
            'earliest_returned_year': min(years) if years else None,
            'latest_returned_year': max(years) if years else None,
            'full_texts_inspected': 0, 'source_warnings': report['warnings'], 'next_checks': needs}


def gaps_and_experiments(report):
    gaps, experiments = [], []
    for claim in report['claims']:
        title = claim['text']
        query = f'"{title[:130]}" baseline evaluation'
        if claim['coverage_score'] < 45:
            gaps.append({'claim_id': claim['id'], 'hypothesis': 'This claim has limited overlap in returned excerpts.',
                         'basis': f"Best excerpt match: {claim['coverage_score']}% across {len(claim['matches'])} ranked records.",
                         'follow_up_query': query, 'status': 'unverified search hypothesis'})
        top = claim['matches'][0] if claim['matches'] else None
        experiments.append({'claim_id': claim['id'], 'question': f'How would you test: {title}',
                            'baseline_evidence_id': top['evidence_id'] if top else None,
                            'baseline_title': top['title'] if top else 'Choose a published baseline after a deeper search',
                            'suggested_checks': ['Define an outcome metric and comparison dataset or population.',
                                                 'Compare against the closest published method under the same conditions.',
                                                 'Remove each proposed component in an ablation study.'],
                            'limitation': 'These are planning prompts; source excerpts do not establish feasible datasets or metrics.'})
    return gaps, experiments


def build_guidance(report):
    gaps, experiments = gaps_and_experiments(report)
    return {'contributions': contribution_breakdown(report), 'closest_work': closest_work(report),
            'coverage': search_coverage(report), 'gap_hypotheses': gaps, 'experiments': experiments}


def contribution_brief(report):
    guidance = report.get('research_guidance') or build_guidance(report)
    return {'title': report['input']['title'], 'idea': report['input']['abstract'],
            'closest_work': guidance['closest_work'], 'claims': report['claims'],
            'candidate_differences': guidance['gap_hypotheses'], 'experiments': guidance['experiments'],
            'coverage': guidance['coverage'], 'queries': report['queries'],
            'caution': 'Candidate differences are excerpt based and require full-text review. This brief is not a novelty or patentability opinion.'}
