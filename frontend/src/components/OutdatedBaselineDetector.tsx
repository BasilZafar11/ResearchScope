import {parseStoredRecord,writeStoredRecord} from '../lib/projectRecords';
import {useMemo,useState} from 'react';
import type {Evidence} from '../types/novelty';
type Review={status:'unreviewed'|'considered'|'not relevant';reason:string};
type Saved={baselineId:string;task:string;dataset:string;protocol:string;reviews:Record<string,Review>};
const tokenSet=(text:string)=>new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(word=>word.length>2));
const matchScore=(a:string,b:string)=>{const x=tokenSet(a),y=tokenSet(b);if(!x.size||!y.size)return 0;return Math.round(100*[...x].filter(word=>y.has(word)).length/new Set([...x,...y]).size)};
function read(key:string):Saved{try{const value=parseStoredRecord(key,'null');return value?{baselineId:value.baselineId||'',task:value.task||'',dataset:value.dataset||'',protocol:value.protocol||'',reviews:value.reviews||{}}:{baselineId:'',task:'',dataset:'',protocol:'',reviews:{}}}catch{return {baselineId:'',task:'',dataset:'',protocol:'',reviews:{}}}}

export function OutdatedBaselineDetector({reportId,papers,idea}:{reportId:string;papers:Evidence[];idea:string}){
 const key='novelty-defense-'+reportId+'-newer-baselines';
 const [saved,setSaved]=useState(()=>read(key));
 const [storageError,setStorageError]=useState(false);
 const persist=(next:Saved)=>{setSaved(next);try{writeStoredRecord(key,JSON.stringify(next));setStorageError(false)}catch{setStorageError(true)}};
 const baseline=papers.find(paper=>paper.id===saved.baselineId);
 const year=Number((baseline?.publication_date||baseline?.priority_date||'').match(/\d{4}/)?.[0]||0);
 const taskContext=[saved.task,saved.dataset,saved.protocol].filter(Boolean).join(' ');
 const candidates=useMemo(()=>year?papers.filter(paper=>paper.id!==saved.baselineId&&Number((paper.publication_date||'').match(/\d{4}/)?.[0]||0)>year).map(paper=>({paper,taskFit:matchScore(taskContext,paper.title+' '+paper.summary_text),ideaFit:matchScore(idea,paper.title+' '+paper.summary_text)})).sort((a,b)=>b.taskFit-a.taskFit||b.ideaFit-a.ideaFit):[],[papers,year,saved.baselineId,taskContext,idea]);
 const query=encodeURIComponent(idea+' '+saved.task+' '+saved.dataset+' after:'+String(year||2000));
 const sendToFairness=(paper:Evidence)=>window.dispatchEvent(new CustomEvent('research-baseline-select',{detail:{name:paper.title,source:paper.source_url||paper.pdf_url||''}}));
 return <>
  <p>Find later candidates among papers already retrieved for this report. Recency and text similarity do not prove that a paper is a stronger or comparable baseline.</p>
  <label>Current baseline<select value={saved.baselineId} onChange={event=>persist({...saved,baselineId:event.target.value})}><option value="">Choose a paper from this report</option>{papers.map(paper=><option key={paper.id} value={paper.id}>{paper.title}</option>)}</select></label>
  <div className="tool-input-grid"><label>Research task<input value={saved.task} onChange={event=>persist({...saved,task:event.target.value})} placeholder="What task should the baseline solve?"/></label><label>Dataset or population<input value={saved.dataset} onChange={event=>persist({...saved,dataset:event.target.value})}/></label><label>Evaluation protocol<input value={saved.protocol} onChange={event=>persist({...saved,protocol:event.target.value})}/></label></div>
  {baseline&&<p>Selected baseline year: {year||'not reported'}. Records without a publication year cannot be ordered and are excluded from this recency comparison.</p>}
  {baseline&&<a className="tool-link" href={'https://scholar.google.com/scholar?q='+query} target="_blank" rel="noreferrer">Search for additional newer work ↗</a>}
  {!baseline?<p className="empty-state">Choose a baseline to compare against later retrieved papers.</p>:!year?<p className="empty-state">This baseline has no usable publication year. Choose another baseline or search manually.</p>:!candidates.length?<p className="empty-state">No later dated papers were returned in this report. Search for additional work before deciding the baseline is current.</p>:<div className="baseline-candidate-list">{candidates.map(({paper,taskFit,ideaFit})=>{const review=saved.reviews[paper.id]||{status:'unreviewed' as const,reason:''};return <article className="quality-card" key={paper.id}><header><b>{paper.publication_date} · {paper.title}</b><span>Task text signal {taskFit}% · proposal text signal {ideaFit}%</span></header><p>{paper.summary_text}</p><p>Check dataset, task, protocol, compute and tuning conditions before treating this as a suitable alternative.</p><label>Review<select value={review.status} onChange={event=>persist({...saved,reviews:{...saved.reviews,[paper.id]:{...review,status:event.target.value as Review['status']}}})}><option value="unreviewed">Not reviewed</option><option value="considered">Consider for comparison</option><option value="not relevant">Not relevant to this task</option></select></label><label>Reason<textarea rows={2} value={review.reason} onChange={event=>persist({...saved,reviews:{...saved.reviews,[paper.id]:{...review,reason:event.target.value}}})} placeholder="Record why it is suitable or not comparable"/></label><button className="quiet-button" type="button" onClick={()=>sendToFairness(paper)}>Use in baseline fairness audit</button>{paper.source_url&&<a href={paper.source_url} target="_blank" rel="noreferrer"> Open source ↗</a>}</article>})}</div>}
  {storageError&&<p className="warning-line" role="alert">Baseline review could not be saved in this browser.</p>}
  <small>Similarity is a screening signal. Newer work may use a different task or evaluation protocol; confirm suitability in the fairness audit.</small>
 </>;
}
