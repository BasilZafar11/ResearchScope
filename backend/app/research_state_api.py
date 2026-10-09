"""Capability-protected research records with optimistic concurrency."""
import hashlib
import hmac
import json
import re
from datetime import timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.db.session import Session
from app.models.database import now
from app.models.novelty import NoveltyReport, NoveltyWorkspace, ResearchState
from app.research_record_validation import validate_records
from app.config import SAVED_REPORT_RETENTION_DAYS

router=APIRouter(prefix='/api/novelty/analyses/{report_id}/research-state',tags=['Research workspace'])


class StatePatch(BaseModel):
    model_config=ConfigDict(extra='forbid')
    expected_version:int=Field(ge=0)
    records:dict=Field(default_factory=dict)
    delete:list[str]=Field(default_factory=list,max_length=100)

    @model_validator(mode='after')
    def bounded(self):
        if len(self.records)>100 or len(json.dumps(self.records,allow_nan=False))>1_500_000:
            raise ValueError('Workspace update exceeds the size limit.')
        for key in [*self.records,*self.delete]:
            if not isinstance(key,str) or not re.fullmatch(r'(defense|integrity|tools):[a-z0-9-]{1,80}',key):
                raise ValueError('Invalid workspace record namespace.')
        if set(self.records)&set(self.delete):
            raise ValueError('A record cannot be saved and deleted in the same update.')
        validate_records(self.records)
        return self


def authorized(db,report_id,token,for_update=False):
    report=db.get(NoveltyReport,str(report_id))
    workspace=db.scalar(select(NoveltyWorkspace).where(NoveltyWorkspace.report_id==str(report_id)).with_for_update()) if for_update else db.get(NoveltyWorkspace,str(report_id))
    created=report.created_at.replace(tzinfo=timezone.utc) if report and not report.created_at.tzinfo else report.created_at if report else None
    if not report or report.status!='complete' or not report.saved or not workspace or created+timedelta(days=SAVED_REPORT_RETENTION_DAYS)<=now():
        raise HTTPException(404,'The saved workspace is unavailable or expired.')
    if not token or len(token)>200:
        raise HTTPException(403,'Open an owner or reviewer link to access shared research records.')
    digest=hashlib.sha256(token.encode()).hexdigest()
    if hmac.compare_digest(digest,workspace.owner_token_hash):return report,'owner'
    if hmac.compare_digest(digest,workspace.review_token_hash):return report,'reviewer'
    raise HTTPException(403,'The workspace token is invalid.')


def view(row,report,role):
    created=report.created_at.replace(tzinfo=timezone.utc) if not report.created_at.tzinfo else report.created_at
    return {'version':row.version if row else 0,'records':row.records if row else {},
            'history':row.history if row else [],'role':role,
            'expires_at':(created+timedelta(days=SAVED_REPORT_RETENTION_DAYS)).isoformat(),
            'updated_at':row.updated_at.isoformat() if row else None}


@router.get('')
def get_state(report_id:UUID,x_review_token:str|None=Header(default=None)):
    with Session() as db:
        report,role=authorized(db,report_id,x_review_token)
        return view(db.get(ResearchState,str(report_id)),report,role)


@router.post('')
def save_state(report_id:UUID,data:StatePatch,x_review_token:str|None=Header(default=None)):
    try:
        with Session.begin() as db:
            report,role=authorized(db,report_id,x_review_token,for_update=True)
            if role!='owner' and (data.delete or any(key in {'defense:decision-history','defense:evidence-snapshots'} for key in data.records)):
                raise HTTPException(403,'Only the owner may delete records, publish decisions, or preserve evidence snapshots.')
            row=db.get(ResearchState,str(report_id))
            if (row.version if row else 0)!=data.expected_version:
                raise HTTPException(409,'Shared records changed. Reload and compare before saving again.')
            previous=dict(row.records if row else {})
            merged={**previous,**data.records}
            for key in data.delete:merged.pop(key,None)
            snapshot_key='defense:evidence-snapshots'
            if previous.get(snapshot_key) and snapshot_key in data.delete:
                raise HTTPException(422,'Preserved evidence snapshots cannot be deleted from shared storage.')
            if len(merged)>100 or len(json.dumps(merged,allow_nan=False))>1_500_000:
                raise HTTPException(422,'The complete workspace exceeds its storage limit. Export or remove records.')
            for key in ('defense:evidence-snapshots',):
                if key in data.records and not isinstance(data.records[key],list):
                    raise HTTPException(422,'Evidence snapshots must be a list of immutable records.')
                if key in data.records:
                    old={x['id']:x for x in previous.get(key,[]) if isinstance(x,dict) and 'id' in x}
                    identifiers=set()
                    for item in data.records[key] if isinstance(data.records[key],list) else []:
                        if not isinstance(item,dict) or not isinstance(item.get('id'),str) or not item['id'] or item['id'] in identifiers:
                            raise HTTPException(422,'Every evidence snapshot needs a stable identifier.')
                        identifiers.add(item['id'])
                        if item.get('id') in old and item!=old[item['id']]:
                            raise HTTPException(422,'Existing evidence snapshots are immutable. Save a new snapshot instead.')
                    if not set(old).issubset(identifiers):
                        raise HTTPException(422,'Preserved evidence snapshots must remain in shared storage.')
            changed=[key for key in set(previous)|set(merged) if previous.get(key)!=merged.get(key) or (key in previous)!=(key in merged)]
            history=list(row.history if row else [])
            history.append({'version':data.expected_version+1,'at':now().isoformat(),'role':role,'changed':sorted(changed),
                            'previous':{key:previous[key] for key in changed if key in previous}})
            history=history[-20:]
            while len(history)>1 and len(json.dumps(history))>3_000_000:history.pop(0)
            tick=now()
            if row:
                result=db.execute(update(ResearchState).where(ResearchState.report_id==str(report_id),ResearchState.version==data.expected_version)
                                  .values(records=merged,history=history,version=data.expected_version+1,updated_at=tick))
                if result.rowcount!=1:raise HTTPException(409,'Shared records changed. Reload before saving.')
                db.expire(row);db.refresh(row)
            else:
                row=ResearchState(report_id=str(report_id),records=merged,history=history,version=1,updated_at=tick)
                db.add(row);db.flush()
            return view(row,report,role)
    except IntegrityError:
        raise HTTPException(409,'Another editor created these records. Reload before saving.')
