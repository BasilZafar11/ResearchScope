import {parseStoredRecord,writeStoredRecord} from '../lib/projectRecords';
import {useResearchDraft} from '../lib/researchDraft';
import {useState} from 'react';
type Status='documented exposure'|'reported exclusion'|'conflicting disclosures'|'unknown';
type Disclosure={id:string;model:string;modelVersion:string;benchmark:string;benchmarkVersion:string;trainingCutoff:string;status:Status;sourceUrl:string;sourceTitle:string;quote:string;checkedAt:string;reviewNote:string};
type Draft=Omit<Disclosure,'id'|'checkedAt'>;
const emptyDraft=():Draft=>({model:'',modelVersion:'',benchmark:'',benchmarkVersion:'',trainingCutoff:'',status:'unknown',sourceUrl:'',sourceTitle:'',quote:'',reviewNote:''});
function read(key:string):Disclosure[]{try{const value=parseStoredRecord(key,'[]');return Array.isArray(value)?value:[]}catch{return []}}

export function BenchmarkContaminationTracker({reportId,idea}:{reportId:string;idea:string}){
 const key='novelty-defense-'+reportId+'-benchmark-disclosures';
 const [records,setRecords]=useState<Disclosure[]>(()=>read(key));
 const [draft,setDraft]=useResearchDraft<Draft>(reportId,'BenchmarkContaminationTracker-draft',emptyDraft());
 const [error,setError]=useState(''),[storageError,setStorageError]=useState(false);
 const update=(next:Disclosure[])=>{setRecords(next);try{writeStoredRecord(key,JSON.stringify(next));setStorageError(false)}catch{setStorageError(true)}};
 const add=()=>{
  if(!draft.model.trim()||!draft.benchmark.trim()){setError('Enter both a model and benchmark.');return}
  if(draft.status!=='unknown'&&(!draft.sourceUrl.trim()||!draft.sourceTitle.trim()||!draft.quote.trim())){setError('A non-unknown disclosure needs a source title, source URL, and quoted passage. Keep the status unknown when evidence is absent.');return}
  if(draft.sourceUrl.trim()){try{if(!['https:','http:'].includes(new URL(draft.sourceUrl).protocol))throw new Error()}catch{setError('Use a valid http or https source link.');return}}
  const entry:Disclosure={...draft,id:crypto.randomUUID(),checkedAt:new Date().toISOString(),model:draft.model.trim(),benchmark:draft.benchmark.trim()};
  update([entry,...records].slice(0,100));setDraft(emptyDraft());setError('');
 };
 const remove=(id:string)=>update(records.filter(record=>record.id!==id));
 const search='https://scholar.google.com/scholar?q='+encodeURIComponent('"'+idea+'" benchmark training data exposure');
 return <>
  <p>Track disclosures for a specific model version and benchmark version. Record what a source explicitly says; missing disclosure stays unknown.</p>
  <div className="tool-input-grid"><label>Model<input value={draft.model} onChange={event=>setDraft({...draft,model:event.target.value})} placeholder="Model name"/></label><label>Model version<input value={draft.modelVersion} onChange={event=>setDraft({...draft,modelVersion:event.target.value})}/></label><label>Benchmark<input value={draft.benchmark} onChange={event=>setDraft({...draft,benchmark:event.target.value})} placeholder="Benchmark or test set"/></label><label>Benchmark version<input value={draft.benchmarkVersion} onChange={event=>setDraft({...draft,benchmarkVersion:event.target.value})}/></label><label>Training cutoff, if reported<input type="date" value={draft.trainingCutoff} onChange={event=>setDraft({...draft,trainingCutoff:event.target.value})}/></label><label>Disclosure status<select value={draft.status} onChange={event=>setDraft({...draft,status:event.target.value as Status})}><option>unknown</option><option>documented exposure</option><option>reported exclusion</option><option>conflicting disclosures</option></select></label></div>
  <div className="tool-input-grid"><label>Source title<input value={draft.sourceTitle} onChange={event=>setDraft({...draft,sourceTitle:event.target.value})}/></label><label>Source URL<input type="url" value={draft.sourceUrl} onChange={event=>setDraft({...draft,sourceUrl:event.target.value})}/></label></div>
  <label>Relevant disclosure passage<textarea rows={3} value={draft.quote} onChange={event=>setDraft({...draft,quote:event.target.value})} maxLength={4000} placeholder="Paste the source wording that supports this status"/></label>
  <label>Reviewer note<input value={draft.reviewNote} onChange={event=>setDraft({...draft,reviewNote:event.target.value})} maxLength={800} placeholder="Version, interpretation, or limitation"/></label>
  <div className="tool-link-row"><a href={search} target="_blank" rel="noreferrer">Search for benchmark exposure disclosures ↗</a><a href={'https://huggingface.co/search/full-text?q='+encodeURIComponent(idea)} target="_blank" rel="noreferrer">Search model documentation ↗</a></div>
  <button type="button" className="quiet-button" onClick={add}>Save disclosure record</button>{error&&<p className="warning-line" role="alert">{error}</p>}
  <div className="contamination-records">{records.map(record=><article key={record.id}><header><b>{record.model} {record.modelVersion&&'· '+record.modelVersion} / {record.benchmark} {record.benchmarkVersion&&'· '+record.benchmarkVersion}</b><span>{record.status}</span></header><p>Training cutoff: {record.trainingCutoff||'not disclosed'} · Checked: {new Date(record.checkedAt).toLocaleDateString()}</p>{record.quote&&<blockquote>{record.quote}</blockquote>}<small>{record.sourceTitle||'Source title not recorded'}{record.sourceUrl&&<> · <a href={record.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a></>}</small>{record.reviewNote&&<p>{record.reviewNote}</p>}<button type="button" className="quiet-button" onClick={()=>remove(record.id)}>Remove record</button></article>)}</div>
  {storageError&&<p className="warning-line" role="alert">The disclosure could not be saved in this browser.</p>}
  <small>Disclosures can be incomplete or conflicting. This tracker does not independently inspect training data; retain conflicting sources and mark absent evidence unknown.</small>
 </>;
}
