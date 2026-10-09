import {parseStoredRecord,writeStoredRecord} from '../lib/projectRecords';
import {useEffect,useState} from 'react';
type RatingKey='importance'|'feasibility'|'overlap'|'evidence';
type Rating={value:number;reason:string};
type Choice='proceed to a scoped pilot'|'revise the scope'|'pause investment';
type Decision={id:string;createdAt:string;choice:Choice;rationale:string;assumptions:string;blockers:string;changeEvidence:string;revisitDate:string;reviewers:string;ratings:Record<RatingKey,Rating>;snapshot:string};
type Draft=Omit<Decision,'id'|'createdAt'|'snapshot'>;
const blankRatings=():Record<RatingKey,Rating>=>({importance:{value:3,reason:''},feasibility:{value:3,reason:''},overlap:{value:3,reason:''},evidence:{value:3,reason:''}});
const blank=():Draft=>({choice:'revise the scope',rationale:'',assumptions:'',blockers:'',changeEvidence:'',revisitDate:'',reviewers:'',ratings:blankRatings()});
function readValue(key:string):any{try{return parseStoredRecord(key,'null')}catch{return null}}
function readHistory(key:string):Decision[]{try{const value=parseStoredRecord(key,'[]');return Array.isArray(value)?value:[]}catch{return []}}
const readiness=(status:string,title:string,detail:string)=>({status,title,detail});
const weight:Record<RatingKey,number>={importance:25,feasibility:25,overlap:25,evidence:25};
const keyNames:RatingKey[]=['importance','feasibility','overlap','evidence'];
function download(record:Decision){const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='research-decision-'+record.createdAt.slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function ProceedDecisionGate({reportId}:{reportId:string}){
 const historyKey='novelty-defense-'+reportId+'-decision-history';const draftKey='novelty-defense-'+reportId+'-decision-draft';
 const savedDraft=readValue(draftKey);const [draft,setDraft]=useState<Draft>(()=>savedDraft?{...blank(),...savedDraft,ratings:{...blankRatings(),...savedDraft.ratings}}:blank());const [history,setHistory]=useState(()=>readHistory(historyKey));const [storageError,setStorageError]=useState(false);
 const [,refreshAssessments]=useState(0);
 useEffect(()=>{const refresh=()=>refreshAssessments(value=>value+1);window.addEventListener('research-defense-refresh',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('research-defense-refresh',refresh);window.removeEventListener('storage',refresh)}},[]);
 const combo=readValue('novelty-defense-'+reportId+'-combination-audit');
 const importance=readValue('novelty-defense-'+reportId+'-contribution-importance');
 const fairness=readValue('novelty-defense-'+reportId+'-baseline-fairness');
 const confounder=readValue('novelty-defense-'+reportId+'-confounder-review');
 const plan=readValue('novelty-defense-'+reportId+'-study-plan');
 const measurements=readValue('novelty-defense-'+reportId+'-measurements')||{};
 const taskList=readValue('novelty-defense-'+reportId+'-tasks')||[];
 const alternatives=readValue('novelty-defense-'+reportId+'-newer-baselines');
 const comboComponents=combo?.components?.split('\n').map((value:string)=>value.trim()).filter(Boolean)||[];
 const confirmedCombos=Object.entries(combo?.combinationReviews||{}).filter(([sourceId,review]:[string,any])=>review?.confirmed&&review.excerpt?.trim()&&comboComponents.length>0&&comboComponents.every((component:string)=>{const item=combo.componentReviews?.[sourceId+':'+component.toLocaleLowerCase()];return item?.state==='supports component'&&item.excerpt?.trim()})).length;
 const importanceComplete=Boolean(importance?.limitation&&importance?.beneficiaries&&importance?.decision&&importance?.target&&importance?.baseline&&importance?.evidence);
 const importanceScore=importance?.ratings?Math.round((importance.ratings.benefit*0.35+importance.ratings.reach*0.2+importance.ratings.urgency*0.2+importance.ratings.tractability*0.25)*20):null;
 const fairnessFieldsComplete=fairness&&['dataset','split','preprocessing','compute','tuning','metric','protocol','version'].every(field=>fairness.proposed?.[field]?.trim()&&fairness.baseline?.[field]?.trim());
 const fairnessMethods=Boolean(fairness?.proposed?.name&&fairness?.baseline?.name&&fairnessFieldsComplete);
 const fairnessMissing=fairness?Object.entries(fairness.assessments||{}).filter(([,item]:[string,any])=>!item?.verdict||item.verdict==='unreviewed'||!item.evidence?.trim()||(item.verdict==='justified difference'&&!item.reason?.trim())).length:8;
 const riskConditions:Record<string,string>={selection:'assignment',dataset:'dataset',preprocessing:'preprocessing',compute:'compute',tuning:'tuning',measurement:'measurement','site-time':'siteTime',missingness:'missingness',outcome:'outcomeRegistered',attrition:'attrition'};
 const activeRiskIds=Object.entries(riskConditions).filter(([id,field])=>id==='selection'?confounder?.conditions?.[field]!=='randomized':id==='outcome'?confounder?.conditions?.[field]!=='yes':confounder?.conditions?.[field]!=='same').map(([id])=>id);
 const unresolvedRisks=activeRiskIds.filter(id=>{const risk=confounder?.risks?.[id];return !risk||!['controlled','ruled out'].includes(risk.status)||!risk.control?.trim()}).length;
 const selectedExperiments=Object.values(measurements).flatMap((value:any)=>Array.isArray(value)?value:[value]).filter((item:any)=>item&&typeof item==='object');
 const reviewedExperiments=selectedExperiments.filter((item:any)=>item.reviewed&&item.name&&item.comparator&&item.metric&&item.threshold).length;
 const taskBlockers=Array.isArray(taskList)?taskList.filter((task:any)=>task.status==='blocked').length:0;
 const incompleteTasks=Array.isArray(taskList)?taskList.filter((task:any)=>task.status!=='done').length:0;
 const essentialHours=(plan?.tasks||[]).filter((task:any)=>task.required).reduce((sum:number,task:any)=>sum+Number(task.hours||0),0);
 const availableHours=Number(plan?.weeks||0)*Number(plan?.hoursPerWeek||0);
 const feasibilityBlockers=[plan?.dataAccess==='blocked'?'Data access is blocked.':null,availableHours>0&&essentialHours>availableHours?'Essential study work exceeds available hours.':null,plan?.budget>0&&(plan?.tasks||[]).reduce((sum:number,task:any)=>sum+Number(task.cost||0),0)>plan.budget?'Planned study costs exceed budget.':null].filter(Boolean);
 const pendingAlternatives=Object.values(alternatives?.reviews||{}).filter((review:any)=>review.status==='unreviewed').length;
 const statusRows=[
  readiness(confirmedCombos?'reviewed':'unknown','Combination overlap',confirmedCombos?confirmedCombos+' source(s) confirmed as covering the complete combination with passages.':'No fully user-confirmed complete-combination source; review coverage and search limits.'),
  readiness(importanceComplete?'reviewed':'incomplete','Contribution importance',importanceComplete?'Brief complete · provisional score '+importanceScore+'/100.':'Beneficiary, limitation, target, or baseline rationale is incomplete.'),
  readiness(fairnessMethods&&fairnessMissing===0?'reviewed':'incomplete','Baseline fairness',fairnessMethods?fairnessMissing===0?'All recorded conditions have evidence.':'Comparison has '+fairnessMissing+' condition(s) missing review or evidence.':'Proposed method and baseline have not both been recorded.'),
  readiness(reviewedExperiments>0?'reviewed':'incomplete','Claim-to-measurement',reviewedExperiments?reviewedExperiments+' reviewed experiment plan(s) with success thresholds.':'No reviewed experiment plan with a comparator, metric, and threshold.'),
  readiness(unresolvedRisks===0&&confounder?'reviewed':'open','Confounders',confounder?(unresolvedRisks?unresolvedRisks+' active or unreviewed risk(s).':'All recorded study-specific prompts have a disposition and note.'):'Study conditions have not been reviewed.'),
  readiness(feasibilityBlockers.length?'blocked':plan?.claimId&&plan?.tasks?.length?'reviewed':'incomplete','Feasibility',feasibilityBlockers.join(' ')|| (plan?.claimId&&plan?.tasks?.length?'Plan covers '+essentialHours+' essential hours of '+availableHours+' available.':'No scoped study plan is saved.')),
  readiness(taskBlockers?'blocked':!taskList.length?'incomplete':incompleteTasks?'open':'reviewed','Team tasks',taskList.length?taskBlockers+' blocked · '+incompleteTasks+' unfinished task(s).':'No verification tasks are tracked.'),
  readiness(!alternatives?.baselineId?'incomplete':pendingAlternatives?'open':'reviewed', 'Newer baseline candidates',!alternatives?.baselineId?'No baseline was selected for the recency review.':pendingAlternatives?pendingAlternatives+' newer paper candidate(s) still unreviewed.':'No unreviewed newer-baseline candidates are recorded.')
 ];
 const allState={combo,importance,fairness,confounder,plan,measurements,taskList,alternatives};
 const fingerprint=JSON.stringify(allState);
 const readinessIncomplete=statusRows.some(row=>row.status==='incomplete'||row.status==='unknown'||row.status==='open');
 const critical=feasibilityBlockers.length>0||taskBlockers>0;
 const score=Math.round(keyNames.reduce((sum,key)=>sum+draft.ratings[key].value*weight[key],0)/5);
 const suggested=critical?'Pause until feasibility blockers are resolved':readinessIncomplete?'Revise the plan and complete the missing reviews':score>=70?'Proceed to a scoped pilot for review':'Revise the scope or gather stronger evidence';
 const persistDraft=(next:Draft)=>{setDraft(next);try{writeStoredRecord(draftKey,JSON.stringify(next));setStorageError(false)}catch{setStorageError(true)}};
 const saveDecision=()=>{if(!draft.rationale.trim()){setStorageError(false);return}const entry:Decision={...draft,id:crypto.randomUUID(),createdAt:new Date().toISOString(),snapshot:fingerprint};const next=[entry,...history].slice(0,50);setHistory(next);try{writeStoredRecord(historyKey,JSON.stringify(next));setStorageError(false)}catch{setStorageError(true)}};
 const currentFingerprint=fingerprint;
 return <>
  <p>This gate assembles the saved reviews, feasibility blockers, and team tasks. Ratings and the suggestion are prompts for a decision meeting; the researcher records the actual decision and why.</p>
  <div className="decision-readiness">{statusRows.map(row=><article key={row.title}><header><b>{row.title}</b><span className={'decision-status '+row.status}>{row.status}</span></header><p>{row.detail}</p></article>)}</div>
  <div className="decision-hard-blockers">{feasibilityBlockers.map((blocker,index)=><p className="warning-line" key={index}>{blocker}</p>)}</div>
  <div className="decision-ratings">{keyNames.map(key=><label key={key}>{key} · 1 low to 5 high<input type="range" min={1} max={5} value={draft.ratings[key].value} onChange={event=>persistDraft({...draft,ratings:{...draft.ratings,[key]:{...draft.ratings[key],value:Number(event.target.value)}}})}/><b>{draft.ratings[key].value}/5</b><textarea aria-label={`${key} rating evidence or rationale`} rows={2} value={draft.ratings[key].reason} onChange={event=>persistDraft({...draft,ratings:{...draft.ratings,[key]:{...draft.ratings[key],reason:event.target.value}}})} placeholder="Evidence or rationale for this rating"/></label>)}</div>
  <div className="tool-result"><b>Checklist score: {score}/100 · Suggested discussion: {suggested}</b><p>Score formula: mean of importance, feasibility, inverse overlap (6 − overlap), and evidence confidence, each rated 1–5 and weighted equally. A critical feasibility blocker takes priority in the suggestion. This score does not make the decision.</p><small>Confirmed prior work is shown for review; it is not automatically treated as a stop condition. Record what contribution still differs.</small></div>
  <div className="decision-record-fields"><label>Decision<select value={draft.choice} onChange={event=>persistDraft({...draft,choice:event.target.value as Choice})}><option>proceed to a scoped pilot</option><option>revise the scope</option><option>pause investment</option></select></label><label>Decision rationale<textarea rows={3} value={draft.rationale} onChange={event=>persistDraft({...draft,rationale:event.target.value})} placeholder="Why does the team choose this path? Include evidence and tradeoffs."/></label><label>Key assumptions<textarea rows={2} value={draft.assumptions} onChange={event=>persistDraft({...draft,assumptions:event.target.value})}/></label><label>Unresolved blockers<textarea rows={2} value={draft.blockers} onChange={event=>persistDraft({...draft,blockers:event.target.value})}/></label><label>What new evidence would change this decision?<textarea rows={2} value={draft.changeEvidence} onChange={event=>persistDraft({...draft,changeEvidence:event.target.value})}/></label><div className="tool-input-grid"><label>Reviewers or attendees<input value={draft.reviewers} onChange={event=>persistDraft({...draft,reviewers:event.target.value})} placeholder="Names are self-entered"/></label><label>Revisit date<input type="date" value={draft.revisitDate} onChange={event=>persistDraft({...draft,revisitDate:event.target.value})}/></label></div><button type="button" className="quiet-button" disabled={!draft.rationale.trim()} onClick={saveDecision}>Save dated decision record</button></div>
  <div className="decision-history"><h4>Decision history</h4>{history.map(record=><article key={record.id}><header><b>{record.choice}</b><small>{new Date(record.createdAt).toLocaleString()} · revisit {record.revisitDate||'not set'}</small></header>{record.snapshot!==currentFingerprint&&<p className="warning-line">Linked assessments changed since this decision. Review the decision again.</p>}<p>{record.rationale}</p>{record.assumptions&&<small>Assumptions: {record.assumptions}</small>}{record.blockers&&<p>Blockers: {record.blockers}</p>}{record.changeEvidence&&<p>Reconsider if: {record.changeEvidence}</p>}<button type="button" className="quiet-button" onClick={()=>download(record)}>Export decision JSON</button></article>)}</div>
  {storageError&&<p className="warning-line" role="alert">Decision record could not be saved in this browser.</p>}
  <small>All linked assessments and decision records are local to this browser. The gate does not replace supervision or expert review.</small>
 </>;
}
