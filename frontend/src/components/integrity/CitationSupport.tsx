import {useResearchDraft} from '../../lib/researchDraft';
import {useState} from 'react';
import {z} from 'zod';
import type {Evidence} from '../../types/novelty';
import {useLocalRecords} from '../../lib/useLocalRecords';
import {citationDiagnostics} from '../../lib/researchIntegrity';
import {EvidenceSelect,Field,Select,Notice,SourceLink,recordBase,text,stamp} from './Shared';

const schema=z.object({...recordBase,statement:text,sourceId:text,passage:text,page:text,verdict:z.enum(['supported','partially supported','contradicted','unresolved']),reason:text,rewrite:text});
type Review=z.infer<typeof schema>;
const empty=()=>({statement:'',sourceId:'',passage:'',page:'',verdict:'unresolved' as Review['verdict'],reason:'',rewrite:''});
export function CitationSupport({evidence,id}:{evidence:Evidence[];id:string}) {
  const records=useLocalRecords('research-integrity-'+id+'-citations',schema);
  const [draft,setDraft]=useResearchDraft(id,'integrity-CitationSupport-draft',empty),[error,setError]=useState('');
  const diagnostic=citationDiagnostics(draft.statement,draft.passage);
  function add(){if(!draft.statement.trim()||!draft.sourceId||!draft.passage.trim()||!draft.reason.trim()){setError('Provide the sentence, source passage, and a reason for your verdict.');return;}if(records.save([...records.items,{...draft,...stamp()}])){setDraft(empty());setError('');}}
  return <>
    <p>Review whether a cited passage supports a specific sentence. Text diagnostics identify details to check; you assign the final verdict.</p>
    <Field label="Draft sentence" area value={draft.statement} onChange={statement=>setDraft({...draft,statement})}/>
    <EvidenceSelect evidence={evidence} value={draft.sourceId} onChange={sourceId=>setDraft({...draft,sourceId,passage:'',verdict:'unresolved',reason:''})}/>
    <Field label="Exact cited passage" area value={draft.passage} onChange={passage=>setDraft({...draft,passage})}/>
    <Field label="Page, section, or paragraph" value={draft.page} onChange={page=>setDraft({...draft,page})}/>
    {draft.statement&&draft.passage&&<div className="integrity-card"><strong>Details requiring review</strong><p>Numbers absent from the passage: {diagnostic.missingNumbers.join(', ')||'none detected'}.</p><p>Broad or causal wording: {diagnostic.broad.join(', ')||'none detected'}.</p><p>Statement terms absent from passage: {diagnostic.missing.join(', ')||'none detected'}.</p><small>Shared words do not establish entailment. Check the full study, population, uncertainty, and whether the author is quoting another source.</small></div>}
    <Select label="Reviewer verdict" value={draft.verdict} options={['unresolved','supported','partially supported','contradicted']} onChange={verdict=>setDraft({...draft,verdict:verdict as Review['verdict']})}/>
    <Field label="Verdict reason" area value={draft.reason} onChange={reason=>setDraft({...draft,reason})}/>
    <Field label="Proposed revision" area value={draft.rewrite} onChange={rewrite=>setDraft({...draft,rewrite})}/>
    <button className="quiet-button" onClick={add}>Save citation review</button><Notice message={error}/>
    {records.items.map(record=><article className="integrity-card" key={record.id}><h4>{record.verdict} · {record.statement}</h4><SourceLink url={evidence.find(x=>x.id===record.sourceId)?.source_url||''}>{evidence.find(x=>x.id===record.sourceId)?.title||record.sourceId}</SourceLink><blockquote>{record.passage}</blockquote><small>{record.page||'Location not recorded'}</small><p>{record.reason}</p>{record.rewrite&&<p>Proposed revision: {record.rewrite}</p>}<button className="quiet-button" onClick={()=>setDraft({statement:record.statement,sourceId:record.sourceId,passage:record.passage,page:record.page,verdict:record.verdict,reason:record.reason,rewrite:record.rewrite})}>Revise as new review</button><button className="quiet-button" onClick={()=>records.save(records.items.filter(x=>x.id!==record.id))}>Remove</button></article>)}
    <button className="quiet-button" onClick={records.download}>Export citation reviews</button><p role="status">{records.message}</p>
  </>;
}
