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
    save_state(identifier,StatePatch(expected_version=0,records={'defense:tasks':[{'title':'first'}],'defense:evidence-snapshots':[{'id':'s1','title':'original'}]}),'owner')
    state=save_state(identifier,StatePatch(expected_version=1,records={'defense:tasks':[{'title':'second'}]}),'reviewer')
    assert state['history'][-1]['previous']['defense:tasks']==[{'title':'first'}]
    with pytest.raises(HTTPException):save_state(identifier,StatePatch(expected_version=2,records={'defense:evidence-snapshots':[{'id':'s1','title':'changed'}]}),'owner')


def test_expired_workspaces_and_unknown_namespaces_are_rejected():
    identifier=saved_report()
    with Session.begin() as db:db.get(NoveltyReport,str(identifier)).created_at=now()-timedelta(days=8)
    with pytest.raises(HTTPException) as failure:get_state(identifier,'owner')
    assert failure.value.status_code==404
    with pytest.raises(ValidationError):StatePatch(expected_version=0,records={'owner-token':'private'})
