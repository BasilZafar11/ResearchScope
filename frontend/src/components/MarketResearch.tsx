import {useState} from 'react';
import type {Report, Review} from '../types/analysis';

export type TrendPoint = {date:string;timestamp?:number|null;values:Record<string,number>};
export type MatrixRow = {competitor:string;data_id:string|null;sample_size:number;topics:Record<string,{positive:Review[];negative:Review[]}>};
export type Query = {query:string;kind:string;value:string;seed?:string;source_url?:string};
export type ResearchReport = Report & {review_matrix?:MatrixRow[];related_queries?:Query[];seasonality_series?:TrendPoint[]};

function SourceLink({url,children}:{url:string|null;children:React.ReactNode}) {
 return url && /^https?:\/\//i.test(url)?<a href={url} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children} (direct link unavailable)</span>;
}

export function ReviewMatrix({report}:{report:ResearchReport}) {
 const rows=report.review_matrix;
 const topics=['Pricing','Service','Cleanliness','Facilities','Flexibility'];
 return <section className="report-section" id="review-matrix"><h2>Competitor strengths and weaknesses</h2>
  <p>Explore topic mentions in 4–5 star reviews (positive) and 1–3 star reviews (negative). These are whole-review ratings, not sentiment judgments about individual topics. Read the excerpts before drawing conclusions.</p>
  {report.data_mode==='fixture'&&<p className="notice">Synthetic sample reviews for demonstration.</p>}
  {!rows?.length?<p className="empty">Review comparison data is unavailable in this report. Create a fresh analysis to collect it.</p>:<div className="table-scroll"><table aria-label="Competitor strengths and weaknesses"><thead><tr><th>Competitor / sample</th>{topics.map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.data_id||i}><th scope="row">{r.competitor}<span className="hint">{r.sample_size} sampled reviews</span></th>{topics.map(t=>{const cell=r.topics[t];return <td key={t}>{!cell?<span className="muted">No mentions</span>:<details><summary>{cell.positive.length} positive / {cell.negative.length} negative</summary>{[...cell.positive,...cell.negative].map((e,n)=><blockquote key={n}><p>{e.text}</p><footer><SourceLink url={e.source_url}>{e.rating}/5 · {e.published_at?.slice(0,10)||'Date unavailable'}</SourceLink></footer></blockquote>)}</details>}</td>})}</tr>)}</tbody></table></div>}
  <p className="hint">Only businesses with sampled reviews appear. A missing mention is not evidence of good or poor performance. Topic matching uses fixed word lists and can miss context or negation.</p>
  <details><summary>Topic matching rules</summary><p>Pricing: price, pricing, expensive, affordable, value, fee, overpriced. Service: staff, service, helpful, rude, response. Cleanliness: clean, dirty, cleanliness, maintenance, toilet. Facilities: internet, wifi, wi-fi, desk, desks, meeting, facilities, parking. Flexibility: contract, deposit, refund, flexible, cancellation. Matching is case-insensitive, with whole words.</p></details>
 </section>;
}

export function KeywordFinder({report}:{report:ResearchReport}) {
 const [kind,setKind]=useState('all');
 const queries=(report.related_queries||[]).filter(q=>kind==='all'||q.kind===kind);
 const source=report.evidence.find(e=>e.evidence_type==='trends')?.source_url;
 let geo='';
 try {geo=source?new URL(source).searchParams.get('geo')||'':''}catch{/* Older source URLs may be absent or invalid. */}
 return <section className="report-section" id="keyword-opportunities"><h2>Keyword opportunity finder</h2><p>Related searches for “{report.input.keywords[0]}” in {report.input.country}. These suggest research directions, not proven commercial opportunities.</p>
 {report.data_mode==='fixture'&&<p className="notice">Synthetic sample queries for demonstration.</p>}
 <label className="research-select">Show queries<select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">Top and rising</option><option value="top">Top</option><option value="rising">Rising</option></select></label>
 {queries.length?<div className="table-scroll"><table><thead><tr><th>Related query</th><th>Signal</th><th>Reported value</th><th>Explore</th></tr></thead><tbody>{queries.map(q=><tr key={q.kind+q.query}><td>{q.query}</td><td>{q.kind}</td><td>{q.value||'Unavailable'}</td><td><SourceLink url={q.source_url||'https://trends.google.com/trends/explore?'+new URLSearchParams({q:q.query,geo,date:'today 12-m'})}>Open in Google Trends</SourceLink></td></tr>)}</tbody></table></div>:<p className="empty">{report.sections.keywords?.message||'No matching related queries are stored. A fresh analysis can request them.'}</p>}
 <p className="hint">Top values are relative interest (0–100), not search volume. Rising values describe growth; “Breakout” is a provider label. Each new analysis requests related queries for the first keyword only.</p></section>;
}

