import {defaultOptions,optionLabels,searchEstimate,type SearchOptions} from '../lib/marketTools';
import type {SearchUsage} from '../types/analysis';
import '../styles/research.css';

export function SearchPlanner({options=defaultOptions,onChange}:{options:SearchOptions;onChange:(value:SearchOptions)=>void}){
 const estimate=searchEstimate(options);
 return <fieldset className="search-planner"><legend>Search-credit planner</legend><p>Core research: competitor discovery, recent reviews, one-year demand, and news (3–6 searches).</p>
 {Object.entries(optionLabels).map(([key,label])=><label className="checkbox" key={key}><input type="checkbox" checked={options[key as keyof SearchOptions]} onChange={e=>onChange({...options,[key]:e.target.checked})}/>{label} <span className="hint">{key==='keywords'||key==='seasonality'?'+1':'+0–3'} searches</span></label>)}
 <p aria-live="polite"><strong>{estimate.minimum}–{estimate.maximum} estimated searches</strong> for a completed, uncached analysis. At most {estimate.retryMaximum} provider attempts with all retries.</p><p className="hint">Actual requests depend on results, available hours, review pagination, and failures. A saved report uses no new searches. Requests are not confirmed billable credits. Longer research can exceed 90 seconds.</p></fieldset>;
}
export function SearchUsagePanel({usage}:{usage?:SearchUsage}){
 return <section className="report-section" id="search-usage"><h2>Search usage</h2>{!usage?<p>Request accounting is unavailable for this older report.</p>:<><p><strong>{usage.total_requests} {usage.mode==='fixture'?'fixture requests':'logical searches'}</strong> · {usage.total_provider_attempts} actual provider attempts, including retries.</p><p>{usage.billing_note}</p>{usage.mode==='fixture'&&<p className="notice">Synthetic fixture mode: no live SerpApi requests were sent.</p>}<div className="table-scroll"><table><thead><tr><th>Engine</th><th>Search requests</th><th>Provider attempts</th></tr></thead><tbody>{Object.entries(usage.logical_requests).map(([engine,count])=><tr key={engine}><td>{engine}</td><td>{count}</td><td>{usage.provider_attempts[engine]||0}</td></tr>)}</tbody></table></div></>}</section>;
}
