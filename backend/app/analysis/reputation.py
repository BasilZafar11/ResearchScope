from datetime import datetime, timezone
from statistics import mean


def compare_reviews(place, reviews, reference, status='complete'):
    recent, older, seen = [], [], set()
    ignored = 0
    for review in reviews:
        identity = review.get('review_id') or (review.get('source_url'), review.get('text'), review.get('published_at'), review['rating'])
        if identity in seen:
            continue
        seen.add(identity)
        try:
            date = datetime.fromisoformat(review['published_at'].replace('Z', '+00:00'))
            age = (reference - date.replace(tzinfo=date.tzinfo or timezone.utc)).total_seconds() / 86400
        except (TypeError, ValueError, AttributeError):
            ignored += 1
            continue
        if 0 <= age <= 90:
            recent.append(review)
        elif 90 < age <= 365:
            older.append(review)
        else:
            ignored += 1
    delta = round(mean(r['rating'] for r in recent) - mean(r['rating'] for r in older), 2) if len(recent) >= 3 and len(older) >= 3 and status == 'complete' else None
    return dict(data_id=place['data_id'], competitor=place['name'], status=status,
                recent_count=len(recent), older_count=len(older), ignored_count=ignored,
                recent_average=round(mean(r['rating'] for r in recent), 2) if recent else None,
                older_average=round(mean(r['rating'] for r in older), 2) if older else None,
                delta=delta, direction='Insufficient data' if delta is None else 'Higher recent ratings' if delta >= .25 else 'Lower recent ratings' if delta <= -.25 else 'Similar ratings',
                recent=recent, older=older, reference_date=reference.isoformat())
