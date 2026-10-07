from app.analysis.normalizers import news
from app.models.schemas import AnalysisInput
from .base import SearchClient


async def fetch(client: SearchClient, request: AnalysisInput):
    return news(await client.search('google_news', {'q': f'"{request.business_category}" "{request.city}" business market', 'gl': request.country_code.lower(), 'hl': 'en'}))
