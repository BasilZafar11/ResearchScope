"""Explicitly opted-in, bounded provider smoke check; never writes raw responses."""
import argparse
import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from app.config import Settings, settings
from app.errors import EngineError
from app.serpapi_clients.base import SearchClient
from app.models.research import ENGINES, ResearchInput, plan_requests
from app.analysis.research_normalizers import normalize


class BoundedClient(SearchClient):
    def __init__(self, maximum):
        super().__init__(live=True)
        self.maximum = maximum

    def _search(self, engine, params):
        if sum(self.provider_attempts.values()) >= self.maximum:
            self.halted = True
            raise EngineError('ALLOWANCE_UNAVAILABLE')
        # One attempt per planned search in this diagnostic, with no automatic retries.
        return SearchClient._search.__wrapped__(self, engine, params)


async def verify(maximum):
    client = BoundedClient(maximum)
    checks = []
    async def search(label, engine, params, tool=None, context=None):
        try:
            raw = await client.search(engine, params)
            rows = normalize(tool, raw, context or {}) if tool else None
            checks.append({'check':label,'engine':engine,'status':'returned' if raw else 'empty',
                           'normalized_rows':len(rows) if rows is not None else None})
            return raw
        except EngineError as exc:
            if exc.code in ('AUTH_ERROR','ALLOWANCE_UNAVAILABLE'):
                client.halted = True
            checks.append({'check':label,'engine':engine,'status':'failed','code':exc.code})
        except Exception:
            checks.append({'check':label,'engine':engine,'status':'failed','code':'NORMALIZATION_FAILED'})
        return {}

    raw = await search('competitors', 'google_maps', {'q':'coworking space Pune','hl':'en','gl':'in','type':'search'})
    places = raw.get('local_results', [])
    if not isinstance(places,list):
        places = []
    place = next((p for p in places if isinstance(p,dict) and p.get('data_id')),None)
    if place:
        await search('reviews','google_maps_reviews',{'data_id':place['data_id'],'hl':'en'})
    else:
        checks.append({'check':'reviews','status':'pending','reason':'No returned place identifier'})
    await search('news','google_news',{'q':'coworking Pune','hl':'en','gl':'in'})
    await search('trends','google_trends',{'q':'coworking Pune','data_type':'TIMESERIES','geo':'IN','date':'today 12-m'})
    await search('advertising','google_ads_transparency_center',{'text':'WeWork'})
    today = datetime.now(timezone.utc).date() + timedelta(days=14)
    report = {'input':{'city':'Pune','country':'India'},'competitors':[]}
    coordinate_place = next((p for p in places if isinstance(p,dict) and isinstance(p.get('gps_coordinates'),dict)
                             and p['gps_coordinates'].get('latitude') is not None
                             and p['gps_coordinates'].get('longitude') is not None),None)
    if coordinate_place:
        gps = coordinate_place['gps_coordinates']
        report['competitors'] = [{'rank':1,'name':coordinate_place.get('title','Returned venue'),
                                 'latitude':gps['latitude'],'longitude':gps['longitude']}]
    for tool,engine in ENGINES.items():
        values = {'tool':tool,'query':'coworking Pune'}
        if tool == 'directions':
            if not report['competitors']:
                checks.append({'check':tool,'status':'pending','reason':'No returned map coordinates'})
                continue
            values.update(origin='Pune railway station',competitor_ranks=[1])
        if tool == 'hotels':
            values.update(query='hotels Pune',check_in=today,check_out=today+timedelta(days=1))
        if tool == 'flights':
            values.update(departure_airport='DEL',arrival_airport='PNQ',departure_date=today)
        for plan in plan_requests(ResearchInput(**values),report):
            await search(tool,engine,plan['params'],tool,plan['context'])
    print(json.dumps({'checks':checks,'usage':client.usage(),'note':'Returned responses require manual source review; no raw data is saved.'},indent=2))
    return int(any(c['status'] in ('failed','pending') for c in checks))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live',action='store_true',help='Explicitly authorize provider requests')
    parser.add_argument('--max-calls',type=int,help='Hard cap on provider attempts, 1–30; no retries')
    args = parser.parse_args()
    if not args.live:
        print('No requests made. Live verification needs --live and an explicit --max-calls budget.')
        return 0
    if args.max_calls is None or not 1 <= args.max_calls <= 30:
        parser.error('--live requires --max-calls between 1 and 30')
    configured = Settings(_env_file=ROOT/'backend'/'.env')
    if not configured.serpapi_key.get_secret_value():
        print('Pending: configure SERPAPI_KEY in backend/.env. No requests made.')
        return 2
    settings.serpapi_key = configured.serpapi_key
    settings.live_serpapi_enabled = True
    return asyncio.run(verify(args.max_calls))


if __name__ == '__main__':
    raise SystemExit(main())
