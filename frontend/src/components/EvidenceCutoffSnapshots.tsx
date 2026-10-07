import {useMemo,useState} from 'react';
import type {Evidence,NoveltyReport} from '../types/novelty';
type Availability='before cutoff'|'after cutoff'|'date uncertain'|'undated';
type SnapshotSource={id:string;identity:string;title:string;sourceType:string;url:string|null;abstract:string;publicationDate:string|null;priorityDate:string|null;similarity:number};
type Snapshot={id:string;createdAt:string;cutoff:string;reportTitle:string;reportId:string;overlapScore:number;methodologyVersion:string;queries:NoveltyReport['queries'];included:SnapshotSource[];uncertain:SnapshotSource[];undated:SnapshotSource[]};
function classify(value?:string,cutoff=''):Availability{
 if(!value)return 'undated';const yearMonthDay=value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);if(!yearMonthDay)return 'date uncertain';
 const year=Number(yearMonthDay[1]),month=Number(yearMonthDay[2]||0),day=Number(yearMonthDay[3]||0);
 if(!month)return cutoff>=year+'-12-31'?'before cutoff':cutoff<year+'-01-01'?'after cutoff':'date uncertain';
 if(!day){const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();return cutoff>=year+'-'+String(month).padStart(2,'0')+'-'+lastDay?'before cutoff':cutoff<year+'-'+String(month).padStart(2,'0')+'-01'?'after cutoff':'date uncertain'}
 return value.slice(0,10)<=cutoff?'before cutoff':'after cutoff';
}
function identity(item:Evidence){return (item.source_url||item.patent_id||item.title).trim().toLocaleLowerCase()}
function read(key:string):Snapshot[]{try{const items=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(items)?items:[]}catch{return []}}
function exportJson(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function EvidenceCutoffSnapshots({reportId,report,evidence}:{reportId:string;report:NoveltyReport;evidence:Evidence[]}){
 const key='novelty-defense-'+reportId+'-evidence-snapshots';const [snapshots,setSnapshots]=useState(()=>read(key));const [cutoff,setCutoff]=useState(new Date().toISOString().slice(0,10));const [left,setLeft]=useState(''),[right,setRight]=useState('');const [error,setError]=useState('');
 const classified=useMemo(()=>evidence.map(item=>({item,availability:classify(item.publication_date,cutoff)})),[evidence,cutoff]);
 const included=classified.filter(row=>row.availability==='before cutoff');const uncertain=classified.filter(row=>row.availability==='date uncertain');const undated=classified.filter(row=>row.availability==='undated');const after=classified.filter(row=>row.availability==='after cutoff');
 const toSource=({item}:typeof classified[number]):SnapshotSource=>({id:item.id,identity:identity(item),title:item.title,sourceType:item.source_type,url:item.source_url||item.pdf_url||null,abstract:item.summary_text,publicationDate:item.publication_date||null,priorityDate:item.priority_date||null,similarity:item.similarity_score});
 const saveSnapshot=()=>{
  const snapshot:Snapshot={id:crypto.randomUUID(),createdAt:new Date().toISOString(),cutoff,reportTitle:report.input.title,reportId,overlapScore:report.overlap_score,methodologyVersion:report.methodology_version,queries:report.queries,included:included.map(toSource),uncertain:uncertain.map(toSource),undated:undated.map(toSource)};
  const next=[snapshot,...snapshots].slice(0,10);
  try{const serialized=JSON.stringify(next);if(serialized.length>1500000)throw new Error('Snapshot history exceeds the browser storage limit. Export your snapshots and remove older ones.');localStorage.setItem(key,serialized);setSnapshots(next);setError('')}catch(reason){setError(reason instanceof Error?reason.message:'Could not save the snapshot. Export or remove older snapshots.')}
 };
 const remove=(id:string)=>{const next=snapshots.filter(snapshot=>snapshot.id!==id);try{localStorage.setItem(key,JSON.stringify(next));setSnapshots(next)}catch{setError('Could not update snapshot history.')}};
 const first=snapshots.find(snapshot=>snapshot.id===left),second=snapshots.find(snapshot=>snapshot.id===right);
 const diff=first&&second?{added:second.included.filter(item=>!first.included.some(old=>old.identity===item.identity)),removed:first.included.filter(item=>!second.included.some(now=>now.identity===item.identity))}:null;
 const exportOne=(snapshot:Snapshot)=>exportJson(snapshot,'novelty-evidence-snapshot-'+snapshot.cutoff+'.json');
 return <>
  <p>Set the date the proposal is being assessed against. Only public publication dates determine inclusion; patent priority dates do not establish when a record became public.</p>
  <label>Evidence cutoff date<input type="date" value={cutoff} onChange={event=>setCutoff(event.target.value)}/></label>
  <div className="coverage-strip"><span>Definitely available by cutoff<b>{included.length}</b></span><span>Date overlaps cutoff<b>{uncertain.length}</b></span><span>Undated<b>{undated.length}</b></span><span>After cutoff<b>{after.length}</b></span></div>
  {uncertain.length>0&&<p className="warning-line">Year-only or month-only dates are included as uncertain when their full date range overlaps the cutoff; they are excluded from the dated snapshot.</p>}
  <details className="snapshot-source-preview"><summary>Preview evidence included and excluded</summary>{[...included.map(row=>({...row,label:'Included'})),...uncertain.map(row=>({...row,label:'Date uncertain'})),...undated.map(row=>({...row,label:'Undated'})),...after.map(row=>({...row,label:'After cutoff'}))].map(row=><article key={row.item.id}><b>{row.label} · {row.item.title}</b><small>Publication: {row.item.publication_date||'unknown'} · Priority: {row.item.priority_date||'unknown'} · {row.item.source_type}</small></article>)}</details>
  <button className="quiet-button" type="button" onClick={saveSnapshot}>Save immutable snapshot locally</button>
  <div className="snapshot-history"><h4>Saved snapshots · {snapshots.length}/10</h4>{snapshots.map(snapshot=><article key={snapshot.id}><header><b>{snapshot.cutoff} · {snapshot.reportTitle}</b><small>Saved {new Date(snapshot.createdAt).toLocaleString()}</small></header><p>{snapshot.included.length} included · {snapshot.uncertain.length} uncertain · {snapshot.undated.length} undated · overlap signal {snapshot.overlapScore}</p><div className="tool-link-row"><button type="button" onClick={()=>exportOne(snapshot)}>Export complete JSON</button><button type="button" onClick={()=>remove(snapshot.id)}>Remove</button></div><label>Compare with<select value={left} onChange={event=>setLeft(event.target.value)}><option value="">Choose snapshot</option>{snapshots.map(option=><option key={option.id} value={option.id}>{option.cutoff} · {option.reportTitle}</option>)}</select></label><label>Compared snapshot<select value={right} onChange={event=>setRight(event.target.value)}><option value="">Choose snapshot</option>{snapshots.map(option=><option key={option.id} value={option.id}>{option.cutoff} · {option.reportTitle}</option>)}</select></label></article>)}</div>
  {diff&&<div className="tool-result"><b>Snapshot comparison</b><p>{diff.added.length} newly included records · {diff.removed.length} records absent from the later dated set.</p>{diff.added.map(item=><small key={'add'+item.identity}>Added: {item.title}<br/></small>)}{diff.removed.map(item=><small key={'remove'+item.identity}>Removed: {item.title}<br/></small>)}</div>}
  {error&&<p className="warning-line" role="alert">{error}</p>}
  <small>The snapshot includes complete returned metadata and excerpts, queries, report score, and methodology version. It stays in this browser until exported or deleted; it is not a verified archive of every source's full text.</small>
 </>;
}
