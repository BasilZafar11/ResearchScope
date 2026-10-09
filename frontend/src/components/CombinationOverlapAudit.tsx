import {parseStoredRecord,writeStoredRecord} from '../lib/projectRecords';
import {useResearchDraft} from '../lib/researchDraft';
import {useEffect,useMemo,useState} from 'react';
import type {Evidence} from '../types/novelty';

type ReviewState='unreviewed'|'supports component'|'does not support component';
type ComponentReview={state:ReviewState;excerpt:string;note:string};
type CombinationReview={excerpt:string;confirmed:boolean;note:string};
type ManualSource={id:string;title:string;url:string;excerpt:string};
type PriorSource={id:string;title:string;url:string;excerpt:string};
type AuditState={components:string;componentReviews:Record<string,ComponentReview>;combinationReviews:Record<string,CombinationReview>;manualSources:ManualSource[]};

const words=(text:string)=>new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(word=>word.length>2));
const overlap=(left:string,right:string)=>{const a=words(left),b=words(right);if(!a.size||!b.size)return 0;return Math.round(100*[...a].filter(word=>b.has(word)).length/new Set([...a,...b]).size)};
const scholar=(query:string)=>'https://scholar.google.com/scholar?q='+encodeURIComponent(query);
const emptyState=(components:string):AuditState=>({components,componentReviews:{},combinationReviews:{},manualSources:[]});

function readState(key:string,fallback:AuditState):AuditState{
 try{
  const value=parseStoredRecord(key,'null') as Partial<AuditState>|null;
  if(!value||typeof value.components!=='string')return fallback;
  return {components:value.components,componentReviews:value.componentReviews||{},combinationReviews:value.combinationReviews||{},manualSources:Array.isArray(value.manualSources)?value.manualSources:[]};
 }catch{return fallback}
}
function readPriorSources(reportId:string):PriorSource[]{try{const value=parseStoredRecord('novelty-defense-'+reportId+'-hidden-prior-work','[]');return Array.isArray(value)?value.map((item:any)=>({id:'prior:'+item.id,title:item.title,url:item.url||'',excerpt:item.excerpt||''})):[]}catch{return []}}

