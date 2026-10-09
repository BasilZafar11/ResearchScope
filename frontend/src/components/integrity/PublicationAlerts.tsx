import {parseStoredRecord} from '../../lib/projectRecords';
import {useResearchDraft} from '../../lib/researchDraft';
import {useState} from 'react';
import {z} from 'zod';
import type {NoveltyReport} from '../../types/novelty';
import {integrityApi} from '../../api/integrity';
import {doiFrom} from '../../lib/researchIntegrity';
import {EvidenceSelect, Field, Notice, SaveBar, SourceLink, useDraft} from './Shared';

const noticeSchema=z.object({doi:z.string(),title:z.string(),url:z.string(),date:z.string(),kind:z.string(),provenance:z.string()});
const checkSchema=z.object({doi:z.string(),checkedAt:z.string(),notices:z.array(noticeSchema),changed:z.boolean(),acknowledged:z.boolean(),coverage:z.string(),truncated:z.boolean()});
const schema=z.record(z.string(),checkSchema);
function affectedLocalRecords(id:string,sourceId:string) {
  const read=(suffix:string):unknown=>{try{return parseStoredRecord(suffix,'[]');}catch{return [];}};
  const tasks=read('novelty-defense-'+id+'-tasks');
  const citations=read('research-integrity-'+id+'-citations');
  const decisions=read('novelty-defense-'+id+'-decision-history');
  const linkedTasks=Array.isArray(tasks)?tasks.filter(x=>Array.isArray(x?.evidenceIds)&&x.evidenceIds.includes(sourceId)).map(x=>String(x.title)):[];
  const linkedCitations=Array.isArray(citations)?citations.filter(x=>x?.sourceId===sourceId).map(x=>String(x.statement)):[];
  const linkedDecisions=Array.isArray(decisions)?decisions.filter(x=>typeof x?.snapshot==='string'&&x.snapshot.includes(JSON.stringify(sourceId))).map(x=>String(x.choice)+' ('+String(x.createdAt).slice(0,10)+')'):[];
  return {linkedTasks,linkedCitations,linkedDecisions};
}

export function PublicationAlerts({report,id}:{report:NoveltyReport;id:string}) {
  const saved=useDraft('research-integrity-'+id+'-updates',schema,{});
  const [sourceId,setSourceId]=useResearchDraft(id,'integrity-PublicationAlerts-sourceId',report.papers[0]?.id||''),[doi,setDoi]=useResearchDraft(id,'integrity-PublicationAlerts-doi',''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [,refresh]=useState(0);
  const source=report.papers.find(x=>x.id===sourceId);
  const inferred=source?doiFrom(String(source.details?.doi||source.details?.DOI||source.source_url||'')):'';
  async function check(){
    if(!source){setError('Select a paper first.');return;}
    const identifier=doi.trim()||inferred;
    if(!identifier){setError('Enter the DOI from the publisher record. A title match cannot establish publication status.');return;}
    setBusy(true);setError('');
    try {
      const response=await integrityApi.updates(identifier);
      const previous=saved.value[source.id];
      const changed=response.notices.length>0 && (!previous || JSON.stringify(previous.notices)!==JSON.stringify(response.notices));
      saved.save({...saved.value,[source.id]:{doi:response.work.doi,checkedAt:response.checked_at,notices:response.notices,changed,acknowledged:changed?false:previous?.acknowledged||false,coverage:response.coverage,truncated:response.truncated}});
    }catch(e){setError(e instanceof Error?e.message:'Publication check failed.');}finally{setBusy(false);}
  }
  return <>
    <p>Check a paper’s DOI for registered corrections, retractions, and expressions of concern. New notices become in-app alerts when you run a check.</p>
    <EvidenceSelect evidence={report.papers} value={sourceId} onChange={value=>{setSourceId(value);setDoi('');}}/>
    <Field label="Paper DOI" value={doi||inferred} onChange={setDoi} hint="Only this identifier is sent to Crossref when you choose Check."/>
    <button className="quiet-button" disabled={busy||!source} onClick={check}>{busy?'Checking publication…':'Check publication updates'}</button><Notice message={error}/>
    <button className="quiet-button" onClick={()=>refresh(value=>value+1)}>Refresh affected work</button>
    {report.papers.map(paper=>{const result=saved.value[paper.id];if(!result)return null;
      const claims=report.claims.filter(claim=>claim.matches.some(match=>match.evidence_id===paper.id));
      const impact=affectedLocalRecords(id,paper.id);
      return <article className="integrity-card" key={paper.id}>
        <h4>{paper.title}</h4><p>DOI: {result.doi} · Checked {new Date(result.checkedAt).toLocaleString()}</p>
        {result.changed&&!result.acknowledged&&<p role="status" className="warning-line">Publication update requires review.</p>}
        {result.notices.length?result.notices.map((notice,index)=><p key={notice.doi+index}><strong>{notice.kind}</strong> · <SourceLink url={notice.url}>{notice.title}</SourceLink> · {notice.date||'Date not supplied'} · {notice.provenance}</p>):<p>No notice returned. Publication status remains subject to provider coverage.</p>}
        <p>Affected report claims: {claims.map(x=>x.text).join('; ')||'No mapped claim in this report'}.</p>
        <p>Linked citation reviews: {impact.linkedCitations.join('; ')||'None recorded'}.</p>
        <p>Linked tasks: {impact.linkedTasks.join('; ')||'None recorded'}.</p>
        <p>Saved decisions referencing this source: {impact.linkedDecisions.join('; ')||'No explicit reference found'}.</p>
        {result.notices.length>0&&<p>Review any experiment, citation review, or saved decision that relies on this paper before continuing.</p>}
        <small>{result.coverage}{result.truncated?' Only the first 100 registered updates were checked.':''}</small>
        {result.notices.length>0&&<button className="quiet-button" onClick={()=>saved.save({...saved.value,[paper.id]:{...result,acknowledged:!result.acknowledged}})}>{result.acknowledged?'Reopen alert':'Acknowledge review alert'}</button>}
      </article>;
    })}
    <SaveBar error={saved.error} onExport={saved.export}/>
    <small>Checks run on request. Email alerts and scheduled monitoring are not configured.</small>
  </>;
}
