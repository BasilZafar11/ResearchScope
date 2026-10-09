import math
import ipaddress
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from dateutil.parser import parse


def safe_url(value):
    if not isinstance(value, str):
        return None
    if value!=value.strip() or re.search(r'[\x00-\x1f\x7f-\x9f\\]',value):return None
    try:
        p = urlsplit(value)
        p.port
        if p.scheme not in ('https', 'http') or not p.hostname or p.username or p.password:
            return None
        if p.hostname in ('localhost', '127.0.0.1', '::1'):
            return None
        try:
            if not ipaddress.ip_address(p.hostname).is_global:
                return None
        except ValueError:
            if '.' not in p.hostname or p.hostname.endswith(('.local', '.internal')):
                return None
        # Provider archive URLs can reveal request credentials. Never retain them.
        if p.hostname.endswith('serpapi.com'):
            return None
        query = [(k, v) for k, v in parse_qsl(p.query) if not re.search('key|token|secret|auth|signature', k, re.I) and not k.lower().startswith('utm_')]
        return urlunsplit((p.scheme, p.netloc, p.path, urlencode(query), ''))
    except ValueError:
        return None


def number(value, default=None):
    try:
        n = float(str(value).replace(',', ''))
        return n if math.isfinite(n) else default
    except (ValueError, TypeError):
        return default


def iso_date(value, reference=None):
    if value is None:
        return None
    reference = reference or datetime.now(timezone.utc)
    try:
        if isinstance(value, (int, float)):
            dt = datetime.fromtimestamp(value, timezone.utc)
        else:
            relative = re.fullmatch(r'(\d+)\s+(hour|day|week|month|year)s? ago', str(value))
            if relative:
                dt = reference - timedelta(days=int(relative[1]) * {'hour': 1 / 24, 'day': 1, 'week': 7, 'month': 30, 'year': 365}[relative[2]])
            else:
                dt = parse(str(value))
        return dt.replace(tzinfo=dt.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def hours(raw):
    """Keep only weekly hours, never infer a week from the current open state."""
    if isinstance(raw, list):
        raw = {k: v for item in raw if isinstance(item, dict) for k, v in item.items()}
    if not isinstance(raw, dict):
        return {}
    days = {'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'}
    return {k.lower(): str(v)[:200] for k, v in raw.items() if k.lower() in days and isinstance(v, str)}


def maps(raw):
    out, seen = [], set()
    for r in raw.get('local_results', [])[:20]:
        if not isinstance(r, dict) or not r.get('title'):
            continue
        key = r.get('data_id') or (r['title'], r.get('address'))
        if key in seen:
            continue
        seen.add(key)
        gps = r.get('gps_coordinates') or {}
        lat, lon = number(gps.get('latitude')), number(gps.get('longitude'))
        if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
            lat = lon = None
        rating = number(r.get('rating'))
        out.append(dict(data_id=r.get('data_id'), name=str(r['title'])[:300], business_type=r.get('type'),
                        rating=rating if rating is not None and 0 <= rating <= 5 else None,
                        review_count=max(0, int(number(r.get('reviews'), 0))), address=r.get('address'),
                        latitude=lat, longitude=lon, website=safe_url(r.get('website')), price=r.get('price'),
                        source_url=safe_url(r.get('link')) or 'https://www.google.com/maps/search/?' + urlencode({'api': 1, 'query': r['title'] + ' ' + str(r.get('address', ''))}), rank=len(out) + 1,
                        place_id=r.get('place_id'), data_cid=r.get('data_cid'), operating_hours=hours(r.get('operating_hours'))))
    return out


def reviews(raw, place):
    out = []
    for r in raw.get('reviews', [])[:20]:
        rating = number(r.get('rating'))
        if rating is None or not 1 <= rating <= 5:
            continue
        out.append(dict(competitor=place['name'], data_id=place.get('data_id'), rating=rating, review_id=str(r.get('review_id') or '')[:300],
                        text=str(r.get('snippet') or r.get('text') or '')[:2000],
                        published_at=iso_date(r.get('iso_date') or r.get('date')),
                        source_url=safe_url(r.get('link')), likes=max(0, int(number(r.get('likes'), 0)))))
    return out


def trends(raw):
    series = []
    for point in (raw.get('interest_over_time') or {}).get('timeline_data', []):
        vals = {}
        for v in point.get('values', []):
            n = number(v.get('extracted_value', v.get('value')))
            if n is not None and 0 <= n <= 100 and v.get('query'):
                vals[v['query']] = n
        if vals:
            series.append({'date': point.get('date', ''), 'timestamp': number(point.get('timestamp')), 'values': vals})
    return sorted(series, key=lambda p: p['timestamp'] or 0)


def news(raw):
    out, seen = [], set()
    def flatten(items):
        for r in items:
            if r.get('title') and r.get('link'):
                yield r
            yield from flatten(r.get('stories', []))
    for r in flatten(raw.get('news_results', [])):
        url = safe_url(r.get('link'))
        if not url or url in seen:
            continue
        seen.add(url)
        source = r.get('source') or {}
        out.append(dict(title=str(r['title'])[:500], source=source.get('name', '') if isinstance(source, dict) else str(source),
                        source_url=url, published_at=iso_date(r.get('iso_date') or r.get('date')),
                        snippet=str(r.get('snippet') or '')[:2000], thumbnail=safe_url(r.get('thumbnail'))))
    return sorted(out, key=lambda r: r['published_at'] or '', reverse=True)[:10]


def ads(raw, query):
    out = []
    domain = query.lower().removeprefix('www.')
    for r in raw.get('ad_creatives', [])[:30]:
        name = str(r.get('advertiser') or '')
        target = str(r.get('target_domain') or '').lower().removeprefix('www.')
        name_match = re.sub(r'\W', '', query.lower()) == re.sub(r'\W', '', name.lower())
        domain_match = '.' in domain and (target == domain or target.endswith('.' + domain))
        # Free-text results can include unrelated advertisers. Require corroboration.
        if not (name_match or domain_match):
            continue
        advertiser = raw.get('advertiser') or {}
        out.append(dict(advertiser=name, advertiser_id=r.get('advertiser_id'), creative_id=r.get('ad_creative_id'),
                        registration_country=advertiser.get('country'), format=r.get('format'),
                        first_shown=iso_date(r.get('first_shown')), last_shown=iso_date(r.get('last_shown')),
                        platforms=r.get('platforms', []), destination_url=safe_url('https://' + target) if target else None,
                        source_url=safe_url(r.get('details_link')), matched_query=query))
    return out
