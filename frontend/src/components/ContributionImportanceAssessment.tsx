import {parseStoredRecord,writeStoredRecord} from '../lib/projectRecords';
import {useState} from 'react';
type Values={limitation:string;beneficiaries:string;decision:string;expectedBenefit:string;target:string;baseline:string;evidence:string;assumptions:string;ratings:{benefit:number;reach:number;urgency:number;tractability:number}};
const blank=():Values=>({limitation:'',beneficiaries:'',decision:'',expectedBenefit:'',target:'',baseline:'',evidence:'',assumptions:'',ratings:{benefit:3,reach:3,urgency:3,tractability:3}});
function read(key:string):Values{try{const value=parseStoredRecord(key,'null');return value?{...blank(),...value,ratings:{...blank().ratings,...value.ratings}}:blank()}catch{return blank()}}
const criteria:[keyof Values['ratings'],string,number][]=[['benefit','Potential benefit if the claim holds',35],['reach','People or decisions reached',20],['urgency','Cost of leaving the limitation unsolved',20],['tractability','Can the team test the proposed contribution?',25]];
export function ContributionImportanceAssessment({reportId}:{reportId:string}){
 const key='novelty-defense-'+reportId+'-contribution-importance';const [value,setValue]=useState(()=>read(key));const [storageError,setStorageError]=useState(false);
 const persist=(next:Values)=>{setValue(next);try{writeStoredRecord(key,JSON.stringify(next));setStorageError(false)}catch{setStorageError(true)}};
 const score=Math.round(criteria.reduce((sum,[key,,weight])=>sum+value.ratings[key]*weight,0)/5);
 const required=['limitation','beneficiaries','decision','expectedBenefit','target','baseline'] as const;const missing=required.filter(field=>!value[field].trim());
 return <>
  <p>Assess the value of the proposed difference. This score is a discussion aid based on your ratings, not a measure of novelty or proof that the work will deliver the benefit.</p>
  <div className="importance-brief">{([['limitation','Which specific limitation in current work will you address?'],['beneficiaries','Who will benefit, and in what setting?'],['decision','What decision or outcome can they improve?'],['expectedBenefit','What change do you expect if the research succeeds?'],['target','What observable target would count as useful?'],['baseline','What is the current baseline or status quo?'],['evidence','What evidence supports the need and expected benefit?'],['assumptions','What assumptions or potential harms could weaken the case?']] as const).map(([field,label])=><label key={field}>{label}<textarea rows={field==='limitation'||field==='assumptions'?3:2} value={value[field]} onChange={event=>persist({...value,[field]:event.target.value})} maxLength={3000}/></label>)}</div>
  <div className="importance-ratings">{criteria.map(([field,label,weight])=><label key={field}>{label} · weight {weight}%<input type="range" min={1} max={5} value={value.ratings[field]} onChange={event=>persist({...value,ratings:{...value.ratings,[field]:Number(event.target.value)}})}/><span>{value.ratings[field]}/5</span></label>)}</div>
  <div className="tool-result"><b>Provisional importance score: {score}/100</b><p>Recorded criteria weights: benefit 35%, reach 20%, urgency 20%, tractability 25%. Edit ratings and rationale before discussing the result.</p>{missing.length>0&&<small>Brief incomplete: add {missing.join(', ')}.</small>}</div>
  {storageError&&<p className="warning-line" role="alert">The importance assessment could not be saved in this browser.</p>}
 </>;
}
