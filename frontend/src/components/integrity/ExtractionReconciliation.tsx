import {useState} from 'react';
import {z} from 'zod';
import type {Evidence} from '../../types/novelty';
import {useLocalRecords} from '../../lib/useLocalRecords';
import {EvidenceSelect,Field,Select,Notice,recordBase,text,stamp} from './Shared';

const extraction=z.object({reviewer:text,finding:text,population:text,method:text,limitations:text,passage:text,location:text});
const schema=z.object({...recordBase,sourceId:text,first:extraction,second:extraction.optional(),resolution:z.object({interpretation:text,reason:text,resolver:text,at:text}).optional()});
type Extraction=z.infer<typeof extraction>;
const blank=():Extraction=>({reviewer:'',finding:'',population:'',method:'',limitations:'',passage:'',location:''});
export function ExtractionReconciliation({evidence,id}:{evidence:Evidence[];id:string}) {
  const records=useLocalRecords('research-integrity-'+id+'-extractions',schema);
  const [sourceId,setSourceId]=useState(''),[pairId,setPairId]=useState(''),[draft,setDraft]=useState(blank),[error,setError]=useState('');
  const [resolution,setResolution]=useState({interpretation:'',reason:'',resolver:''}),[resolveId,setResolveId]=useState('');
  const awaiting=records.items.filter(x=>!x.second);
  function submit(){
    if(!draft.reviewer.trim()||!draft.finding.trim()||!draft.passage.trim()){setError('Enter reviewer name, finding, and source passage.');return;}
    if(pairId){const pair=records.items.find(x=>x.id===pairId);if(!pair||pair.second){setError('This extraction pair is unavailable.');return;}if(pair.first.reviewer.trim().toLowerCase()===draft.reviewer.trim().toLowerCase()){setError('The second extraction needs a different reviewer.');return;}if(records.save(records.items.map(x=>x.id===pairId?{...x,second:draft}:x))){setPairId('');setDraft(blank());setError('');}}
    else {if(!sourceId){setError('Select a source.');return;}if(records.save([...records.items,{...stamp(),sourceId,first:draft}])){setDraft(blank());setError('');}}
  }
  function reconcile(){if(!resolution.interpretation.trim()||!resolution.reason.trim()||!resolution.resolver.trim()){setError('Record the resolved interpretation, reason, and resolver.');return;}if(records.save(records.items.map(x=>x.id===resolveId?{...x,resolution:{...resolution,at:new Date().toISOString()}}:x))){setResolveId('');setResolution({interpretation:'',reason:'',resolver:''});setError('');}}
  return <>
    <p>Collect two interpretations before showing them side by side. Reviewer names are self-entered; this local workflow does not authenticate reviewers or enforce blind access.</p>
    <label>Extraction stage<select value={pairId} onChange={e=>{setPairId(e.target.value);setDraft(blank());}}><option value="">Start first extraction</option>{awaiting.map(x=><option key={x.id} value={x.id}>Second extraction: {evidence.find(e=>e.id===x.sourceId)?.title||x.sourceId} · {x.first.reviewer}</option>)}</select></label>
    {!pairId&&<EvidenceSelect evidence={evidence} value={sourceId} onChange={setSourceId}/>}
    <div className="tool-input-grid">{(Object.keys(draft) as (keyof Extraction)[]).map(key=><Field key={key} label={key==='passage'?'Supporting passage':key} area={['finding','limitations','passage'].includes(key)} value={draft[key]} onChange={value=>setDraft({...draft,[key]:value})}/>)}</div>
    <button className="quiet-button" onClick={submit}>Submit {pairId?'second':'first'} extraction</button><Notice message={error}/>
    {records.items.map(record=><article className="integrity-card" key={record.id}><h4>{evidence.find(x=>x.id===record.sourceId)?.title||record.sourceId}</h4>{!record.second?<p>First extraction recorded by {record.first.reviewer}; waiting for another reviewer. Interpretation is hidden in this view until both submit.</p>:<>
      <div className="integrity-table-wrap"><table><thead><tr><th>Field</th><th>{record.first.reviewer}</th><th>{record.second.reviewer}</th></tr></thead><tbody>{(['finding','population','method','limitations','passage','location'] as const).map(key=><tr key={key}><th>{key}{record.first[key].trim()!==record.second![key].trim()?' · differs':''}</th><td>{record.first[key]||'Not recorded'}</td><td>{record.second![key]||'Not recorded'}</td></tr>)}</tbody></table></div>
      <small>Difference markers compare text exactly; they do not establish a scientific disagreement.</small>
      {record.resolution?<div><p>Resolved by {record.resolution.resolver}: {record.resolution.interpretation}</p><p>Reason: {record.resolution.reason}</p><small>{new Date(record.resolution.at).toLocaleString()}</small></div>:<button className="quiet-button" onClick={()=>{setResolveId(record.id);setResolution({interpretation:'',reason:'',resolver:''});}}>Resolve interpretations</button>}
      {resolveId===record.id&&<div><Field label="Resolved interpretation" area value={resolution.interpretation} onChange={interpretation=>setResolution({...resolution,interpretation})}/><Field label="Resolution reason and evidence" area value={resolution.reason} onChange={reason=>setResolution({...resolution,reason})}/><Field label="Resolver name" value={resolution.resolver} onChange={resolver=>setResolution({...resolution,resolver})}/><button className="quiet-button" onClick={reconcile}>Save resolution</button></div>}
    </>}<button className="quiet-button" onClick={()=>records.save(records.items.filter(x=>x.id!==record.id))}>Remove pair</button></article>)}
    <button className="quiet-button" onClick={records.download}>Export extractions and resolutions</button><p role="status">{records.message}</p>
  </>;
}
