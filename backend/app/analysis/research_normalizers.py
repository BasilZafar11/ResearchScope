"""Small allowlisted source records; provider metadata and tokens never leave here."""
import hashlib
import math
import re
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from app.errors import EngineError


def text(value, limit=1000):
    return value[:limit].strip() if isinstance(value, str) else ''


def obj(value):
    return value if isinstance(value, dict) else {}


def rows(value):
    return [v for v in value if isinstance(v, dict)] if isinstance(value, list) else []


def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0 else None


def safe_url(value):
    try:
        parsed = urlsplit(text(value, 3000))
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
            return None
        if parsed.hostname == 'serpapi.com' or parsed.hostname.endswith('.serpapi.com'):
            return None
        query = [(k,v) for k,v in parse_qsl(parsed.query, keep_blank_values=True) if k.lower() not in ('api_key','key','token','access_token')]
        return urlunsplit((parsed.scheme,parsed.netloc,parsed.path,urlencode(query),parsed.fragment))
    except ValueError:
        return None


def strings(value):
    return [text(v, 200) for v in value[:12] if isinstance(v, str)] if isinstance(value, list) else []


def currency(item, price):
    explicit = text(item.get('currency'), 10)
    if explicit in ('USD','INR','EUR','GBP','CAD','AUD','JPY'):
        return explicit
    for pattern, label in [(r'₹|\bINR\b','INR'),(r'£|\bGBP\b','GBP'),(r'€|\bEUR\b','EUR'),(r'US\$|\bUSD\b','USD'),(r'\$','Unspecified $')]:
        if re.search(pattern, price):
            return label
    return 'Unknown'


def record(title, url=None, detail='', meta=None, tags=None, image=None):
    return {'title':text(title,300) or 'Untitled result','url':safe_url(url),'detail':text(detail,1800),
            'meta':meta or {},'tags':tags or [],'image':safe_url(image)}


