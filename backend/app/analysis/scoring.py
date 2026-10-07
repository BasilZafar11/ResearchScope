import math
import statistics
from datetime import datetime, timezone
from app.analysis.topics import classify_reviews, matches, POSITIVE, NEGATIVE, TOPICS

WEIGHTS = {'demand': .25, 'competition_gap': .25, 'unmet_need': .25, 'market_momentum': .15, 'advertising_gap': .10}


def clamp(n):
    return max(0, min(100, n))


def age(date, reference):
    if not date:
        return None
    try:
        value = datetime.fromisoformat(date.replace('Z', '+00:00'))
        return (reference - value.replace(tzinfo=value.tzinfo or timezone.utc)).days
    except ValueError:
        return None


def score(competitors, series, reviews, news, advertising, sections, reference=None):
    reference = reference or datetime.now(timezone.utc)
    scores = {name: 50.0 for name in WEIGHTS}
    details = {}
    demands = []
    for keyword in sorted({k for p in series for k in p['values']}):
        points = [p['values'][keyword] for p in series if keyword in p['values']]
        if len(points) < 4:
            continue
        quarter = max(1, len(points) // 4)
        latest, previous = statistics.mean(points[-quarter:]), statistics.mean(points[-2 * quarter:-quarter])
        # 0->0 provides no direction; 0->positive saturates the mapping at +50%.
        change = ((latest - previous) / previous * 100) if previous else (50 if latest else 0)
        demands.append(dict(keyword=keyword, latest_average=round(latest, 2), previous_average=round(previous, 2), change_percent=round(change, 2), score=clamp(change + 50), points=len(points)))
    if demands:
        scores['demand'] = statistics.mean(d['score'] for d in demands)
    details['demand'] = {'keywords': demands, 'formula': 'Mean across valid keywords of clamp(50 + percentage change, 0, 100). Compare the latest floor(N/4) points with the preceding floor(N/4). Minimum 4 points. A zero baseline maps zero interest to 50 and positive interest to 100.'}
    median_reviews = statistics.median([c['review_count'] for c in competitors]) if competitors else 0
    if competitors:
        scores['competition_gap'] = 100 * (1 - (.65 * min(len(competitors), 20) / 20 + .35 * min(math.log10(median_reviews + 1) / 4, 1)))
    coordinates = [(c['latitude'], c['longitude']) for c in competitors if c['latitude'] is not None]
    details['competition_gap'] = {'count': len(competitors), 'median_reviews': median_reviews, 'coordinate_count': len(coordinates), 'formula': '100 × (1 − (0.65 × count/20 + 0.35 × min(log10(median reviews + 1)/4, 1))). Empty results use 50. Coordinates describe location, but are not included in this formula; one result page is not a market census.'}
    topics = classify_reviews(reviews)
    negative = sum(r['rating'] <= 3 for r in reviews)
    repeated = sum(t['mentions'] for t in topics if t['repeated'])
    if reviews and sections['reviews']['status'] == 'complete':
        scores['unmet_need'] = .6 * negative / len(reviews) * 100 + .4 * min(repeated / 8 * 100, 100)
    details['unmet_need'] = {'sample_size': len(reviews), 'negative_reviews': negative, 'repeated_topic_mentions': repeated, 'topics': TOPICS, 'formula': '0.60 × negative share × 100 + 0.40 × min(repeated topic mentions / 8 × 100, 100). Negative ratings: 1–3. Repeated means the topic appears at 2+ competitors. Each review can mention multiple topics; Other is never rewarded. Any review request failure uses neutral 50.'}
    weighted, total = 0, 0
    for item in news:
        positive, negative_words = matches(item['title'] + ' ' + item['snippet'], POSITIVE), matches(item['title'] + ' ' + item['snippet'], NEGATIVE)
        direction = 1 if positive and not negative_words else -1 if negative_words and not positive else 0
        days = age(item['published_at'], reference)
        weight = 1 / (1 + days / 30) if days is not None and days >= 0 else .25
        item.update(sentiment='positive' if direction > 0 else 'negative' if direction < 0 else 'neutral', matched_keywords=positive + negative_words, weight=round(weight, 3))
        weighted += direction * weight
        total += weight
    if total:
        scores['market_momentum'] = clamp(50 + 50 * weighted / total)
    details['market_momentum'] = {'positive_words': POSITIVE, 'negative_words': NEGATIVE, 'formula': '50 + 50 × sum(direction × recency weight)/sum(weights). Positive-only = +1, negative-only = −1, both/neither = 0. Weight = 1/(1 + age in days/30); unknown or future date = 0.25. No articles = 50. Keyword matches are heuristic, not factual sentiment judgments.'}
    active = {a['advertiser_id'] or a['advertiser'] for a in advertising if (age(a['last_shown'], reference) is not None and 0 <= age(a['last_shown'], reference) <= 30)}
    if active and sections['ads']['status'] == 'complete':
        scores['advertising_gap'] = {1: 65, 2: 45, 3: 25}[min(3, len(active))]
    details['advertising_gap'] = {'active_advertisers': len(active), 'formula': '0 matched active advertisers = neutral 50; 1 = 65; 2 = 45; 3+ = 25. Active means last shown within 30 days. Recency adjustment is 0 in v1.0. Matches require exact normalized advertiser name or corroborated domain. Scope is worldwide, not city-level ad spend.'}
    recent_news = sum(age(n['published_at'], reference) is not None and 0 <= age(n['published_at'], reference) <= 90 for n in news)
    confidence_parts = {'maps': 25 if competitors else 0, 'reviews': 25 if len(reviews) >= 18 and sections['reviews']['status'] == 'complete' else 0,
                        'trends': 20 if demands else 0, 'news': 15 if recent_news >= 5 else 0, 'ads': 15 if active and sections['ads']['status'] == 'complete' else 0}
    scores = {k: round(clamp(v), 2) for k, v in scores.items()}
    overall = int(sum(scores[k] * WEIGHTS[k] for k in scores) + .5)
    confidence = sum(confidence_parts.values())
    return dict(overall_score=overall, component_scores=scores, confidence_score=confidence,
                confidence_label='High' if confidence >= 80 else 'Medium' if confidence >= 50 else 'Low',
                interpretation='Strong signals' if overall >= 75 else 'Mixed-positive' if overall >= 55 else 'Mixed' if overall >= 40 else 'Weak signals',
                review_topics=topics, methodology={'weights': WEIGHTS, 'components': details, 'confidence_points': confidence_parts,
                'confidence_rule': 'Completeness only: Maps valid 25; 18+ reviews and all review requests succeed 25; valid Trends 20; 5+ dated articles within 90 days 15; matched active ads and all ad requests succeed 15. High ≥80, Medium ≥50, Low <50.', 'reference_date': reference.isoformat()})
