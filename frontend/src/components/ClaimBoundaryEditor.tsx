import {parseStoredRecord,writeStoredRecord} from '../lib/projectRecords';
import {useMemo,useState} from 'react';
import type {Evidence} from '../types/novelty';

type Boundaries={method:string;population:string;setting:string;condition:string};
type Revision={id:string;created:string;original:string;revised:string;boundaries:Boundaries};
type Saved={original:string;boundaries:Boundaries;history:Revision[]};
const fields:(keyof Boundaries)[]=['method','population','setting','condition'];
const tokens=(text:string)=>new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(word=>word.length>2));
const score=(left:string,right:string)=>{const a=tokens(left),b=tokens(right);if(!a.size||!b.size)return 0;return Math.round(100*[...a].filter(word=>b.has(word)).length/new Set([...a,...b]).size)};
const initialBoundaries=():Boundaries=>({method:'',population:'',setting:'',condition:''});
function read(key:string,initial:string):Saved{try{const value=parseStoredRecord(key,'null');if(!value)return {original:initial,boundaries:initialBoundaries(),history:[]};return {original:typeof value.original==='string'?value.original:initial,boundaries:{...initialBoundaries(),...value.boundaries},history:Array.isArray(value.history)?value.history:[]}}catch{return {original:initial,boundaries:initialBoundaries(),history:[]}}}

export function ClaimBoundaryEditor({reportId,initialClaim,evidence}:{reportId:string;initialClaim:string;evidence:Evidence[]}){
 const key='novelty-defense-'+reportId+'-claim-boundaries';
 const [saved,setSaved]=useState(()=>read(key,initialClaim));
 const [storageError,setStorageError]=useState(false);
 const boundarySummary=fields.filter(field=>saved.boundaries[field]).map(field=>field+': '+saved.boundaries[field]).join('; ');
 const revised=boundarySummary?saved.original+'\nScope: '+boundarySummary:saved.original;
 const comparisons=useMemo(()=>evidence.map(item=>{
  const source=item.title+' '+item.summary_text;
  const originalScore=score(saved.original,source);
  const revisedScore=score(revised,source);
  const sourceWords=tokens(source);
  const byBoundary=fields.map(field=>({field,terms:[...tokens(saved.boundaries[field])].filter(term=>sourceWords.has(term))}));
  return {item,originalScore,revisedScore,delta:revisedScore-originalScore,byBoundary};
 }).sort((a,b)=>b.delta-a.delta||b.revisedScore-a.revisedScore),[evidence,saved.original,revised,saved.boundaries]);
 const persist=(next:Saved)=>{setSaved(next);try{writeStoredRecord(key,JSON.stringify(next));setStorageError(false)}catch{setStorageError(true)}};
 const saveRevision=()=>{const revision:Revision={id:crypto.randomUUID(),created:new Date().toISOString(),original:saved.original,revised,boundaries:{...saved.boundaries}};persist({...saved,history:[revision,...saved.history].slice(0,30)})};
 const query='\"'+revised.replaceAll('\"',' ')+'\"';
 return <>
  <p>Define a narrower claim and compare it with the same retrieved records. The scores are lexical signals; the table shows which boundary terms match each source. A lower score does not prove the revised claim is novel.</p>
  <label>Original claim<textarea rows={3} maxLength={3000} value={saved.original} onChange={event=>persist({...saved,original:event.target.value})}/></label>
  <div className="tool-input-grid">{fields.map(field=><label key={field}>{field}<input value={saved.boundaries[field]} maxLength={500} onChange={event=>persist({...saved,boundaries:{...saved.boundaries,[field]:event.target.value}})} placeholder={'Specify the '+field+' boundary'}/></label>)}</div>
  <div className="tool-result"><b>Revised scoped claim</b><p>{revised}</p><div className="tool-link-row"><a href={'https://scholar.google.com/scholar?q='+encodeURIComponent(query)} target="_blank" rel="noreferrer">Search this scope in Scholar ↗</a><a href={'https://patents.google.com/?q='+encodeURIComponent(query)} target="_blank" rel="noreferrer">Search patents ↗</a></div></div>
  <button type="button" className="quiet-button" onClick={saveRevision}>Save this revision</button>
  {comparisons.length?<div className="boundary-comparison-list"><h4>Same evidence set · {comparisons.length} records</h4>{comparisons.slice(0,20).map(({item,originalScore,revisedScore,delta,byBoundary})=><article className="quality-card" key={item.id}><b>{item.title}</b><div className="coverage-strip"><span>Original signal<b>{originalScore}%</b></span><span>Scoped signal<b>{revisedScore}%</b></span><span>Change<b>{delta>0?'+':''}{delta}</b></span></div><div className="boundary-term-list">{byBoundary.filter(entry=>saved.boundaries[entry.field]).map(entry=><span key={entry.field}><b>{entry.field}:</b> {entry.terms.length?entry.terms.join(', '):'no shared terms in returned text'}</span>)}</div><small>Inspect the original source before deciding whether this boundary changes the substantive comparison.</small></article>)}</div>:<p className="empty-state">No retrieved records are available for this comparison. Search the scoped claim to build evidence.</p>}
  {saved.history.length>0&&<details className="boundary-history"><summary>Saved revisions · {saved.history.length}</summary>{saved.history.map(revision=><article key={revision.id}><b>{new Date(revision.created).toLocaleString()}</b><p>{revision.revised}</p></article>)}</details>}
  {storageError&&<p className="warning-line" role="alert">This claim revision could not be saved in this browser.</p>}
  <small>Search links open external providers. Results opened there are not added to this report automatically.</small>
 </>;
}