def normalize(tool, raw, context):
    if not isinstance(raw, dict):
        raise EngineError('INVALID_RESPONSE')
    expected = {'directions':['directions'], 'forums':['organic_results'], 'autocomplete':['suggestions'], 'events':['events_results'],
                'jobs':['jobs_results'], 'shopping':['shopping_results','inline_shopping_results'], 'hotels':['properties'],
                'flights':['best_flights','other_flights'], 'images':['images_results'], 'scholar':['organic_results']}[tool]
    if raw and not any(key in raw for key in expected) and obj(raw.get('search_information')).get('total_results') != 0:
        raise EngineError('INVALID_RESPONSE')
    output = []
    if tool == 'directions':
        for r in rows(raw.get('directions'))[:8]:
            mode = text(r.get('travel_mode')).lower()
            if mode != context['mode']:
                continue
            seconds, metres = number(r.get('duration')), number(r.get('distance'))
            output.append(record('Route via '+(text(r.get('via')) or 'reported route'), obj(raw.get('search_metadata')).get('google_maps_directions_url'),
                '; '.join(strings(r.get('extensions'))), {'Minutes':round(seconds/60,1) if seconds is not None else None,
                'Kilometres':round(metres/1000,2) if metres is not None else None,'Travel mode':mode,'Competitor rank':context['rank']}))
    elif tool == 'autocomplete':
        for r in rows(raw.get('suggestions'))[:12]:
            value = text(r.get('value'))
            if not value:
                continue
            intent = 'Local access' if re.search(r'\b(near|nearby|location)\b',value,re.I) else 'Price' if re.search(r'\b(price|cost|cheap|fees)\b',value,re.I) else 'Comparison' if re.search(r'\b(best|vs|alternative|review)\b',value,re.I) else 'Other intent'
            output.append(record(value,'https://www.google.com/search?'+urlencode({'q':value}),meta={'Prefix':context['query']},tags=[intent]))
    elif tool == 'forums':
        for r in rows(raw.get('organic_results'))[:12]:
            answers = rows(r.get('answers'))[:2]
            snippet = text(r.get('snippet'))
            topics = [label for label,words in {'Price':['price','cost','expensive'],'Access':['parking','access','hours'],'Quality':['noise','wifi','quality'],'Alternatives':['alternative','recommend','instead']}.items() if any(w in (text(r.get('title'))+' '+snippet).lower() for w in words)]
            output.append(record(r.get('title'),r.get('link'),snippet,{'Source':text(r.get('source')),'Date':text(r.get('date')),
                'Answer excerpt':' | '.join(text(a.get('answer')) for a in answers)},topics or ['Unclassified']))
    elif tool == 'events':
        for r in rows(raw.get('events_results'))[:12]:
            date = obj(r.get('date'))
            output.append(record(r.get('title'),r.get('link'),r.get('description'),{'When':text(date.get('when')),'Start label':text(date.get('start_date')),
                'Address':', '.join(strings(r.get('address'))),'Venue':text(obj(r.get('venue')).get('name'))}))
    elif tool == 'jobs':
        for r in rows(raw.get('jobs_results'))[:10]:
            description = text(r.get('description'),1800)
            extensions = obj(r.get('detected_extensions'))
            links = rows(r.get('apply_options')) or rows(r.get('related_links'))
            skills = [s for s in ('customer service','sales','marketing','operations','excel','python','management','hospitality') if re.search(r'\b'+s+r'\b',description,re.I)]
            output.append(record(r.get('title'),next((a.get('link') for a in links if safe_url(a.get('link'))),None),description,
                {'Employer':text(r.get('company_name')),'Location':text(r.get('location')),'Posted':text(extensions.get('posted_at')),
                 'Schedule':text(extensions.get('schedule_type')),'Salary':text(extensions.get('salary'))},skills))
    elif tool == 'shopping':
        for r in (rows(raw.get('shopping_results'))+rows(raw.get('inline_shopping_results')))[:20]:
            price = text(r.get('price'))
            output.append(record(r.get('title'),r.get('product_link') or r.get('link'),r.get('snippet'),
                {'Seller':text(r.get('source')),'Listed price':price,'Amount':number(r.get('extracted_price')),
                 'Currency':currency(r,price),'Delivery':text(r.get('delivery')),'Rating':number(r.get('rating'))}))
    elif tool == 'hotels':
        for r in rows(raw.get('properties'))[:10]:
            rate = obj(r.get('rate_per_night'))
            output.append(record(r.get('name'),r.get('link'),r.get('description'),{'Check-in':context['check_in'],
                'Nightly rate':text(rate.get('lowest')),'Amount':number(rate.get('extracted_lowest')),'Currency':context['currency'],
                'Rating':number(r.get('overall_rating')),'Amenities':', '.join(strings(r.get('amenities')))}))
    elif tool == 'flights':
        for r in (rows(raw.get('best_flights'))+rows(raw.get('other_flights')))[:15]:
            legs = rows(r.get('flights'))
            route = ' → '.join([text(obj(legs[0].get('departure_airport')).get('id'))] + [text(obj(a.get('arrival_airport')).get('id')) for a in legs]) if legs else 'Flight itinerary'
            output.append(record(route,obj(raw.get('search_metadata')).get('google_flights_url'),', '.join(dict.fromkeys(text(a.get('airline')) for a in legs)),
                {'Amount':number(r.get('price')),'Currency':context['currency'],'Duration (minutes)':number(r.get('total_duration')),
                 'Connections':max(len(legs)-1,0) if legs else None,'Departure date':context['date'],
                 'Flight numbers':', '.join(text(a.get('flight_number')) for a in legs)}))
    elif tool == 'images':
        for r in rows(raw.get('images_results'))[:12]:
            output.append(record(r.get('title'),r.get('link'),meta={'Publisher':text(r.get('source'))}, image=safe_url(r.get('thumbnail')) or safe_url(r.get('original'))))
    elif tool == 'scholar':
        for r in rows(raw.get('organic_results'))[:10]:
            pub = text(obj(r.get('publication_info')).get('summary'))
            year = re.search(r'\b(?:19|20)\d{2}\b',pub)
            output.append(record(r.get('title'),r.get('link'),r.get('snippet'),{'Publication':pub,'Year':year.group() if year else '',
                'Cited by':number(obj(obj(r.get('inline_links')).get('cited_by')).get('total'))}))
    seen = set()
    unique = []
    for row in output:
        identity = json_identity(row)
        if identity in seen:
            continue
        seen.add(identity)
        row['id'] = hashlib.sha256((tool + identity).encode()).hexdigest()[:20]
        unique.append(row)
    return unique


def json_identity(row):
    import json
    return json.dumps(row,sort_keys=True)