export function monthlyInterest(series:TrendPoint[],keyword:string) {
 const buckets=Array.from({length:12},()=>new Map<number,number[]>());
 for(const point of series){
  const date=point.timestamp!=null?new Date(point.timestamp*1000):new Date(/^\d{4}-\d{2}(-\d{2})?$/.test(point.date)?point.date:'invalid');
  const value=point.values[keyword];
  if(!Number.isFinite(date.getTime())||!Number.isFinite(value)||value<0||value>100)continue;
  const month=buckets[date.getUTCMonth()],year=date.getUTCFullYear();
  month.set(year,[...(month.get(year)||[]),value]);
 }
 return buckets.map(bucket=>{
  const means=[...bucket.values()].map(values=>values.reduce((a,b)=>a+b,0)/values.length);
  return {years:means.length,points:[...bucket.values()].reduce((sum,v)=>sum+v.length,0),mean:means.length?means.reduce((a,b)=>a+b,0)/means.length:null};
 });
}

export function Seasonality({report}:{report:ResearchReport}) {
 const [keyword,setKeyword]=useState(report.input.keywords[0]);
 const data=monthlyInterest(report.seasonality_series||[],keyword);
 const valid=data.filter(d=>d.mean!==null);
 const enough=data.every(d=>d.years>=2);
 const average=valid.length?valid.reduce((s,d)=>s+d.mean!,0)/valid.length:0;
 return <section className="report-section" id="seasonality"><h2>Demand seasonality calendar</h2><p>Historical monthly search interest in {report.input.country}. Five years requested; this is not a forecast of sales or a recommended launch date.</p>
 {report.data_mode==='fixture'&&<p className="notice">Synthetic fixed history for demonstration, not observed seasonality.</p>}
 {report.evidence.find(e=>e.evidence_type==='seasonality')?.source_url&&<SourceLink url={report.evidence.find(e=>e.evidence_type==='seasonality')!.source_url}>Explore historical source</SourceLink>}
 <label className="research-select">Seasonality keyword<select value={keyword} onChange={e=>setKeyword(e.target.value)}>{report.input.keywords.map(k=><option key={k}>{k}</option>)}</select></label>
 {!valid.length?<p className="empty">{report.sections.seasonality?.message||'No longer-term history is stored. Create a fresh analysis to populate the calendar.'}</p>:<><p>{enough?'Higher and lower months are relative to the average of the 12 monthly values.':'Limited history: at least two years per calendar month are required before labeling stronger or weaker months.'}</p><div className="season-calendar">{data.map((d,i)=>{const label=d.mean===null?'No data':!enough?'Limited history':d.mean>average*1.1?'Higher interest':d.mean<average*.9?'Lower interest':'Typical interest';return <div key={i} className={label==='Higher interest'?'season-high':label==='Lower interest'?'season-low':''}><h3>{new Date(Date.UTC(2020,i,1)).toLocaleDateString('en',{month:'short',timeZone:'UTC'})}</h3><strong>{d.mean===null?'—':d.mean.toFixed(1)}</strong><span>{label}</span><small>{d.years} years · {d.points} observations</small></div>})}</div></>}
 <details><summary>Calendar calculation</summary><p>Group observations by UTC month and year, average each month within each year, then average those values across years equally. Higher/lower means more than 10% above/below the average monthly value. Indices range from 0 to 100; zero is retained. Long-term growth and partial months can affect this comparison; it does not establish recurring seasonality.</p></details></section>;
}
