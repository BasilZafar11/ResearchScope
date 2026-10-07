import asyncio
import httpx
import pytest
from fastapi import HTTPException
from starlette.requests import Request
from app import integrity_api as api


def test_doi_and_metadata_precision():
    assert api.normalize_doi('https://doi.org/10.1234/ABC') == '10.1234/abc'
    with pytest.raises(HTTPException):
        api.normalize_doi('https://untrusted.example/paper')
    work = api.work_summary({'DOI':'10.1234/abc','title':['A paper'],'published':{'date-parts':[[2024]]},'abstract':'<jats:p>Finding</jats:p>'})
    assert work['date'] == '2024'
    assert work['abstract'] == 'Finding'


def test_updates_keep_only_target_doi_and_do_not_infer_clean_status(monkeypatch):
    async def fake(path, params=None):
        if params:
            return {'total-results':1,'items':[{'DOI':'10.1234/notice','title':['Correction'],
                    'update-to':[{'DOI':'10.1234/target','type':'correction','source':'publisher'},
                                 {'DOI':'10.1234/other','type':'retraction'}]}]}
        return {'DOI':'10.1234/target','title':['Target']}
    monkeypatch.setattr(api,'crossref',fake)
    result=asyncio.run(api.publication_updates('10.1234/target'))
    assert len(result['notices']) == 1
    assert result['notices'][0]['kind'] == 'correction'
    assert 'not proof' in result['coverage']


def test_failed_provider_is_visible_and_not_cached(monkeypatch):
    class Client:
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def get(self,*args,**kwargs): raise httpx.ConnectError('offline')
    monkeypatch.setattr(api.httpx,'AsyncClient',lambda **kwargs:Client())
    api._cache.clear()
    with pytest.raises(HTTPException) as failure:
        asyncio.run(api.crossref('/works/test'))
    assert failure.value.status_code == 502
    assert not api._cache


def test_metadata_admission_has_a_separate_bounded_client_budget():
    api._requests.clear()
    request=Request({'type':'http','client':('127.0.0.1',1234)})
    for _ in range(30):
        asyncio.run(api.admit(request))
    with pytest.raises(HTTPException) as failure:
        asyncio.run(api.admit(request))
    assert failure.value.status_code == 429
    assert '127.0.0.1' not in api._requests
    asyncio.run(api.admit(Request({'type':'http','client':('127.0.0.2',1234)})))
    api._requests.clear()
