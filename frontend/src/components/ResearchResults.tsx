import {useState} from 'react';
import {z} from 'zod';
import {useLocalRecords} from '../lib/useLocalRecords';
import {priceRanges,safeLink} from '../lib/researchTools';
import type {ResearchRow,ResearchRun} from '../types/research';

function Source({url,children='Open source'}:{url?:string|null;children?:React.ReactNode}){return safeLink(url)?<a href={url!} target="_blank" rel="noopener noreferrer">{children}</a>:<span className="hint">Source link unavailable</span>}
function Details({row}:{row:ResearchRow}){return <><h3>{safeLink(row.url)?<Source url={row.url}>{row.title}</Source>:row.title}</h3>{!safeLink(row.url)&&<p className="hint">Source link unavailable</p>}{row.detail&&<p>{row.detail}</p>}<dl className="research-metadata">{Object.entries(row.meta).filter(([k])=>k!=='Amount').map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value===null||value===''?'Unavailable':value}</dd></div>)}</dl></>}
const allRows=(run:ResearchRun)=>run.batches.flatMap(b=>b.rows);
function FilteredEvidence({run}:{run:ResearchRun}){
 const [filter,setFilter]=useState('All');const rows=allRows(run);const labels=[...new Set(rows.flatMap(r=>r.tags))];const matched=filter==='All'?rows:rows.filter(r=>r.tags.includes(filter));
 const employers=new Set(rows.map(r=>r.meta.Employer).filter(Boolean));
 return <>{run.tool==='jobs'&&<p className="notice">{rows.length} sampled listings · {employers.size} named employers · {rows.filter(r=>r.meta.Salary).length} listings with a salary field.</p>}<label className="research-select">{run.tool==='jobs'?'Filter by skill mention':'Filter by discussion topic'}<select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{labels.map(t=><option key={t}>{t}</option>)}</select></label>{run.tool==='jobs'&&<p className="hint">Matched terms: customer service, sales, marketing, operations, Excel, Python, management, hospitality. Absence of a match does not mean a skill is unnecessary.</p>}<div className="research-evidence-list">{matched.map(r=><article key={r.id}><Details row={r}/><p className="hint">Matched: {r.tags.join(', ')||'No listed skill terms'}</p></article>)}</div>{!matched.length&&<p>No results match this filter.</p>}</>;
}
function RouteResults({run}:{run:ResearchRun}){
 const [limit,setLimit]=useState(30);
 return <><label className="research-select">Travel-time threshold (minutes)<input type="number" min={1} max={240} value={Number.isFinite(limit)?limit:''} onChange={e=>setLimit(e.target.valueAsNumber)}/></label><div className="table-scroll"><table><thead><tr><th>Destination</th><th>Fastest returned route</th><th>Within threshold?</th><th>Routes</th></tr></thead><tbody>{run.batches.map((b,i)=>{const times=b.rows.map(r=>r.meta.Minutes).filter((v):v is number=>typeof v==='number');const fastest=times.length?Math.min(...times):null;return <tr key={i}><th>{b.label}</th><td>{fastest===null?'Unavailable':`${fastest} min`}</td><td>{fastest===null||!Number.isFinite(limit)||limit<1||limit>240?'Unknown':fastest<=limit?'Yes':'No'}</td><td><details><summary>{b.rows.length} routes</summary>{b.rows.map(r=><article key={r.id}><Details row={r}/></article>)}<Source url={b.source_url}>Open route search</Source></details></td></tr>})}</tbody></table></div><p className="hint">Unavailable routes remain unknown. Multiple routes to one destination count as one destination.</p></>;
}
function IntentResults({run}:{run:ResearchRun}){
 const [intent,setIntent]=useState('All');
 return <><label className="research-select">Intent filter<select value={intent} onChange={e=>setIntent(e.target.value)}>{['All','Local access','Price','Comparison','Other intent'].map(t=><option key={t}>{t}</option>)}</select></label><div className="intent-branches">{run.batches.map((b,i)=><section key={i}><h3>“{b.label}”</h3><ul>{b.rows.filter(r=>intent==='All'||r.tags.includes(intent)).map(r=><li key={r.id}><Source url={r.url}>{r.title}</Source><span className="hint">{r.tags.join(', ')}</span></li>)}</ul>{!b.rows.some(r=>intent==='All'||r.tags.includes(intent))&&<p>No suggestions match.</p>}</section>)}</div></>;
}
function EventResults({run}:{run:ResearchRun}){
 const grouped=new Map<string,ResearchRow[]>();for(const r of allRows(run)){const date=String(r.meta['Start label']||'Date unavailable');grouped.set(date,[...(grouped.get(date)||[]),r])}
 return <div className="event-calendar">{[...grouped].map(([day,records])=><section key={day}><h3>{day}</h3>{records.map(r=><article key={r.id}><Details row={r}/></article>)}</section>)}</div>;
}
function RangeSummary({rows}:{rows:ResearchRow[]}){
 const ranges=priceRanges(rows);
 return <>{ranges.length?ranges.map(r=><p className="notice" key={r.currency}>{r.currency}: {r.min.toLocaleString()}–{r.max.toLocaleString()} · median {r.median.toLocaleString()} · {r.count} priced results.</p>):<p>Select comparable results with known numeric prices and currencies to calculate a range.</p>}</>;
}
function ShoppingResults({run}:{run:ResearchRun}){
 const rows=allRows(run),[selected,setSelected]=useState<string[]>([]);
 return <><p>Select comparable products to build a benchmark. Different currencies are summarized separately; shipping and taxes are not added.</p><RangeSummary rows={rows.filter(r=>selected.includes(r.id))}/><div className="table-scroll"><table><thead><tr><th>Include</th><th>Product</th><th>Seller</th><th>Price</th><th>Delivery</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><input aria-label={`Include ${r.title}`} type="checkbox" checked={selected.includes(r.id)} onChange={e=>setSelected(e.target.checked?[...selected,r.id]:selected.filter(id=>id!==r.id))}/></td><th><Source url={r.url}>{r.title}</Source></th><td>{r.meta.Seller||'Unavailable'}</td><td>{r.meta['Listed price']||'Unavailable'}<span className="hint">{r.meta.Currency}</span></td><td>{r.meta.Delivery||'Unavailable'}</td></tr>)}</tbody></table></div></>;
}
function HotelResults({run}:{run:ResearchRun}){
 const names=[...new Set(allRows(run).map(r=>r.title))];const [hotel,setHotel]=useState('All properties');
 return <><label className="research-select">Property filter<select value={hotel} onChange={e=>setHotel(e.target.value)}><option>All properties</option>{names.map(n=><option key={n}>{n}</option>)}</select></label><div className="rate-calendar">{run.batches.map((b,i)=>{const rows=b.rows.filter(r=>hotel==='All properties'||r.title===hotel);return <section key={i}><h3>Check-in {b.label}</h3><RangeSummary rows={rows}/><p>{rows.length} sampled properties · {rows.filter(r=>typeof r.meta.Amount!=='number').length} without a numeric rate.</p><details><summary>Inspect rates and amenities</summary>{rows.map(r=><article key={r.id}><Details row={r}/></article>)}</details></section>})}</div><p className="hint">Matching by returned property name is provisional; verify source identity before comparing a single property across dates.</p></>;
}
function FlightResults({run}:{run:ResearchRun}){
 const [direct,setDirect]=useState(false),[sort,setSort]=useState('Duration (minutes)');const rows=allRows(run).filter(r=>!direct||r.meta.Connections===0).sort((a,b)=>(typeof a.meta[sort]==='number'?a.meta[sort] as number:Infinity)-(typeof b.meta[sort]==='number'?b.meta[sort] as number:Infinity));
 return <><label className="checkbox"><input type="checkbox" checked={direct} onChange={e=>setDirect(e.target.checked)}/>Nonstop itineraries only</label><label className="research-select">Order flight options<select value={sort} onChange={e=>setSort(e.target.value)}><option value="Duration (minutes)">Shortest duration</option><option value="Amount">Lowest returned fare</option></select></label><div className="table-scroll"><table><thead><tr><th>Route / airline</th><th>Minutes</th><th>Connections</th><th>Returned fare</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><th>{r.title}<span className="hint">{r.detail} · {r.meta['Flight numbers']}</span></th><td>{r.meta['Duration (minutes)']??'Unavailable'}</td><td>{r.meta.Connections??'Unavailable'}</td><td>{r.meta.Amount??'Unavailable'} {r.meta.Currency}</td></tr>)}</tbody></table></div>{!rows.length&&<p>No matching itineraries.</p>}<Source url={run.batches[0]?.source_url}>Check current flight search</Source></>;
}
const annotationSchema=z.object({id:z.string(),title:z.string(),url:z.string().nullable(),image:z.string().nullable(),tag:z.string().max(80),notes:z.string().max(3000),saved:z.boolean()});
type Annotation=z.infer<typeof annotationSchema>;
function Annotate({row,initial,onSave,images,previews,fixture}:{row:ResearchRow;initial?:Annotation;onSave:(v:Annotation)=>boolean;images:boolean;previews:boolean;fixture:boolean}){
 const [tag,setTag]=useState(initial?.tag||''),[notes,setNotes]=useState(initial?.notes||''),[saved,setSaved]=useState(initial?.saved||false),[message,setMessage]=useState('');
 return <article>{images&&<div className="visual-preview">{fixture?<div className="sample-visual">Synthetic visual record<br/>No source photograph</div>:previews&&safeLink(row.image)?<img loading="lazy" referrerPolicy="no-referrer" src={row.image!} alt={row.title} onError={e=>{e.currentTarget.hidden=true}}/>:<p>Open the source or enable previews.</p>}</div>}<Details row={row}/><label className="checkbox"><input type="checkbox" checked={saved} onChange={e=>setSaved(e.target.checked)}/>{images?'Keep in visual shortlist':'Keep on research shelf'}</label><label>{images?'Your visual tag':'Applicability tag'}<input maxLength={80} value={tag} onChange={e=>setTag(e.target.value)} placeholder={images?'Interior, signage, menu…':'Relevant, conflicting, needs reading…'}/></label><label>Your observations<textarea rows={2} maxLength={3000} value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="secondary" onClick={()=>setMessage(onSave({id:row.id,title:row.title,url:row.url,image:row.image,tag,notes,saved})?'Saved locally':'Could not save; keep this tab open.')}>Save observations</button><p role="status">{message}</p></article>;
}
function AnnotatedResults({run,reportId}:{run:ResearchRun;reportId:string}){
 const records=useLocalRecords(`market-${run.tool}-shelf-v1:${reportId}`,annotationSchema);
 const [onlySaved,setOnlySaved]=useState(false),[previews,setPreviews]=useState(false);
 const current=allRows(run);const extra=records.items.filter(r=>r.saved&&!current.some(c=>c.id===r.id)).map(r=>({...r,detail:'Saved from an earlier search in this report.',meta:{},tags:[]} as ResearchRow));
 const rows=[...current,...extra].filter(r=>!onlySaved||records.items.find(v=>v.id===r.id)?.saved);
 return <><p>Shortlists, tags and observations save only in this browser for this report. Export a backup; shared report links exclude these notes.</p><div className="report-actions"><label className="checkbox"><input type="checkbox" checked={onlySaved} onChange={e=>setOnlySaved(e.target.checked)}/>Show saved items only</label><button className="secondary" disabled={!records.items.length} onClick={records.download}>Export shelf</button></div>{run.tool==='images'&&run.data_mode==='live'&&<label className="checkbox"><input type="checkbox" checked={previews} onChange={e=>setPreviews(e.target.checked)}/>Load previews from external image hosts</label>}<p role="status">{records.message}</p><div className={run.tool==='images'?'visual-grid':'research-evidence-list'}>{rows.map(r=><Annotate key={r.id} row={r} initial={records.items.find(a=>a.id===r.id)} images={run.tool==='images'} previews={previews} fixture={run.data_mode==='fixture'} onSave={value=>records.save([...records.items.filter(a=>a.id!==value.id),value])}/>)}</div>{!rows.length&&<p>No saved items yet. Turn off the filter and save observations.</p>}</>;
}
export function ResearchResults({run,reportId}:{run:ResearchRun;reportId:string}){
 if(run.tool==='images'||run.tool==='scholar')return <AnnotatedResults run={run} reportId={reportId}/>;
 if(!allRows(run).length)return <p className="empty">No usable results are stored for this run. Check the source status below or try another query.</p>;
 if(run.tool==='directions')return <RouteResults run={run}/>;
 if(run.tool==='forums'||run.tool==='jobs')return <FilteredEvidence run={run}/>;
 if(run.tool==='autocomplete')return <IntentResults run={run}/>;
 if(run.tool==='events')return <EventResults run={run}/>;
 if(run.tool==='shopping')return <ShoppingResults run={run}/>;
 if(run.tool==='hotels')return <HotelResults run={run}/>;
 if(run.tool==='flights')return <FlightResults run={run}/>;
 return <AnnotatedResults run={run} reportId={reportId}/>;
}
