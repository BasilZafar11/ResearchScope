import hashlib, hmac, secrets, time
from collections import defaultdict, deque
from copy import deepcopy
from datetime import timedelta, timezone
from threading import Lock
from uuid import UUID
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, update, delete
from sqlalchemy.exc import IntegrityError
from app.db.session import Session
from app.models.database import Analysis, now, uid
from app.models.venture import VentureAccount, VentureSession, VentureTeam
router=APIRouter(prefix='/api/venture')
auth_hits=defaultdict(deque)
auth_lock=Lock()
auth_salt=secrets.token_bytes(32)
def digest(value):return hashlib.sha256(value.encode()).hexdigest()
def password_hash(password,salt=None):
    salt=salt or secrets.token_hex(16)
    return salt+':'+hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
def limited(request):
    key=hmac.new(auth_salt,(request.client.host if request.client else 'unknown').encode(),hashlib.sha256).hexdigest()
    with auth_lock:
        tick=time.monotonic()
        for stale in list(auth_hits):
            while auth_hits[stale] and tick-auth_hits[stale][0]>300:auth_hits[stale].popleft()
            if not auth_hits[stale]:del auth_hits[stale]
        if len(auth_hits[key])>=15:raise HTTPException(429,'Too many account attempts. Try again in five minutes.')
        auth_hits[key].append(tick)
def account(db,authorization):
    if not authorization or not authorization.startswith('Bearer '):raise HTTPException(401,'Sign in to open this workspace.')
    token=authorization[7:]
    if len(token)>200:raise HTTPException(401,'Invalid session.')
    session=db.get(VentureSession,digest(token))
    expiry=session.expires_at.replace(tzinfo=timezone.utc) if session and not session.expires_at.tzinfo else session.expires_at if session else None
    user=db.get(VentureAccount,session.account_id) if session and expiry>now() else None
    if not user:raise HTTPException(401,'Session expired or unavailable. Sign in again.')
    return user
def view(db,row,user):
    return {'id':row.id,'name':row.name,'report_id':row.report_id,'version':row.version,'role':row.members[user.id],
            'members':[{'id':key,'username':db.get(VentureAccount,key).username,'role':role} for key,role in row.members.items()],**row.payload}
def team(db,team_id,user):
    row=db.get(VentureTeam,str(team_id))
    if not row or user.id not in row.members:raise HTTPException(404,'Workspace unavailable.')
    return row
class Credentials(BaseModel):
    model_config=ConfigDict(extra='forbid')
    username:str=Field(min_length=3,max_length=40,pattern=r'^[a-zA-Z0-9_-]+$')
    password:str=Field(min_length=12,max_length=128)
def session_for(db,user):
    token=secrets.token_urlsafe(32)
    db.add(VentureSession(token_hash=digest(token),account_id=user.id,expires_at=now()+timedelta(days=7)))
    return {'token':token,'username':user.username}
@router.post('/accounts')
def register(data:Credentials,request:Request):
    limited(request)
    with Session.begin() as db:
        user=VentureAccount(username=data.username.lower(),password_hash=password_hash(data.password));db.add(user)
        try:db.flush()
        except IntegrityError:raise HTTPException(409,'Username unavailable.')
        return session_for(db,user)
@router.post('/sessions')
def login(data:Credentials,request:Request):
    limited(request)
    with Session.begin() as db:
        user=db.scalar(select(VentureAccount).where(VentureAccount.username==data.username.lower()))
        stored=user.password_hash if user else password_hash('dummy-password-for-timing')
        if not hmac.compare_digest(stored,password_hash(data.password,stored.split(':')[0])) or not user:raise HTTPException(401,'Username or password is incorrect.')
        db.execute(delete(VentureSession).where(VentureSession.expires_at<now()))
        return session_for(db,user)
@router.delete('/sessions/current')
def logout(authorization:str|None=Header(default=None)):
    with Session.begin() as db:
        account(db,authorization);db.execute(delete(VentureSession).where(VentureSession.token_hash==digest(authorization[7:])))
    return {'ok':True}
class TeamInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    report_id:UUID
    name:str=Field(min_length=3,max_length=100)
