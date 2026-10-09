import hashlib
from uuid import uuid4
from datetime import timedelta
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from app.db.session import Session
from app.models.database import now
from app.models.novelty import NoveltyReport,NoveltyWorkspace
from app.research_state_api import StatePatch,get_state,save_state
from app.research_record_validation import SCHEMA
import json
from pathlib import Path


def snapshot(identifier='s1',title='original'):
    return {'id':identifier,'title':title,'createdAt':'2026-10-09','cutoff':'2026-10-01','reportTitle':'Study','reportId':'one','methodologyVersion':'1','overlapScore':0,'queries':[],'included':[],'uncertain':[],'undated':[]}


@pytest.mark.parametrize('records',[
    {'tools:queue':{}},{'tools:queue':[3]},{'tools:quality':{'paper':'yes'}},
    {'tools:journal':[{'id':'one','text':[],'created_at':'today'}]},
    {'tools:screening':{'paper':{'state':[]}}},
    {'defense:tasks':[{'dependsOn':{'bad':True}}]},
    {'defense:measurements':{'claim':[{'outcome':42}]}},
    {'defense:evidence-snapshots':[{}]},
    {'defense:venue-criteria':{'criteria':[{}]}},
    {'integrity:retrieval':[{'items':'wrong'}]},
    {'tools:unknown':[]},
])
def test_malformed_records_are_rejected_before_shared_state_changes(records):
    identifier=saved_report()
    save_state(identifier,StatePatch(expected_version=0,records={'tools:queue':['original']}),'owner')
    with pytest.raises(ValidationError):StatePatch(expected_version=1,records=records)
    assert get_state(identifier,'owner')['records']=={'tools:queue':['original']}
    assert get_state(identifier,'owner')['version']==1


def test_legacy_records_remain_supported_and_browser_schema_matches():
    StatePatch(expected_version=0,records={'defense:tasks':[{'id':'old','data':{'title':'Review','dependsOn':[]}}],'defense:measurements':{'claim':{'outcome':'Accuracy'}},'defense:rounds':[{'title':'Search','data':{'new_records':3}}]})
    browser=Path(__file__).resolve().parents[2]/'frontend/src/lib/researchRecordSchema.json'
    assert json.loads(browser.read_text())==SCHEMA


def test_access_metadata_and_form_options_are_validated():
    StatePatch(expected_version=0,records={'integrity:access-paper':{'doi':'10.1234/study','work':{'title':'Study'},'candidates':[],'failures':[],'checked_at':'today','coverage':'Metadata only'}})
    with pytest.raises(ValidationError):StatePatch(expected_version=0,records={'integrity:power':{'mode':'invalid','effect':1,'sd':1,'alpha':0.05,'power':0.8,'attrition':0,'margin':1,'proportion':0.5,'rationale':''}})


@pytest.mark.parametrize('url',['javascript:alert(1)','java\tscript:alert(1)','https://example.org/\nsource','/papers/one','//example.org/paper','https://user:secret@example.org/paper','https://@example.org/paper','https:///example.org/paper','https://example.org:99999/paper','https:\\example.org/paper'])
def test_shared_records_reject_unsafe_source_urls(url):
    records={'integrity:access-paper':{'doi':'10.1234/study','work':{'title':'Study','url':url},'candidates':[],'failures':[],'checked_at':'today','coverage':'Metadata only'}}
    with pytest.raises(ValidationError,match='source URLs'):
        StatePatch(expected_version=0,records=records)


@pytest.mark.parametrize('url',['https://example.org/papers/one?year=2026#methods','http://example.org/paper',''])
def test_shared_records_accept_absolute_http_and_empty_optional_urls(url):
    records={'integrity:access-paper':{'doi':'10.1234/study','work':{'title':'Study','url':url},'candidates':[],'failures':[],'checked_at':'today','coverage':'Metadata only'}}
    StatePatch(expected_version=0,records=records)


def saved_report():
    identifier=uuid4()
    with Session.begin() as db:
        db.add(NoveltyReport(id=str(identifier),fingerprint='test',title='A research project',field='',input_data={},status='complete',saved=True,is_public=False,report={},created_at=now()))
        db.add(NoveltyWorkspace(report_id=str(identifier),owner_token_hash=hashlib.sha256(b'owner').hexdigest(),review_token_hash=hashlib.sha256(b'reviewer').hexdigest(),comments=[]))
    return identifier


def test_workspace_requires_capability_and_detects_stale_edits():
    identifier=saved_report()
    with pytest.raises(HTTPException) as failure:get_state(identifier,None)
    assert failure.value.status_code==403
    state=save_state(identifier,StatePatch(expected_version=0,records={'defense:tasks':[]}), 'owner')
    assert state['version']==1 and state['role']=='owner'
    with pytest.raises(HTTPException) as failure:save_state(identifier,StatePatch(expected_version=0,records={'defense:tasks':[{'title':'overwrite'}]}),'reviewer')
    assert failure.value.status_code==409
    assert get_state(identifier,'reviewer')['records']['defense:tasks']==[]


def test_reviewer_cannot_delete_or_publish_decisions_and_snapshots():
    identifier=saved_report()
    for patch in [StatePatch(expected_version=0,delete=['defense:tasks']),StatePatch(expected_version=0,records={'defense:decision-history':[]}),StatePatch(expected_version=0,records={'defense:evidence-snapshots':[]})]:
        with pytest.raises(HTTPException) as failure:save_state(identifier,patch,'reviewer')
        assert failure.value.status_code==403


def test_revision_history_preserves_previous_values_and_snapshots_are_immutable():
    identifier=saved_report()
    save_state(identifier,StatePatch(expected_version=0,records={'defense:tasks':[{'title':'first'}],'defense:evidence-snapshots':[snapshot()]}),'owner')
    state=save_state(identifier,StatePatch(expected_version=1,records={'defense:tasks':[{'title':'second'}]}),'reviewer')
    assert state['history'][-1]['previous']['defense:tasks']==[{'title':'first'}]
    with pytest.raises(HTTPException):save_state(identifier,StatePatch(expected_version=2,records={'defense:evidence-snapshots':[snapshot(title='changed')]}),'owner')


def test_expired_workspaces_and_unknown_namespaces_are_rejected():
    identifier=saved_report()
    with Session.begin() as db:db.get(NoveltyReport,str(identifier)).created_at=now()-timedelta(days=13)
    with pytest.raises(HTTPException) as failure:get_state(identifier,'owner')
    assert failure.value.status_code==404
    with pytest.raises(ValidationError):StatePatch(expected_version=0,records={'owner-token':'private'})


def test_first_snapshot_requires_unique_stable_identifiers():
    identifier=saved_report()
    with pytest.raises(ValidationError):StatePatch(expected_version=0,records={'defense:evidence-snapshots':[{'title':'missing id'}]})
    with pytest.raises(HTTPException) as failure:
        save_state(identifier,StatePatch(expected_version=0,records={'defense:evidence-snapshots':[snapshot('same'),snapshot('same')]}),'owner')
    assert failure.value.status_code==422
    assert get_state(identifier,'owner')['version']==0
