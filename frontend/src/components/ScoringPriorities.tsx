import {useState} from 'react';
import type {Report,ScoreKey} from '../types/analysis';

export const scoreLabels:Record<ScoreKey,string>={demand:'Demand',competition_gap:'Competition gap',unmet_need:'Unmet need',market_momentum:'Market momentum',advertising_gap:'Advertising gap'};
export const scoreKeys=Object.keys(scoreLabels) as ScoreKey[];
export function weightedScore(scores:Record<ScoreKey,number>,weights:Record<ScoreKey,number>){
 const total=scoreKeys.reduce((sum,key)=>sum+weights[key],0);
 return total>0?Math.round(scoreKeys.reduce((sum,key)=>sum+scores[key]*weights[key],0)/total):null;
}
export function ScoringPriorities({report}:{report:Report}){
 const defaults=Object.fromEntries(scoreKeys.map(key=>[key,Math.round(report.methodology.weights[key]*100)])) as Record<ScoreKey,number>;
 const [weights,setWeights]=useState(defaults);
 const total=scoreKeys.reduce((sum,key)=>sum+weights[key],0);
 const adjusted=weightedScore(report.component_scores,weights);
 return <section className="report-section" aria-labelledby="priorities-title">
  <div className="section-heading"><h2 id="priorities-title">Adjust scoring priorities</h2><button className="secondary" onClick={()=>setWeights(defaults)}>Reset weights</button></div>
  <p>Explore how your priorities affect this report. Sliders are relative priorities; effective weights below always total 100% before rounding.</p>
  <div className="priorities-grid"><div>{scoreKeys.map(key=><label className="priority-control" key={key}><span>{scoreLabels[key]} <span className="muted">{weights[key]} priority points · {total?(weights[key]/total*100).toFixed(1):'0'}% effective weight</span></span><input aria-label={`${scoreLabels[key]} priority`} type="range" min="0" max="100" step="1" value={weights[key]} onChange={e=>setWeights({...weights,[key]:Number(e.target.value)})}/></label>)}</div>
  <div className="priority-results" aria-live="polite"><div><span>Original opportunity score</span><strong>{report.overall_score}<small>/100</small></strong></div><div><span>Custom opportunity score</span><strong>{adjusted??'—'}<small>{adjusted===null?'':'/100'}</small></strong></div>{adjusted===null?<p role="alert">Set at least one priority above zero to calculate a custom score.</p>:<p>{adjusted-report.overall_score>0?'+':''}{adjusted-report.overall_score} points from the original.</p>}</div></div>
  <p className="hint">Custom score = sum(component score × priority) ÷ total priorities, rounded to the nearest integer. Missing sources retain their neutral scores. Confidence, recommendations, and the saved report stay unchanged. These temporary adjustments reset when you leave this report and are not included in its shared URL.</p>
 </section>;
}
