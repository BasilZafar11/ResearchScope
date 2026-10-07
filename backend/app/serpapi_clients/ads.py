from datetime import datetime, timedelta, timezone
from app.analysis.normalizers import ads
from .base import SearchClient


async def fetch(client: SearchClient, query: str):
    today = datetime.now(timezone.utc)
    return ads(await client.search('google_ads_transparency_center', {'text': query, 'start_date': (today - timedelta(days=30)).strftime('%Y%m%d'), 'end_date': today.strftime('%Y%m%d')}), query)
