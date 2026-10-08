import {useResearchDraft} from '../../lib/researchDraft';
import {useState} from 'react';
import {z} from 'zod';
import type {NoveltyReport} from '../../types/novelty';
import {useLocalRecords} from '../../lib/useLocalRecords';
import {EvidenceSelect,Field,Select,Notice,SourceLink,recordBase,text,stamp} from './Shared';

const schema=z.object({...recordBase,claimId:text,sourceId:text,direction:z.enum(['supports','contradicts','mixed','unclear']),passage:text,population:text,method:text,setting:text,quality:text,limitations:text,page:text});
type Finding=z.infer<typeof schema>;
const blank=()=>({claimId:'',sourceId:'',direction:'unclear' as Finding['direction'],passage:'',population:'',method:'',setting:'',quality:'',limitations:'',page:''});
export function ContradictoryEvidence({report,id}:{report:NoveltyReport;id:string}) {
  const records=useLocalRecords('research-integrity-'+id+'-contradictions',schema);
  const [draft,setDraft]=useResearchDraft(id,'integrity-ContradictoryEvidence-draft',blank),[filter,setFilter]=useState(''),[error,setError]=useState('');
  const evidence=[...report.papers,...report.patents,...report.web_results];
  function add(){if(!draft.claimId||!draft.sourceId||!draft.passage.trim()){setError('Choose a claim and source and paste a supporting passage.');return;}
    if(records.save([...records.items,{...draft,...stamp()}])){setDraft(blank());setError('');}}
  const visible=records.items.filter(x=>!filter||x.claimId===filter);
  return <>
    <p>Compare opposing findings for the same claim. Direction and study quality are researcher judgments backed by passages.</p>
    <label>Claim<select value={draft.claimId} onChange={e=>setDraft({...draft,claimId:e.target.value})}><option value="">Choose claim</option>{report.claims.map(x=><option key={x.id} value={x.id}>{x.text}</option>)}</select></label>
    <EvidenceSelect evidence={evidence} value={draft.sourceId} onChange={sourceId=>setDraft({...draft,sourceId})}/>
    <Select label="Finding direction" value={draft.direction} options={['supports','contradicts','mixed','unclear']} onChange={direction=>setDraft({...draft,direction:direction as Finding['direction']})}/>
    <Field label="Source passage" area value={draft.passage} onChange={passage=>setDraft({...draft,passage})}/>
    <div className="tool-input-grid">{(['page','population','method','setting','quality','limitations'] as const).map(key=><Field key={key} label={key==='quality'?'Study quality and reason':key} value={draft[key]} onChange={value=>setDraft({...draft,[key]:value})}/>)}</div>
    <button className="quiet-button" onClick={add}>Add finding</button><Notice message={error}/>
    <label>Filter claim<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All claims</option>{report.claims.map(x=><option key={x.id} value={x.id}>{x.text}</option>)}</select></label>
    {report.claims.filter(claim=>!filter||claim.id===filter).map(claim=>{
      const findings=visible.filter(x=>x.claimId===claim.id);
      return findings.length?<section key={claim.id}><h4>{claim.text}</h4>
        {findings.some(x=>x.direction==='supports')&&findings.some(x=>x.direction==='contradicts')&&<p className="warning-line">Opposing findings recorded. Compare populations, methods, and settings before choosing an interpretation.</p>}
        <div className="integrity-table-wrap"><table><thead><tr><th>Source / finding</th><th>Population / method / setting</th><th>Quality / limitations</th></tr></thead><tbody>{findings.map(x=>{const source=evidence.find(e=>e.id===x.sourceId);return <tr key={x.id}><td><strong>{x.direction}</strong><p><SourceLink url={source?.source_url||''}>{source?.title||x.sourceId}</SourceLink></p><blockquote>{x.passage}</blockquote><small>Page: {x.page||'not recorded'}</small><button className="quiet-button" onClick={()=>records.save(records.items.filter(r=>r.id!==x.id))}>Remove</button></td><td>{x.population||'Unknown population'}<p>{x.method||'Unknown method'}</p>{x.setting||'Unknown setting'}</td><td>{x.quality||'Not assessed'}<p>{x.limitations||'No limitations recorded'}</p></td></tr>;})}</tbody></table></div>
      </section>:null;
    })}
    <button className="quiet-button" onClick={records.download}>Export finding register</button><p role="status">{records.message}</p>
  </>;
}
