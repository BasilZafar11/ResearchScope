LABELS = {'demand': 'Demand', 'competition_gap': 'Competition gap', 'unmet_need': 'Unmet need', 'market_momentum': 'Market momentum', 'advertising_gap': 'Advertising gap'}
SECTIONS = {'demand': 'trends', 'competition_gap': 'maps', 'unmet_need': 'reviews', 'market_momentum': 'news', 'advertising_gap': 'ads'}
HEADLINES = {
    'Strong signals': 'Promising market signals; validate with direct customer and financial research.',
    'Mixed-positive': 'Some attractive signals, with meaningful risks requiring validation.',
    'Mixed': 'Evidence is inconclusive; gather more local and financial information.',
    'Weak signals': 'Current search signals suggest caution before committing resources.',
}


class RuleBasedAnalyzer:
    def recommend(self, result, sections, news):
        available = [(k, v) for k, v in result['component_scores'].items() if sections[SECTIONS[k]]['status'] == 'complete']
        ranked = sorted(available, key=lambda kv: (-kv[1], kv[0]))
        strengths = [{'text': f'{LABELS[k]} is {v:g}/100, among the strongest available components.', 'href': f'#{k}'} for k, v in ranked[:2]]
        risks = [{'text': f'{LABELS[k]} is {v:g}/100, among the weaker available components to validate.', 'href': f'#{k}'} for k, v in sorted(available, key=lambda kv: (kv[1], kv[0]))[:2]]
        checks = [{'text': f'{result["confidence_label"]} confidence ({result["confidence_score"]}/100) measures source completeness. Validate demand, unit economics, and local competition directly.', 'href': '#methodology'}]
        if sections['reviews']['status'] == 'complete':
            for t in [t for t in result['review_topics'] if t['repeated']][:2]:
                checks.append({'text': f'Ask customers about {t["topic"].lower()}: {t["mentions"]} sampled mentions across {t["competitor_count"]} competitors.', 'href': '#unmet_need'})
        if news:
            strongest = max(news, key=lambda n: n['weight'] if n['sentiment'] != 'neutral' else -1)
            if strongest['sentiment'] != 'neutral':
                checks.append({'text': f'Verify the recent {strongest["sentiment"]} news signal: {strongest["title"]}', 'href': '#market_momentum'})
        return dict(headline=HEADLINES[result['interpretation']], strengths=strengths, risks=risks, next_checks=checks)
