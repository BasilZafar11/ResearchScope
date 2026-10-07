import {useState} from 'react';
import type {Report} from '../types/analysis';
import {days,openingState,suggestBrands,type BrandChoice} from '../lib/marketTools';

function Source({url}:{url:string|null}){return url&&/^https?:\/\//i.test(url)?<a href={url} target="_blank" rel="noopener noreferrer">View source</a>:<span>Link unavailable</span>}

export function HoursGaps({report}:{report:Report}){
 const [day,setDay]=useState(5),[hour,setHour]=useState(18);
 const rows=report.competitors.map(p=>({...p,state:openingState(p.operating_hours,day,hour*60)}));
 const count=(state:string)=>rows.filter(r=>r.state===state).length;
 return <section className="report-section" id="hours-gaps"><h2>Business-hours gap finder</h2><p>Explore published schedules in the businesses’ local time. Fewer open competitors can suggest a time to investigate; it does not establish customer demand.</p>
 {report.data_mode==='fixture'&&<p className="notice">Synthetic opening hours for demonstration.</p>}
 <p className="hint">Hours source: {report.sections.hours?.status||'not collected'}. Detail searches cover up to three high-signal competitors; other weekly hours may come from discovery results. Holidays and temporary changes may differ.</p>
 <div className="research-form"><label>Day<select aria-label="Opening-hours day" value={day} onChange={e=>setDay(Number(e.target.value))}>{days.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></label><label>Time<select aria-label="Opening-hours time" value={hour} onChange={e=>setHour(Number(e.target.value))}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select></label></div>
 <p aria-live="polite"><strong>{count('Open')} open · {count('Closed')} closed · {count('Unknown')} unknown</strong> across {rows.length} sampled locations.</p>
 <div className="table-scroll"><table><thead><tr><th>Competitor</th><th>At selected time</th><th>Published hours for {days[day]}</th><th>Evidence</th></tr></thead><tbody>{rows.map(p=><tr key={p.rank}><th scope="row">{p.name}</th><td>{p.state}</td><td>{p.operating_hours?.[days[day]]||'Unavailable'}</td><td><Source url={p.source_url}/></td></tr>)}</tbody></table></div>
 <details><summary>How hours are interpreted</summary><p>Explicit closed, 24-hour schedules, and unambiguous time ranges are supported, including split shifts and overnight hours from the previous day. Missing or ambiguous schedules remain unknown. A weekly schedule is not a real-time open-status check.</p></details></section>;
}

export function BrandCompetition({report}:{report:Report}){
 const suggested=suggestBrands(report.competitors,report.input.known_competitors);
 const storageKey='market-brands-v1:'+report.id;
 const [choices,setChoices]=useState<Record<string,BrandChoice>>(()=>{
  try {const parsed=JSON.parse(window.localStorage.getItem(storageKey)||'null');
   if(parsed&&typeof parsed==='object')for(const p of report.competitors){const c=parsed[p.rank];if(c&&typeof c.group==='string'&&['unverified','chain','independent'].includes(c.kind))suggested[p.rank]={group:c.group.slice(0,100),kind:c.kind};}
  }catch{/* Suggestions remain usable when storage is unavailable. */}return suggested;
 });
 const [status,setStatus]=useState('');
 function update(rank:number,field:'group'|'kind',value:string){setChoices({...choices,[rank]:{...choices[rank],[field]:value}});setStatus('Unsaved classification changes')}
 const groups=new Map<string,{name:string;count:number}>();
 for(const p of report.competitors){const c=choices[p.rank],name=c.group.trim()||p.name,key=name.toLowerCase();groups.set(key,{name,count:(groups.get(key)?.count||0)+1})}
 const classifications=Object.values(choices);
 return <section className="report-section" id="brand-competition"><h2>Chain versus independent competition</h2><p>Suggested groups use known brand names, repeated website hosts, or the name before a branch separator. Confirm ownership yourself; a single visible location does not prove a business is independent.</p>
 <p aria-live="polite">{classifications.filter(c=>c.kind==='chain').length} marked chain · {classifications.filter(c=>c.kind==='independent').length} marked independent · {classifications.filter(c=>c.kind==='unverified').length} unverified, out of {report.competitors.length} locations.</p>
 <div className="table-scroll"><table><thead><tr><th>Location</th><th>Brand / group</th><th>Your classification</th></tr></thead><tbody>{report.competitors.map(p=><tr key={p.rank}><th scope="row">{p.name}</th><td><input aria-label={`Brand for ${p.name}`} maxLength={100} value={choices[p.rank].group} onChange={e=>update(p.rank,'group',e.target.value)}/></td><td><select aria-label={`Classification for ${p.name}`} value={choices[p.rank].kind} onChange={e=>update(p.rank,'kind',e.target.value)}><option value="unverified">Unverified</option><option value="chain">Chain</option><option value="independent">Independent</option></select></td></tr>)}</tbody></table></div>
 <h3>Share of sampled locations by group</h3><ul>{[...groups.values()].sort((a,b)=>b.count-a.count).map(g=><li key={g.name.toLowerCase()}>{g.name}: {g.count} / {report.competitors.length} ({(g.count/report.competitors.length*100).toFixed(1)}%)</li>)}</ul><p className="hint">Shares describe this search sample, not revenue or citywide market share. Group names and classifications are your browser-local working assumptions; they do not change scores or shared reports.</p>
 <div className="report-actions"><button className="primary" onClick={()=>{try{window.localStorage.setItem(storageKey,JSON.stringify(choices));setStatus('Brand corrections saved in this browser')}catch{setStatus('Storage unavailable. Corrections remain in this tab.')}}}>Save brand corrections</button><button className="secondary" onClick={()=>{setChoices(suggestBrands(report.competitors,report.input.known_competitors));setStatus('Suggestions restored. Save to replace local corrections.')}}>Reset brand suggestions</button></div><p role="status">{status}</p></section>;
}

export function ReputationChanges({report}:{report:Report}){
 const rows=report.reputation||[];
 return <section className="report-section" id="reputation-changes"><h2>Review reputation changes</h2><p>Compare sampled ratings from the last 90 days with days 91–365 before collection. Each competitor needs at least three dated reviews in both periods before a direction is shown.</p>
 {report.data_mode==='fixture'&&<p className="notice">Synthetic review history for demonstration.</p>}
 {!rows.length?<p className="empty">{report.sections.reputation?.status==='skipped'?'Additional review history was switched off.':'No review-history comparison is stored. Create a fresh analysis with additional review history enabled.'}</p>:<div className="table-scroll"><table><thead><tr><th>Competitor</th><th>Recent average / count</th><th>Older average / count</th><th>Change</th><th>Evidence</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.data_id||i}><th scope="row">{r.competitor}<span className="hint">As of {r.reference_date.slice(0,10)} · {r.status}</span></th><td>{r.recent_average??'—'} / 5 ({r.recent_count})</td><td>{r.older_average??'—'} / 5 ({r.older_count})</td><td>{r.direction}{r.delta!==null&&<span className="hint">{r.delta>0?'+':''}{r.delta} stars</span>}</td><td><details><summary>Review samples</summary>{[...r.recent,...r.older].map((e,n)=><blockquote key={n}><p>{e.text||'Rating only'}</p><footer>{e.rating}/5 · {e.published_at?.slice(0,10)} · <Source url={e.source_url}/></footer></blockquote>)}</details></td></tr>)}</tbody></table></div>}
 <p className="hint">At most two newest-first pages per selected competitor. Missing older reviews mean insufficient data, not a stable reputation. Duplicate reviews are removed; undated, future, and over-one-year reviews are excluded. A change of at least ±0.25 stars labels a direction; this is not a statistical significance test. The original score still uses the initial recent page.</p></section>;
}
