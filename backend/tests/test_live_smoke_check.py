import importlib.util
from pathlib import Path
import pytest
from app.config import settings
from app.errors import EngineError
from app.serpapi_clients.base import SearchClient

spec = importlib.util.spec_from_file_location('live_smoke',Path(__file__).resolve().parents[2]/'scripts'/'verify_live.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


def test_diagnostic_provider_cap_stops_before_an_extra_attempt(monkeypatch):
    monkeypatch.setattr(settings,'live_serpapi_enabled',True)
    def provider(client,engine,params):
        client.provider_attempts[engine] += 1
        return {}
    monkeypatch.setattr(SearchClient._search,'__wrapped__',provider)
    client = smoke.BoundedClient(2)
    client._search('google_maps',{})
    client._search('google_news',{})
    with pytest.raises(EngineError):
        client._search('google_trends',{})
    assert sum(client.provider_attempts.values()) == 2
    assert client.halted


def test_diagnostic_default_does_not_opt_into_live_search(monkeypatch,capsys):
    monkeypatch.setattr(smoke.sys,'argv',['verify_live.py'])
    def forbidden(*args,**kwargs):
        pytest.fail('Default mode must not instantiate a live provider client')
    monkeypatch.setattr(smoke,'BoundedClient',forbidden)
    assert smoke.main() == 0
    assert 'No requests made' in capsys.readouterr().out
