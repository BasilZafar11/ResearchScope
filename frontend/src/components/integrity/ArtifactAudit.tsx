import {useResearchDraft} from '../../lib/researchDraft';
import {useState} from 'react';
import {z} from 'zod';
import type {Evidence} from '../../types/novelty';
import {useLocalRecords} from '../../lib/useLocalRecords';
import {safeHttp} from '../../lib/researchIntegrity';
import {EvidenceSelect,Field,Select,SourceLink,Notice,recordBase,text,stamp} from './Shared';

const schema=z.object({...recordBase,sourceId:text,kind:z.enum(['code','data','model weights','instructions']),url:text,version:text,license:text,status:z.enum(['unchecked','accessible','restricted','broken link','not found']),checkedAt:text,reason:text,execution:text});
type Artifact=z.infer<typeof schema>;
const blank=()=>({sourceId:'',kind:'code' as Artifact['kind'],url:'',version:'',license:'',status:'unchecked' as Artifact['status'],checkedAt:'',reason:'',execution:''});
export function ArtifactAudit({evidence,id}:{evidence:Evidence[];id:string}) {
  const records=useLocalRecords('research-integrity-'+id+'-artifacts',schema);
  const [draft,setDraft]=useResearchDraft(id,'integrity-ArtifactAudit-draft',blank),[error,setError]=useState('');
  function add(){if(!draft.sourceId){setError('Select a source.');return;}
    if(draft.url&&!safeHttp(draft.url)){setError('Use an http or https artifact link.');return;}
    if(draft.status!=='unchecked'&&(!draft.checkedAt||!draft.reason.trim()||(['accessible','restricted','broken link'].includes(draft.status)&&!draft.url))){setError('A checked status needs a date, evidence or search reason, and a URL when an artifact was located.');return;}
    if(records.save([...records.items,{...draft,...stamp()}])){setDraft(blank());setError('');}}
  const selected=evidence.find(x=>x.id===draft.sourceId);
  return <>
    <p>Record what is available for each method and whether you actually opened or executed it. Access and license permissions are separate checks.</p>
    <EvidenceSelect evidence={evidence} value={draft.sourceId} onChange={sourceId=>setDraft({...blank(),sourceId})}/>
    {selected&&<div className="tool-link-row"><SourceLink url={selected.source_url||''}>Open publication</SourceLink><a href={'https://github.com/search?type=repositories&q='+encodeURIComponent(selected.title)} target="_blank" rel="noreferrer">Search code repositories ↗</a></div>}
    <div className="tool-input-grid"><Select label="Artifact type" value={draft.kind} options={['code','data','model weights','instructions']} onChange={kind=>setDraft({...draft,kind:kind as Artifact['kind']})}/><Select label="Access status" value={draft.status} options={['unchecked','accessible','restricted','broken link','not found']} onChange={status=>setDraft({...draft,status:status as Artifact['status']})}/></div>
    <Field label="Artifact URL" type="url" value={draft.url} onChange={url=>setDraft({...draft,url})}/>
    <div className="tool-input-grid"><Field label="Version or commit" value={draft.version} onChange={version=>setDraft({...draft,version})}/><Field label="License and source of permission" value={draft.license} onChange={license=>setDraft({...draft,license})}/><Field label="Checked on" type="date" value={draft.checkedAt} onChange={checkedAt=>setDraft({...draft,checkedAt})}/></div>
    <Field label="Check evidence / search coverage / restriction" area value={draft.reason} onChange={reason=>setDraft({...draft,reason})}/>
    <Field label="Execution attempt and outcome" area value={draft.execution} onChange={execution=>setDraft({...draft,execution})}/>
    <button className="quiet-button" onClick={add}>Save artifact audit</button><Notice message={error}/>
    {evidence.map(source=>{const entries=records.items.filter(x=>x.sourceId===source.id);return entries.length?<article className="integrity-card" key={source.id}><h4>{source.title}</h4><p>Unchecked artifact categories: {['code','data','model weights','instructions'].filter(kind=>!entries.some(x=>x.kind===kind&&x.status!=='unchecked')).join(', ')||'none'}</p>{entries.map(x=><div className="integrity-subrecord" key={x.id}><strong>{x.kind} · {x.status}</strong><p><SourceLink url={x.url}>{x.version||'Version not recorded'}</SourceLink> · {x.checkedAt||'Unchecked date'}</p><p>License: {x.license||'Unknown permissions'}</p><p>{x.reason}</p><p>Execution: {x.execution||'Not attempted'}</p><button className="quiet-button" onClick={()=>records.save(records.items.filter(r=>r.id!==x.id))}>Remove</button></div>)}</article>:null;})}
    <button className="quiet-button" onClick={records.download}>Export artifact register</button><p role="status">{records.message}</p>
  </>;
}
