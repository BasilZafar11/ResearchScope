import re

TOPICS = {
    'Pricing and hidden fees': ['expensive', 'hidden fee', 'overpriced', 'pricing', 'extra charge'],
    'Service and staff': ['rude', 'staff', 'unhelpful', 'service', 'response'],
    'Availability and capacity': ['unavailable', 'fully booked', 'capacity', 'no desks', 'waiting'],
    'Access, transport and parking': ['parking', 'transport', 'commute', 'access'],
    'Quality and reliability': ['internet', 'wifi', 'wi-fi', 'unreliable', 'broken', 'outage'],
    'Cleanliness and maintenance': ['dirty', 'cleanliness', 'maintenance', 'toilet', 'unclean'],
    'Contracts and flexibility': ['contract', 'deposit', 'refund', 'lock-in', 'cancellation'],
    'Noise and crowding': ['noisy', 'noise', 'crowded', 'loud', 'overcrowded'],
}
POSITIVE = ['expansion', 'opening', 'investment', 'funding', 'partnership', 'growing', 'demand']
NEGATIVE = ['closure', 'shutdown', 'layoffs', 'decline', 'loss', 'bankruptcy', 'regulation', 'ban']

MATRIX_TOPICS = {
    'Pricing': ['price', 'pricing', 'expensive', 'affordable', 'value', 'fee', 'overpriced'],
    'Service': ['staff', 'service', 'helpful', 'rude', 'response'],
    'Cleanliness': ['clean', 'dirty', 'cleanliness', 'maintenance', 'toilet'],
    'Facilities': ['internet', 'wifi', 'wi-fi', 'desk', 'desks', 'meeting', 'facilities', 'parking'],
    'Flexibility': ['contract', 'deposit', 'refund', 'flexible', 'cancellation'],
}


def review_matrix(reviews):
    """Ratings describe the whole review, never inferred sentiment of a phrase."""
    groups = {}
    for review in reviews:
        key = review.get('data_id') or review['competitor']
        group = groups.setdefault(key, dict(competitor=review['competitor'], data_id=review.get('data_id'), sample_size=0, topics={}))
        group['sample_size'] += 1
        for topic, words in MATRIX_TOPICS.items():
            if matches(review['text'], words):
                cell = group['topics'].setdefault(topic, {'positive': [], 'negative': []})
                cell['positive' if review['rating'] >= 4 else 'negative'].append(review)
    return list(groups.values())


def matches(text, words):
    return [word for word in words if re.search(r'\b' + re.escape(word) + r'\b', text, re.I)]


def classify_reviews(reviews):
    groups = {}
    for review in reviews:
        if review['rating'] > 3:
            continue
        names = [name for name, words in TOPICS.items() if matches(review['text'], words)] or ['Other']
        for name in names:
            groups.setdefault(name, []).append(review)
    return sorted([dict(topic=name, mentions=len(items), competitor_count=len({r['data_id'] or r['competitor'] for r in items}),
                        repeated=name != 'Other' and len({r['data_id'] or r['competitor'] for r in items}) >= 2,
                        competitors=list({r['data_id'] or r['competitor']: {'data_id': r['data_id'], 'competitor': r['competitor']} for r in items}.values()),
                        excerpts=items[:3]) for name, items in groups.items()], key=lambda t: (-t['competitor_count'], -t['mentions'], t['topic']))
