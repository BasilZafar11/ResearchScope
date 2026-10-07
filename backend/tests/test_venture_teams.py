import pytest
from sqlalchemy import select
from app.venture_api import auth_hits
from app.models.venture import VentureAccount, VentureSession
from app.db.session import Session
from test_api import report
@pytest.fixture(autouse=True)
def clean_auth():auth_hits.clear()
def signup(client,name):
    response=client.post('/api/venture/accounts',json={'username':name,'password':'test-only-long-password'})
    assert response.status_code==200,response.text
    return {'Authorization':'Bearer '+response.json()['token']}
def test_account_password_session_and_logout(client):
    auth=signup(client,'owner')
    with Session() as db:
        user=db.scalar(select(VentureAccount));session=db.scalar(select(VentureSession))
        assert 'test-only-long-password' not in user.password_hash
        assert auth['Authorization'][7:]!=session.token_hash
    assert client.post('/api/venture/sessions',json={'username':'owner','password':'wrong-long-password'}).status_code==401
    login=client.post('/api/venture/sessions',json={'username':'OWNER','password':'test-only-long-password'})
    assert login.status_code==200
    assert client.get('/api/venture/teams').status_code==401
    assert client.delete('/api/venture/sessions/current',headers=auth).status_code==200
    assert client.get('/api/venture/teams',headers=auth).status_code==401
def test_team_membership_permissions_and_concurrent_changes(client):
    parent=report(client);owner=signup(client,'owner');editor=signup(client,'editor');viewer=signup(client,'viewer');outsider=signup(client,'outsider')
    created=client.post('/api/venture/teams',headers=owner,json={'report_id':parent['id'],'name':'Launch team'})
    assert created.status_code==200,created.text
    row=created.json();url='/api/venture/teams/'+row['id']
    assert client.get(url,headers=outsider).status_code==404
    assert client.get('/api/venture/teams',headers=outsider).json()==[]
    def action(headers,verb,**fields):
        return client.post(url+'/actions',headers=headers,json={'version':row['version'],'action':verb,**fields})
    for name,role in [('editor','editor'),('viewer','viewer')]:
        response=action(owner,'member',target=name,role=role);assert response.status_code==200,response.text;row=response.json()
    assert action(viewer,'task',text='Private task').status_code==403
    assert action(editor,'member',target='outsider').status_code==403
    response=action(viewer,'comment',text='Review the source evidence');assert response.status_code==200;row=response.json()
    response=action(editor,'task',text='Interview customers',assignee=row['members'][1]['id']);assert response.status_code==200;row=response.json()
    response=action(editor,'task_status',target=row['tasks'][0]['id'],status='Done');assert response.status_code==200;row=response.json()
    response=action(editor,'decision',text='Run an interview pilot');assert response.status_code==200;row=response.json()
    assert action(editor,'approve',target=row['decisions'][0]['id']).status_code==403
    response=action(owner,'approve',target=row['decisions'][0]['id']);assert response.status_code==200;row=response.json()
    assert row['decisions'][0]['approved_by']=='owner'
    assert client.post(url+'/actions',headers=owner,json={'version':1,'action':'comment','text':'Stale edit'}).status_code==409
    response=action(owner,'remove_member',target='viewer');assert response.status_code==200;row=response.json()
    assert client.get(url,headers=viewer).status_code==404
    assert 'password' not in client.get(url,headers=owner).text
def test_input_limits_and_missing_member(client):
    auth=signup(client,'owner');parent=report(client)
    assert client.post('/api/venture/accounts',json={'username':'owner','password':'test-only-long-password'}).status_code==409
    assert client.post('/api/venture/accounts',json={'username':'x','password':'short'}).status_code==422
    row=client.post('/api/venture/teams',headers=auth,json={'report_id':parent['id'],'name':'Team name'}).json()
    response=client.post('/api/venture/teams/'+row['id']+'/actions',headers=auth,json={'version':row['version'],'action':'member','target':'not_registered'})
    assert response.status_code==422
