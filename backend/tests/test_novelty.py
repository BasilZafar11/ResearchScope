from app.analysis.novelty import cosine, score_report, dedupe, safe_url, provider_search, ProviderUnavailableError
from app.analysis import groq_enrichment
from app.main import sample_novelty_report, sample_revision_preview, RevisionInput
from app.analysis.research_guidance import build_guidance, contribution_brief
from app.main import NoveltyInput
from pydantic import ValidationError
from types import SimpleNamespace
from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone
from app.db.session import Session
from app.models.novelty import NoveltyReport, NoveltyWorkspace
from app.main import create_novelty_workspace, add_novelty_comment, set_novelty_watch, get_novelty_workspace, ReviewCommentInput, WatchInput
from app.main import extract_document_review
from pypdf import PdfWriter
from io import BytesIO
import asyncio
import hashlib
import pytest


def test_patent_no_results_response_is_an_empty_search():
    client = SimpleNamespace(search=lambda params: {
        'error': "Google Patents hasn't returned any results for this query.",
        'search_metadata': {'status': 'Success'},
    })
    result = provider_search(client, 'google_patents', q='bounded research query')
    assert result['organic_results'] == []
    assert result['search_metadata']['status'] == 'Success'
    assert 'error' not in result


def test_patent_provider_failure_still_reports_unavailability():
    client = SimpleNamespace(search=lambda params: {'error': 'Google Patents search failed.'})
    with pytest.raises(ProviderUnavailableError):
        provider_search(client, 'google_patents', q='bounded research query')


def test_sample_report_is_explicitly_synthetic_and_needs_no_provider():
    report = sample_novelty_report()
    assert report['sample_mode'] is True
    assert report['credential_mode'] == 'sample'
    assert 'fictional' in report['warnings'][0].lower()
    assert all('.invalid/' in e['source_url'] for e in report['papers'] + report['patents'])
    assert report['summary']['disclaimer']


def test_similarity_favors_related_text_and_stays_bounded():
    related = cosine('compact crop disease vision on mobile phones', 'mobile crop disease model for low power phones')
    unrelated = cosine('compact crop disease vision on mobile phones', 'ocean current temperature forecast')
    assert 0 <= unrelated <= related <= 1


def test_duplicate_papers_merge_and_tracking_query_keys_are_removed():
    records=[{'title':'Compact crop disease models on phones','external_id':'scholar-a','summary_text':'Abstract A','source_url':'https://example.org/paper?utm_source=demo'},
             {'title':'Compact crop disease models on phones','external_id':'scholar-b','summary_text':'Abstract B','source_url':'https://example.org/alternate'}]
    merged=dedupe(records,'scholar')
    assert len(merged)==1
    assert 'utm_source' not in safe_url(records[0]['source_url'])


def test_novelty_source_links_drop_provider_archives_and_credential_fragments():
    assert safe_url('https://serpapi.com/searches/archive.json?api_key=dummy') is None
    assert safe_url('https://example.org/paper?groq_api_key=dummy&section=2#token=dummy')=='https://example.org/paper?section=2'
    assert safe_url('java\nscript:alert(1)') is None


def test_novelty_input_bounds_and_explicit_public_save():
    base={'title':'A sufficiently descriptive research title','abstract':'A sufficiently long abstract describing the proposed technical system, its methods, and intended research contribution.','keywords':['first technical term','second technical term','third technical term']}
    assert NoveltyInput(**base).save_report is True
    with pytest.raises(ValidationError): NoveltyInput(**{**base,'claims':['short']})
    with pytest.raises(ValidationError): NoveltyInput(**{**base,'is_public':True,'save_report':False})


def test_groq_claim_structuring_preserves_user_claims(monkeypatch):
    monkeypatch.setattr(groq_enrichment,'_complete',lambda system,payload:{
        'normalized_claims':['Model suggestion that remains within the bounded schema.'],
        'scholar_query_terms':['compact mobile inference'],'patent_query_terms':['edge image classification'],
        'web_query_terms':['crop diagnosis software'],'warnings':[]})
    user_claim='The user provided claim stays exactly as written here.'
    result=groq_enrichment.structure({'title':'Research title','abstract':'A sufficiently long abstract for the structuring call.','field':'Agriculture','keywords':['crop disease'],'claims':[user_claim],'known_related_work':[]})
    assert result['claims']==[user_claim]
    assert result['scholar_terms']==['compact mobile inference']


def test_groq_explanation_rejects_unknown_evidence_ids(monkeypatch):
    monkeypatch.setattr(groq_enrichment,'_complete',lambda system,payload:{
        'executive_summary':'Retrieved evidence only.','claim_explanations':[{'claim_id':'claim-1','assessment':'matched','explanation':'Evidence text overlaps the claim.','evidence_ids':['invented-id'],'limitations':[]}],
        'areas_needing_deeper_search':[],'report_limitations':[]})
    data={'title':'Research idea'}
    report={'claims':[{'id':'claim-1','text':'A sufficiently detailed technical claim for comparison.'}],'papers':[{'id':'evidence-1','source_type':'scholar','title':'Paper','summary_text':'Bounded excerpt.','similarity_score':60,'source_url':'https://example.org/paper'}],'patents':[],'web_results':[],'overlap_score':40,'confidence_score':50}
    with pytest.raises(ValueError): groq_enrichment.explain(data,report)


