import pytest
import serpapi
from app.config import settings
from app.errors import EngineError
from app.serpapi_clients.base import SearchClient


def test_fixture_cannot_enable_live_without_flag():
    with pytest.raises(EngineError):
        SearchClient(live=True)


def test_transient_retry_is_bounded(monkeypatch):
    from pydantic import SecretStr
    monkeypatch.setattr(settings, 'serpapi_key', SecretStr('TEST_ONLY'))
    calls = []
    class FakeClient:
        def __init__(self, **kwargs): pass
        def search(self, params):
            calls.append(params)
            raise TimeoutError('request containing a secret must not leak')
    monkeypatch.setattr(serpapi, 'Client', FakeClient)
    with pytest.raises(EngineError) as exc:
        SearchClient()._search('google_maps', {'q':'test'})
    assert str(exc.value) == 'ENGINE_UNAVAILABLE'
    assert len(calls) == 3
    assert all('no_cache' not in p and 'api_key' not in p for p in calls)


def test_allowance_halts_without_retry(monkeypatch):
    from pydantic import SecretStr
    monkeypatch.setattr(settings, 'serpapi_key', SecretStr('TEST_ONLY'))
    calls=[]
    class FakeClient:
        def __init__(self, **kwargs): pass
        def search(self, params):
            calls.append(params)
            return {'error':'Your account has run out of searches'}
    monkeypatch.setattr(serpapi, 'Client', FakeClient)
    client=SearchClient()
    with pytest.raises(EngineError, match='ALLOWANCE_UNAVAILABLE'):
        client._search('google_maps', {})
    assert client.halted
    with pytest.raises(EngineError, match='ALLOWANCE_UNAVAILABLE'):
        client._search('google_news', {})
    assert len(calls)==1