export function CombinationOverlapAudit({reportId,initialComponents,evidence}:{reportId:string;initialComponents:string;evidence:Evidence[]}){
 const storageKey='novelty-defense-'+reportId+'-combination-audit';
 const [audit,setAudit]=useState(()=>readState(storageKey,emptyState(initialComponents)));
 const [priorSources,setPriorSources]=useState(()=>readPriorSources(reportId));
 const [storageError,setStorageError]=useState(false);
 const [sourceError,setSourceError]=useState('');
 const [sourceDraft,setSourceDraft]=useResearchDraft(reportId,'CombinationOverlapAudit-sourceDraft',{title:'',url:'',excerpt:''});
 const components=[...new Set(audit.components.split('\n').map(value=>value.trim()).filter(Boolean))].slice(0,8);
 const sourceEvidence=useMemo(()=>[...evidence,...priorSources.map(source=>({id:source.id,source_type:'web' as const,title:source.title,source_url:source.url||null,pdf_url:null,summary_text:source.excerpt,similarity_score:0})),...audit.manualSources.map(source=>({id:source.id,source_type:'web' as const,title:source.title,source_url:source.url||null,pdf_url:null,summary_text:source.excerpt,similarity_score:0}))],[evidence,priorSources,audit.manualSources]);
 useEffect(()=>{const listener=(event:Event)=>{const value=(event as CustomEvent<PriorSource[]>).detail||[];setPriorSources(value.map(item=>({id:'prior:'+item.id,title:item.title,url:item.url||'',excerpt:item.excerpt||''})))};window.addEventListener('research-prior-work-update',listener);return()=>window.removeEventListener('research-prior-work-update',listener)},[]);
 const candidates=useMemo(()=>{
  if(!components.length)return [];
  return sourceEvidence.map(item=>{
   const scores=components.map(component=>overlap(component,item.title+' '+item.summary_text));
   return {item,scores,matched:scores.filter(score=>score>=18).length,total:scores.reduce((sum,score)=>sum+score,0)};
  }).filter(candidate=>candidate.matched>0).sort((a,b)=>b.matched-a.matched||b.total-a.total).slice(0,12);
 },[components.join('\n'),sourceEvidence]);
 const reviewedCombinationCount=candidates.filter(({item})=>components.length>0&&components.every(component=>{const review=audit.componentReviews[item.id+':'+component.toLocaleLowerCase()];return review?.state==='supports component'&&Boolean(review.excerpt.trim())})&&audit.combinationReviews[item.id]?.confirmed&&Boolean(audit.combinationReviews[item.id]?.excerpt.trim())).length;
 const update=(next:AuditState)=>{
  setAudit(next);
  try{writeStoredRecord(storageKey,JSON.stringify(next));setStorageError(false)}catch{setStorageError(true)}
 };
 const setComponentReview=(key:string,patch:Partial<ComponentReview>)=>{
  const current=audit.componentReviews[key]||{state:'unreviewed' as const,excerpt:'',note:''};
  update({...audit,componentReviews:{...audit.componentReviews,[key]:{...current,...patch}}});
 };
 const setCombinationReview=(sourceId:string,patch:Partial<CombinationReview>)=>{
  const current=audit.combinationReviews[sourceId]||{excerpt:'',confirmed:false,note:''};
  update({...audit,combinationReviews:{...audit.combinationReviews,[sourceId]:{...current,...patch}}});
 };
 const addSource=()=>{
  if(!sourceDraft.title.trim()||!sourceDraft.excerpt.trim())return;
  const url=sourceDraft.url.trim();
  if(url){try{if(!['http:','https:'].includes(new URL(url).protocol))throw new Error('Only http and https links are supported.')}catch{setSourceError('Enter a valid http or https source URL, or leave the URL blank.');return}}
  const manualSources=[...audit.manualSources,{id:'manual:'+crypto.randomUUID(),title:sourceDraft.title.trim(),url,excerpt:sourceDraft.excerpt.trim()}];
  update({...audit,manualSources});
  setSourceError('');
  setSourceDraft({title:'',url:'',excerpt:''});
 };

 return <>
  <p>Break the proposed contribution into components. Text matches only suggest records to review. A source counts as covering the full combination only after you confirm its component evidence and enter a passage showing how the components work together.</p>
  <label>One component per line<textarea rows={4} maxLength={1600} value={audit.components} onChange={event=>update({...audit,components:event.target.value,combinationReviews:Object.fromEntries(Object.entries(audit.combinationReviews).map(([key,value])=>[key,{...value,confirmed:false}]))})} placeholder={'Example:\nMethod: federated learning\nConstraint: intermittent connectivity\nSetting: rural clinics'}/></label>
  <p>{components.length}/8 distinct components. Edit the list to keep each component specific and reviewable.</p>
  {components.length>0&&<div className="tool-link-row"><a href={scholar(components.map(value=>'"'+value+'"').join(' '))} target="_blank" rel="noreferrer">Search all components together ↗</a>{components.map(component=><a key={component} href={scholar(component)} target="_blank" rel="noreferrer">Search “{component}” ↗</a>)}</div>}
  <details className="manual-source-entry"><summary>Add a source found in another search</summary><p>Paste the title, source link, and relevant excerpt from an individual or combined search. This copy is saved locally with this report.</p><div className="tool-input-grid"><label>Source title<input value={sourceDraft.title} onChange={event=>setSourceDraft({...sourceDraft,title:event.target.value})} maxLength={500}/></label><label>Source URL<input type="url" value={sourceDraft.url} onChange={event=>setSourceDraft({...sourceDraft,url:event.target.value})} maxLength={2000}/></label></div><label>Abstract or passage<textarea rows={4} value={sourceDraft.excerpt} onChange={event=>setSourceDraft({...sourceDraft,excerpt:event.target.value})} maxLength={6000}/></label>{sourceError&&<p className="warning-line" role="alert">{sourceError}</p>}<button className="quiet-button" type="button" disabled={!sourceDraft.title.trim()||!sourceDraft.excerpt.trim()} onClick={addSource}>Add source to this audit</button></details>
  <div className="coverage-strip"><span>Retrieved candidate records<b>{candidates.length}</b></span><span>User-confirmed complete combinations<b>{reviewedCombinationCount}</b></span></div>
  {candidates.length===0?<p className="empty-state">No component matches were found in this report’s retrieved papers, patents, or web results. Try the searches above or refine the component wording. This does not establish a research gap.</p>:<div className="combination-candidates"><p>Review candidates in the retrieved set. A component match is not evidence by itself; open the original source and record the passage you checked.</p>{candidates.map(({item,scores})=><article className="combination-candidate" key={item.id}>
   <header><div><span className="source-tag">{item.id.startsWith('manual:')?'User added source':item.source_type==='scholar'?'Paper':item.source_type==='patent'?'Patent':'Web result'}</span><h3>{item.title}</h3></div><a href={item.source_url||item.pdf_url||scholar(item.title)} target="_blank" rel="noreferrer">Open source ↗</a></header>
   <p className="combination-summary">{item.summary_text||'No source excerpt was returned. Open the original record and paste a passage below after review.'}</p>
   <div className="combination-component-grid">{components.map((component,index)=>{
    const key=item.id+':'+component.toLocaleLowerCase();
    const review=audit.componentReviews[key]||{state:'unreviewed' as const,excerpt:'',note:''};
    return <section className="combination-component" key={key}>
     <div><b>{component}</b><span className="match-signal">Text match signal: {scores[index]}% · Suggested</span></div>
     <label>Review status<select value={review.state} onChange={event=>setComponentReview(key,{state:event.target.value as ReviewState})}><option value="unreviewed">Unreviewed</option><option value="supports component">Passage supports this component</option><option value="does not support component">Passage does not support this component</option></select></label>
     <label>Supporting or contradicting passage<textarea rows={2} maxLength={3000} value={review.excerpt} onChange={event=>setComponentReview(key,{excerpt:event.target.value})} placeholder="Paste the specific passage and page/section, if available"/></label>
     <label>Review note<input value={review.note} maxLength={500} onChange={event=>setComponentReview(key,{note:event.target.value})} placeholder="Optional context or reason"/></label>
    </section>;
   })}</div>
   <section className="combination-proof"><h4>Does one passage establish the complete combination?</h4><p>Only confirm this when one source passage explains the components together. Separate component matches do not qualify.</p><label>Passage describing the combination<textarea rows={3} maxLength={4000} value={audit.combinationReviews[item.id]?.excerpt||''} onChange={event=>setCombinationReview(item.id,{excerpt:event.target.value,confirmed:false})} placeholder="Paste the passage that describes how these components are combined"/></label><label className="confirm-combination"><input type="checkbox" checked={Boolean(audit.combinationReviews[item.id]?.confirmed)} disabled={!audit.combinationReviews[item.id]?.excerpt.trim()||!components.every(component=>{const review=audit.componentReviews[item.id+':'+component.toLocaleLowerCase()];return review?.state==='supports component'&&Boolean(review.excerpt.trim())})} onChange={event=>setCombinationReview(item.id,{confirmed:event.target.checked})}/>I reviewed the original source and this passage supports the full combination.</label>{audit.combinationReviews[item.id]?.confirmed&&<p className="reviewed-signal">User confirmed · all component passages and the complete-combination passage are recorded.</p>}</section>
  </article>)}</div>}
  {storageError&&<p className="warning-line" role="alert">This audit could not be saved in this browser. Check available browser storage before leaving the page.</p>}
  <small>Text matching is a candidate-finding aid. User confirmations are stored in this browser for this report; they are not expert verification or a scientific novelty determination.</small>
 </>;
}
