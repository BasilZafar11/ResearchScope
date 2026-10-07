import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {stress} from '../api/client';
import type {Report} from '../types/analysis';
export type StressResult={baseline:number;minimum:number;maximum:number;changed_interpretations:number;search_requests:number;scenarios:{id:string;name:string;kind:string;score:number;delta:number;interpretation:string;confidence:number;headline:string;note:string}[]};
export function OpportunityStress({report}:{report:Report}){
 const [enabled,setEnabled]=useState(false);
 const query=useQuery({queryKey:['stress',report.id],queryFn:()=>stress(report.id),enabled,staleTime:Infinity,retry:false});
 return <section className="report-section" id="opportunity-stress"><h2>Opportunity stress test</h2><p>Remove one competitor or source at a time and see whether the recommendation changes. Uses saved evidence, fixed weights and the original scoring date. No search credits.</p>
 <button className="secondary" disabled={query.isFetching} onClick={()=>{setEnabled(true);if(enabled)void query.refetch()}}>{query.isFetching?'Checking scenarios…':'Run stress test'}</button>
 {query.isError&&<p role="alert">{query.error.message}</p>}
 {query.data&&<><p className="notice">Original {query.data.baseline}/100 · scenario range {query.data.minimum}–{query.data.maximum} · {query.data.changed_interpretations} scenarios change the interpretation.</p><p>Scenarios are ordered by absolute score change. A narrow range means stability under these specific omissions; it does not establish market certainty.</p><div className="table-scroll"><table><thead><tr><th>Scenario</th><th>Score / change</th><th>Confidence</th><th>Recommendation</th></tr></thead><tbody>{query.data.scenarios.map(s=><tr key={s.id}><th scope="row">{s.name}<details><summary>Assumptions</summary>{s.note}</details></th><td>{s.score} / {s.delta>0?'+':''}{s.delta}</td><td>{s.confidence}/100</td><td>{s.interpretation}<span className="hint">{s.headline}</span></td></tr>)}</tbody></table></div></>}
 </section>;
}
