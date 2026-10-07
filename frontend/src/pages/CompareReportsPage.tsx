import {useQuery} from '@tanstack/react-query';
import {Link,useSearchParams} from 'react-router-dom';
import {api} from '../api/client';
import type {Report} from '../types/analysis';
import {scoreKeys,scoreLabels} from '../components/ScoringPriorities';

export function ComparisonTable({reports}:{reports:[Report,Report]}){
 const [a,b]=reports;
 const rows:{label:string;values:[React.ReactNode,React.ReactNode]}[]=[
  {label:'Original opportunity score',values:[`${a.overall_score}/100`,`${b.overall_score}/100`]},
  {label:'Interpretation',values:[a.interpretation,b.interpretation]},
  {label:'Confidence (data completeness)',values:[`${a.confidence_score}/100 · ${a.confidence_label}`,`${b.confidence_score}/100 · ${b.confidence_label}`]},
  ...scoreKeys.map(key=>({label:scoreLabels[key],values:reports.map(r=>`${r.component_scores[key]}/100 · ${r.methodology.weights[key]*100}% weight`) as [string,string]})),
  {label:'Visible competitors',values:[a.competitors.length,b.competitors.length]},
  {label:'Sampled reviews',values:[a.sections.reviews.count,b.sections.reviews.count]},
  {label:'Demand keywords',values:[a.input.keywords.join(', '),b.input.keywords.join(', ')]},
  {label:'Data availability',values:reports.map(r=>Object.entries(r.sections).map(([key,s])=>`${key}: ${s.status}`).join('; ')) as [string,string]},
  {label:'Data notes',values:[a.warnings.join(' ')||'None',b.warnings.join(' ')||'None']},
 ];
 return <><div className="notice">These are saved snapshots, not a controlled market experiment. Compare similar categories, keywords, dates, and data coverage. Confidence measures completeness, not business certainty.</div>
 {a.data_mode!==b.data_mode&&<p className="warnings">One report uses synthetic sample data and the other uses live data. Their scores are not directly comparable.</p>}
 {a.methodology_version!==b.methodology_version&&<p className="warnings">These reports use different methodology versions; score differences may reflect changed rules.</p>}
 <div className="report-section table-scroll"><table className="comparison-table"><caption className="sr-only">Side-by-side comparison of two saved reports</caption><thead><tr><th scope="col">Measure</th>{reports.map(r=><th scope="col" key={r.id}><Link to={`/reports/${r.id}`}>{r.input.business_category}<br/>{r.input.city}, {r.input.country}</Link><span className="hint">{r.data_mode==='fixture'?'Synthetic sample':'Live data'} · {new Date(r.created_at).toLocaleString()}<br/>Methodology {r.methodology_version}</span></th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((v,i)=><td key={i}>{v}</td>)}</tr>)}</tbody></table></div></>;
}

export function CompareReportsPage(){
 const [params,setParams]=useSearchParams();
 const left=params.get('left')||'',right=params.get('right')||'';
 const recent=useQuery({queryKey:['recent'],queryFn:api.recent});
 const first=useQuery({queryKey:['report',left],queryFn:()=>api.get(left),enabled:!!left});
 const second=useQuery({queryKey:['report',right],queryFn:()=>api.get(right),enabled:!!right&&right!==left});
 const update=(side:string,value:string)=>setParams(previous=>{const next=new URLSearchParams(previous);if(value)next.set(side,value);else next.delete(side);return next});
 return <><h1>Compare saved reports</h1><p>Choose two reports to compare their original scores and supporting signals. No new searches or SerpApi credits are used.</p>
 <section className="report-section comparison-selectors"><div className="form-row">{(['left','right'] as const).map(side=><label key={side}>{side==='left'?'First report':'Second report'}<select aria-label={side==='left'?'First report':'Second report'} value={side==='left'?left:right} onChange={e=>update(side,e.target.value)}><option value="">Select a saved report</option>{params.get(side)&&!recent.data?.some(r=>r.id===params.get(side))&&<option value={params.get(side)!}>Linked report · {params.get(side)}</option>}{recent.data?.map(r=><option key={r.id} value={r.id} disabled={r.id===(side==='left'?right:left)}>{r.business_category} · {r.city} · {r.data_mode==='fixture'?'Sample':'Live'} · {new Date(r.created_at).toLocaleString()} · {r.id.slice(0,8)}</option>)}</select></label>)}</div><p className="hint">The selectors list the 20 most recent completed reports. Selected report IDs remain in the URL so this comparison can be bookmarked or shared.</p>
 {recent.isPending&&<p role="status">Loading saved reports…</p>}{recent.isError&&<p role="alert">Could not load the report list. <button className="text-button" onClick={()=>recent.refetch()}>Retry list</button></p>}{recent.data?.length===0&&<p>No completed reports yet. <Link to="/">Create an analysis</Link> to begin.</p>}</section>
 {!left||!right?<p className="empty">Select two different completed reports to begin comparing.</p>:left===right?<p className="error" role="alert">Choose two different reports.</p>:first.isError||second.isError?<div className="error" role="alert">A selected report could not be loaded. Check the selection or <button className="text-button" onClick={()=>{first.refetch();second.refetch()}}>retry saved reports</button>.</div>:first.isPending||second.isPending?<p role="status">Loading comparison…</p>:first.data?.status==='complete'&&second.data?.status==='complete'?<ComparisonTable reports={[first.data,second.data]}/>:<p className="notice">Both reports must be complete before they can be compared. Choose completed reports from the list.</p>}
 </>;
}
