import {parseStoredRecord,writeStoredRecord} from '../lib/projectRecords';
import {useState} from 'react';
import type {Evidence} from '../types/novelty';

type ClaimState={decision:'unreviewed'|'supported'|'narrowed'|'withdrawn';evidenceIds:string[];field:string;from:string;through:string;sourceCoverage:string;revision:string;reason:string};
type SavedState={text:string;claims:Record<string,ClaimState>};
const phrases=/\b(?:first(?:\s+(?:study|work|paper|demonstration|system|method))?|novel|unique|unprecedented|never before|only(?:\s+(?:study|work|paper|demonstration))?|no prior work|state of the art)\b/giu;
const blankClaim=():ClaimState=>({decision:'unreviewed',evidenceIds:[],field:'',from:'',through:'',sourceCoverage:'',revision:'',reason:''});
function read(key:string,fallback:SavedState):SavedState{try{const parsed=parseStoredRecord(key,'null');if(!parsed||typeof parsed.text!=='string')return fallback;return {text:parsed.text,claims:parsed.claims||{}}}catch{return fallback}}
function save(key:string,value:SavedState){try{writeStoredRecord(key,JSON.stringify(value));return true}catch{return false}}
function sentenceFor(text:string,index:number,length:number){const start=Math.max(text.lastIndexOf('.',index),text.lastIndexOf('!',index),text.lastIndexOf('?',index),text.lastIndexOf('\n',index))+1;const ends=['.', '!', '?','\n'].map(token=>text.indexOf(token,index+length)).filter(end=>end>=0);const end=ends.length?Math.min(...ends):text.length;return text.slice(start,end).trim()}

export function NoveltyWordingChecker({reportId,initialText,evidence}:{reportId:string;initialText:string;evidence:Evidence[]}){
 const storageKey='novelty-defense-'+reportId+'-wording-check';
 const [state,setState]=useState(()=>read(storageKey,{text:initialText,claims:{}}));
 const [storageError,setStorageError]=useState(false);
 const matches=[...state.text.matchAll(phrases)].map((match,index)=>({phrase:match[0],index,key:match[0].toLocaleLowerCase()+':'+index,context:sentenceFor(state.text,match.index||0,match[0].length)}));
 const update=(next:SavedState)=>{setState(next);setStorageError(!save(storageKey,next))};
 const patchClaim=(key:string,patch:Partial<ClaimState>)=>{const current=state.claims[key]||blankClaim();update({...state,claims:{...state.claims,[key]:{...current,...patch}}})};
 const suggestion=(phrase:string)=>{
  const base='Based on a search bounded to [field], [date range], and [sources], this work appears to [specific contribution].';
  return /first|only|unique|unprecedented|never before|state of the art|novel/i.test(phrase)?base:'State the specific contribution and its scope; avoid priority wording without supporting evidence.';
 };
 return <>
  <p>Review each priority or exclusivity phrase in context. Link the evidence and search scope behind it, or narrow/remove the wording. A phrase can remain unresolved.</p>
  <label>Proposal text<textarea rows={7} maxLength={30000} value={state.text} onChange={event=>update({...state,text:event.target.value})}/></label>
  {!matches.length?<p className="empty-state">No priority phrases were detected. This does not review other forms of novelty claims; read the draft manually.</p>:<div className="novelty-claim-list">{matches.map(match=>{
   const claim=state.claims[match.key]||blankClaim();
   const before=state.text.slice(Math.max(0,(match.index||0)-60),match.index||0).toLocaleLowerCase();
   const isNegated=/(?:not|never|no|without)(?:\s+\w+){0,4}\s*$/.test(before);
   const isQuoted=match.context.includes('“')||match.context.includes('”')||match.context.includes('"');
   return <article className="novelty-claim" key={match.key}>
    <div className="novelty-claim-heading"><b>{match.phrase}</b><span>{isNegated?'Negated context; review manually':isQuoted?'Quoted context; verify it is attributed correctly':'Priority wording needs evidence'}</span></div>
    <blockquote>{match.context}</blockquote>
    <p>Suggested evidence standard: search a defined field and date range across stated source types; cite records that bound the claim. A search with no result is not proof that no prior work exists.</p>
    <label>Review decision<select value={claim.decision} onChange={event=>patchClaim(match.key,{decision:event.target.value as ClaimState['decision']})}><option value="unreviewed">Unreviewed</option><option value="supported">Supported within recorded search scope</option><option value="narrowed">Narrowed to a specific scope</option><option value="withdrawn">Withdrawn</option></select></label>
    <div className="tool-input-grid"><label>Research field<input value={claim.field} onChange={event=>patchClaim(match.key,{field:event.target.value})} placeholder="e.g. medical image segmentation"/></label><label>Search from<input type="date" value={claim.from} onChange={event=>patchClaim(match.key,{from:event.target.value})}/></label><label>Search through<input type="date" value={claim.through} onChange={event=>patchClaim(match.key,{through:event.target.value})}/></label><label>Sources searched<input value={claim.sourceCoverage} onChange={event=>patchClaim(match.key,{sourceCoverage:event.target.value})} placeholder="Databases, repositories, languages"/></label></div>
    <p className="claim-evidence-label">Supporting records from this report</p>
    <div className="novelty-evidence-options">{evidence.map(item=><div key={item.id}><label><input type="checkbox" checked={claim.evidenceIds.includes(item.id)} onChange={event=>patchClaim(match.key,{evidenceIds:event.target.checked?[...new Set([...claim.evidenceIds,item.id])]:claim.evidenceIds.filter(id=>id!==item.id)})}/><span>{item.title}</span></label>{item.source_url&&<a href={item.source_url} target="_blank" rel="noreferrer">Open ↗</a>}</div>)}</div>
    <label>Scoped rewrite<textarea rows={2} maxLength={1500} value={claim.revision} onChange={event=>patchClaim(match.key,{revision:event.target.value})} placeholder={suggestion(match.phrase)}/></label>
    <label>Reason or reviewer note<input value={claim.reason} maxLength={800} onChange={event=>patchClaim(match.key,{reason:event.target.value})} placeholder="What evidence supports this decision?"/></label>
    {claim.decision==='supported'&&(!claim.field||!claim.from||!claim.through||!claim.sourceCoverage||claim.evidenceIds.length===0)&&<p className="warning-line">This claim is marked supported, but its field, date range, source coverage, or citations are incomplete.</p>}
   </article>;
  })}</div>}
  {storageError&&<p className="warning-line" role="alert">The wording review could not be saved in this browser. Check available browser storage.</p>}
  <small>Phrase detection is heuristic. The user’s review status does not independently validate the claim.</small>
 </>;
}
