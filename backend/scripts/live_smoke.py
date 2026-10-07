"""Explicit, credit-spending integration test. Never invoked by pytest or CI."""
import argparse
import asyncio
import json
from pathlib import Path

from app.config import settings
from app.models.schemas import AnalysisInput
from app.serpapi_clients.base import SearchClient
from app.serpapi_clients import maps, reviews, trends, news, ads
from app.errors import EngineError


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--spend-credits', action='store_true', help='Acknowledge five live searches plus bounded retries')
    args = parser.parse_args()
    if not args.spend_credits or not settings.live_serpapi_enabled or not settings.serpapi_key.get_secret_value():
        parser.error('Set LIVE_SERPAPI_ENABLED=true and SERPAPI_KEY in backend/.env, then pass --spend-credits.')
    request = AnalysisInput(business_category='Coworking space', city='Pune', country='India', keywords=['coworking Pune','shared office Pune','flexible office Pune'], known_competitors=['WeWork','Awfis'])
    client = SearchClient()
    folder = Path('tests/fixtures/live')
    folder.mkdir(parents=True, exist_ok=True)
    # Persist only normalizer output: no search metadata, credentials, or reviewer profiles.
    def save(engine, rows):
        (folder / f'{engine}.normalized.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
        print(f'{engine}: {len(rows)} normalized observations saved')
    try:
        places = await maps.fetch(client, request)
        save('maps', places)
        if not places or not any(p['data_id'] for p in places):
            raise SystemExit('Maps returned no review-capable places; stop and inspect before spending more credits.')
        chosen = max((p for p in places if p['data_id']), key=lambda p:p['review_count']*(p['rating'] or 0))
        for name, call in [('reviews', lambda:reviews.fetch(client,chosen)), ('trends', lambda:trends.fetch(client,request)), ('news', lambda:news.fetch(client,request)), ('ads', lambda:ads.fetch(client,'wework.com'))]:
            if client.halted:
                raise SystemExit('Search allowance unavailable; remaining requests skipped.')
            save(name, await call())
    except EngineError as e:
        raise SystemExit(f'Live smoke test stopped: {e.code}. Earlier normalized snapshots are preserved.') from None
    print('Engine smoke checks finished. Run one complete report through the app next. Inspect snapshots before promoting any fixture to source control.')


if __name__ == '__main__':
    asyncio.run(main())
