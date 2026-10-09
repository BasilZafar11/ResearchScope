import hashlib
from copy import deepcopy
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.db.session import Session
from app.models.novelty import NoveltyReport, NoveltyWorkspace
from app.research_state_api import StatePatch, get_state, save_state


def snapshot(identifier='original'):
    return {
        'id': identifier, 'title': 'Preserved evidence', 'createdAt': '2026-10-09',
        'cutoff': '2026-10-01', 'reportTitle': 'Study', 'reportId': 'one',
        'methodologyVersion': '1', 'overlapScore': 0, 'queries': [],
        'included': [], 'uncertain': [], 'undated': [],
    }


@pytest.fixture
def preserved_workspace():
    identifier = uuid4()
    with Session.begin() as db:
        db.add(NoveltyReport(
            id=str(identifier), fingerprint='snapshot-security', title='Study',
            field='', input_data={}, status='complete', saved=True,
            is_public=False, report={},
        ))
        db.add(NoveltyWorkspace(
            report_id=str(identifier),
            owner_token_hash=hashlib.sha256(b'owner').hexdigest(),
            review_token_hash=hashlib.sha256(b'reviewer').hexdigest(), comments=[],
        ))
    save_state(identifier, StatePatch(expected_version=0, records={
        'defense:evidence-snapshots': [snapshot()],
    }), 'owner')
    return identifier


@pytest.mark.parametrize('patch', [
    {'records': {'defense:evidence-snapshots': []}},
    {'records': {'defense:evidence-snapshots': [snapshot('replacement')]}},
    {'delete': ['defense:evidence-snapshots']},
])
def test_owner_cannot_remove_preserved_snapshots(preserved_workspace, patch):
    identifier = preserved_workspace
    before = deepcopy(get_state(identifier, 'owner'))
    with pytest.raises(HTTPException) as failure:
        save_state(identifier, StatePatch(expected_version=1, **patch), 'owner')
    assert failure.value.status_code == 422
    assert get_state(identifier, 'owner') == before


def test_owner_can_append_snapshot_and_save_unrelated_records(preserved_workspace):
    identifier = preserved_workspace
    state = save_state(identifier, StatePatch(expected_version=1, records={
        'defense:evidence-snapshots': [snapshot('second'), snapshot()],
    }), 'owner')
    assert state['version'] == 2
    state = save_state(identifier, StatePatch(expected_version=2, records={
        'tools:queue': [],
    }), 'owner')
    assert state['records']['defense:evidence-snapshots'] == [snapshot('second'), snapshot()]


def test_same_snapshot_id_cannot_be_replaced(preserved_workspace):
    changed = snapshot()
    changed['title'] = 'Changed after preservation'
    with pytest.raises(HTTPException) as failure:
        save_state(preserved_workspace, StatePatch(expected_version=1, records={
            'defense:evidence-snapshots': [changed],
        }), 'owner')
    assert failure.value.status_code == 422
    assert get_state(preserved_workspace, 'owner')['version'] == 1
