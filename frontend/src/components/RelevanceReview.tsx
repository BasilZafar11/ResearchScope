import {useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {api} from '../api/client';
import type {Report} from '../types/analysis';

export function RelevanceReview({report}:{report:Report}){
 const [ranks,setRanks]=useState<number[]>([]),[news,setNews]=useState<number[]>([]),[reason,setReason]=useState('Outside the requested category or target market');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const navigate=useNavigate();
 const toggle=(values:number[],value:number)=>values.includes(value)?values.filter(v=>v!==value):[...values,value];
 async function revise(){setBusy(true);setError('');try{const result=await api.revise(report.id,{competitor_ranks:ranks,news_indices:news,reason});navigate(result.report_url)}catch(e){setError(e instanceof Error?e.message:'Could not save revision')}finally{setBusy(false)}}
 return <section className="report-section" id="relevance-review"><h2>Search-result relevance review</h2><p>Exclude businesses or articles that do not fit your research. Save a separate report with recalculated scores and an explicit exclusion record. The source report remains available.</p>
 {report.relevance_audit&&<div className="notice"><p>This is a user-filtered revision of <Link to={`/reports/${report.relevance_audit.source_report_id}`}>the source report</Link>. Original score: {report.relevance_audit.original_score}; revised score: {report.overall_score}.</p><p>Reason: {report.relevance_audit.reason}</p><p>Excluded businesses: {report.relevance_audit.excluded_competitors.map(p=>p.name).join(', ')||'None'}</p><p>Excluded news: {report.relevance_audit.excluded_news.map(p=>p.title).join('; ')||'None'}</p></div>}
 <details><summary>Choose irrelevant results to exclude</summary><h3>Businesses</h3>{report.competitors.map(p=><label className="checkbox" key={p.rank}><input type="checkbox" checked={ranks.includes(p.rank)} onChange={()=>setRanks(toggle(ranks,p.rank))}/>Exclude {p.name}<span className="hint">{p.address}</span></label>)}<h3>News articles</h3>{report.news.map((n,i)=><label className="checkbox" key={i}><input type="checkbox" checked={news.includes(i)} onChange={()=>setNews(toggle(news,i))}/>Exclude {n.title}</label>)}</details>
 <label>Reason for exclusions<textarea maxLength={500} minLength={3} rows={2} value={reason} onChange={e=>setReason(e.target.value)}/></label><p className="hint">This reason and exclusion list will be public in the revised report. Excluded competitors’ reviews are removed. Advertising becomes neutral after any competitor exclusion because advertiser-to-location identity is uncertain. Trends retain the original query; selection bias remains possible.</p>
 <button className="primary" disabled={busy||(!ranks.length&&!news.length)||reason.trim().length<3} onClick={revise}>{busy?'Saving revised report…':`Save revised report (${ranks.length+news.length} exclusions)`}</button>{error&&<p role="alert" className="error">{error}</p>}<p className="hint">No new SerpApi searches. Uses the original observation dates and scoring reference date.</p></section>;
}