@router.post('/teams')
def create_team(data:TeamInput,authorization:str|None=Header(default=None)):
    with Session.begin() as db:
        user=account(db,authorization);report=db.get(Analysis,str(data.report_id))
        if not report or report.status!='complete':raise HTTPException(404,'A completed market report is required.')
        if len(db.scalars(select(VentureTeam).where(VentureTeam.owner_id==user.id)).all())>=20:raise HTTPException(422,'Workspace limit reached.')
        row=VentureTeam(report_id=str(data.report_id),name=data.name,owner_id=user.id,members={user.id:'owner'});db.add(row);db.flush();return view(db,row,user)
@router.get('/teams')
def teams(authorization:str|None=Header(default=None)):
    with Session() as db:
        user=account(db,authorization)
        return [{'id':r.id,'name':r.name,'report_id':r.report_id,'role':r.members[user.id]} for r in db.scalars(select(VentureTeam)).all() if user.id in r.members]
@router.get('/teams/{team_id}')
def get_team(team_id:UUID,authorization:str|None=Header(default=None)):
    with Session() as db:
        user=account(db,authorization);return view(db,team(db,team_id,user),user)
class Action(BaseModel):
    model_config=ConfigDict(extra='forbid')
    version:int=Field(ge=1)
    action:str=Field(pattern='^(member|remove_member|task|task_status|comment|decision|approve)$')
    text:str=Field(default='',max_length=1200)
    target:str=Field(default='',max_length=100)
    role:str=Field(default='viewer',pattern='^(viewer|editor)$')
    assignee:str=Field(default='',max_length=40)
    status:str=Field(default='Todo',pattern='^(Todo|Doing|Done)$')
@router.post('/teams/{team_id}/actions')
def action(team_id:UUID,data:Action,authorization:str|None=Header(default=None)):
    with Session.begin() as db:
        user=account(db,authorization);row=team(db,team_id,user);role=row.members[user.id]
        if data.version!=row.version:raise HTTPException(409,'Workspace changed. Reload before saving.')
        if data.action in ('member','remove_member','approve') and role!='owner':raise HTTPException(403,'Only the owner can manage members or approve decisions.')
        if data.action in ('task','task_status','decision') and role=='viewer':raise HTTPException(403,'Editor access is required.')
        members=deepcopy(row.members);payload=deepcopy(row.payload)
        if data.action in ('member','remove_member'):
            added=db.scalar(select(VentureAccount).where(VentureAccount.username==data.target.lower()))
            if not added:raise HTTPException(422,'Ask the collaborator to create an account first.')
            if added.id==row.owner_id:raise HTTPException(422,'The owner role cannot be changed.')
            if data.action=='member':
                if len(members)>=20 and added.id not in members:raise HTTPException(422,'Member limit reached.')
                members[added.id]=data.role
            else:members.pop(added.id,None)
        elif data.action in ('task','comment','decision'):
            if len(data.text.strip())<3:raise HTTPException(422,'Enter at least three characters.')
            group={'task':'tasks','comment':'comments','decision':'decisions'}[data.action]
            if len(payload[group])>=100:raise HTTPException(422,'Record limit reached.')
            if data.assignee and data.assignee not in members:raise HTTPException(422,'Choose a workspace member as assignee.')
            payload[group].append({'id':uid(),'text':data.text.strip(),'author':user.username,'created_at':now().isoformat(),'assignee':data.assignee,'status':'Todo','approved_by':None})
        else:
            group='tasks' if data.action=='task_status' else 'decisions'
            target=next((p for p in payload[group] if p['id']==data.target),None)
            if not target:raise HTTPException(422,'Record unavailable.')
            if data.action=='task_status':target['status']=data.status
            else:target['approved_by']=user.username;target['approved_at']=now().isoformat()
        changed=db.execute(update(VentureTeam).where(VentureTeam.id==row.id,VentureTeam.version==data.version).values(members=members,payload=payload,version=data.version+1))
        if changed.rowcount!=1:raise HTTPException(409,'Workspace changed. Reload before saving.')
        db.refresh(row);return view(db,row,user)