def test_no_results_never_becomes_high_confidence():
    report = score_report({'title':'Research title','abstract':'A sufficiently long abstract describing technical systems and research methods.','field':'','keywords':['alpha term','beta term','gamma term'],'claims':['A technical claim with enough words to pass validation.']}, [], [], [], [], [])
    assert report['overlap_score'] == 0
    assert report['novelty_signal'] == 100
    assert report['confidence_label'] == 'Low'
    assert not report['summary']['strongest_overlaps']


def test_guidance_keeps_gaps_hypothetical_and_links_closest_sources():
    report=sample_novelty_report()
    guidance=build_guidance(report)
    assert guidance['closest_work'][0]['source_url'].startswith('https://example.invalid/')
    assert all(gap['status']=='unverified search hypothesis' for gap in guidance['gap_hypotheses'])
    assert guidance['coverage']['full_texts_inspected']==0
    assert contribution_brief(report)['closest_work']


def test_revision_preview_uses_original_evidence_and_discloses_search_limit():
    report=sample_novelty_report()
    revision=RevisionInput(title=report['input']['title'],abstract=report['input']['abstract'],claims=report['input']['claims'])
    preview=sample_revision_preview(revision)
    assert preview['baseline_overlap']==preview['preview_overlap']
    assert preview['delta']==0
    assert 'did not search' in preview['limitation']


def test_review_invite_controls_comments_and_watch_finds_newly_retrieved_records():
    ident=str(uuid4());baseline=sample_novelty_report();baseline['sample_mode']=False
    with Session.begin() as db:
        db.add(NoveltyReport(id=ident,fingerprint='a'*64,title=baseline['input']['title'],field='',
            input_data=baseline['input'],status='complete',stage='complete',progress=100,saved=True,is_public=False,
            report=baseline,created_at=datetime.now(timezone.utc)-timedelta(hours=2)))
        db.add(NoveltyWorkspace(report_id=ident,owner_token_hash=hashlib.sha256(b'owner').hexdigest(),review_token_hash=hashlib.sha256(b'reviewer-token-for-test-only-12345').hexdigest(),comments=[],watched=False))
    created={'owner_token':'owner','review_token':'reviewer-token-for-test-only-12345'}
    token=created['review_token']
    assert len(token)>30
    denied=add_novelty_comment(UUID(ident),ReviewCommentInput(author='Supervisor',kind='challenge',text='Please verify this source.'),SimpleNamespace(headers={}))
    assert denied.status_code==403
    request=SimpleNamespace(headers={'X-Review-Token':token})
    saved=add_novelty_comment(UUID(ident),ReviewCommentInput(author='Supervisor',claim_id='claim-1',kind='challenge',text='Please verify this source.'),request)
    assert saved['comments'][0]['kind']=='challenge'
    assert set_novelty_watch(UUID(ident),WatchInput(watched=True),request).status_code==403
    owner_request=SimpleNamespace(headers={'X-Review-Token':created['owner_token']})
    set_novelty_watch(UUID(ident),WatchInput(watched=True),owner_request)
    next_report=sample_novelty_report();next_report['papers'].append({**next_report['papers'][0],'id':'new-paper','title':'A newly retrieved paper','source_url':'https://example.invalid/new'})
    with Session.begin() as db:
        db.add(NoveltyReport(id=str(uuid4()),fingerprint='a'*64,title=baseline['input']['title'],field='',
            input_data=baseline['input'],status='complete',stage='complete',progress=100,saved=True,is_public=False,
            report=next_report,created_at=datetime.now(timezone.utc)))
    result=get_novelty_workspace(UUID(ident),request)
    assert result['comments'][0]['author']=='Supervisor'
    assert any(item['title']=='A newly retrieved paper' for item in result['alerts'])


def test_pdf_review_does_not_invent_passages_on_blank_page(monkeypatch):
    writer=PdfWriter();writer.add_blank_page(width=300,height=300)
    stream=BytesIO();writer.write(stream)
    async def body(): return stream.getvalue()
    request=SimpleNamespace(headers={'content-type':'application/pdf'},body=body)
    async def extracted(raw):return {'page_count':1,'passages':[]}
    monkeypatch.setattr('app.main.extract_pdf',extracted)
    result=asyncio.run(extract_document_review(request,[{'id':'claim-1','text':'A sufficiently long crop model claim.'}]))
    assert result['page_count']==1
    assert result['claims'][0]['passages']==[]
    assert 'not saved' in result['limitation']
