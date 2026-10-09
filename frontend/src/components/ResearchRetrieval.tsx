import {parseStoredRecord} from '../lib/projectRecords';
import {useResearchDraft} from '../lib/researchDraft';
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import type {Evidence} from '../types/novelty';
import {useLocalRecords} from '../lib/useLocalRecords';
import {SourceLink} from './integrity/Shared';

const work=z.object({doi:z.string(),title:z.string(),url:z.string(),date:z.string(),language:z.string(),type:z.string(),abstract:z.string(),authors:z.array(z.string()),relations:z.record(z.string(),z.unknown()).optional(),links:z.array(z.record(z.string(),z.unknown())).optional(),licenses:z.array(z.record(z.string(),z.unknown())).optional()});
const schema=z.object({id:z.string(),query:z.string(),intent:z.string(),sourceType:z.string(),afterYear:z.string(),at:z.string(),items:z.array(work),selected:z.array(z.string()),coverage:z.string()});
export function retrievedEvidence(id:string):Evidence[]{try{const rounds=z.array(schema).parse(parseStoredRecord('research-integrity-'+id+'-retrieval','[]'));const sources=new Map<string,Evidence>();for(const round of rounds)for(const item of round.items)if(round.selected.includes(item.doi))sources.set(item.doi.toLowerCase(),{id:'doi:'+item.doi.toLowerCase(),source_type:'scholar',title:item.title,summary_text:item.abstract,source_url:item.url,publication_date:item.date,authors:item.authors,similarity_score:0,details:{doi:item.doi,sourceType:item.type,provider:'Crossref',retrievedAt:round.at,query:round.query,relations:item.relations,fullTextLinks:item.links,licenses:item.licenses,review:'selected by researcher; not scored'}});return [...sources.values()];}catch{return [];}}
export function ResearchRetrieval({id,idea}:{id:string;idea:string}){
  const local=useLocalRecords('research-integrity-'+id+'-retrieval',schema);
  const records={...local,save:(next:z.infer<typeof schema>[])=>{const success=local.save(next);if(success)window.dispatchEvent(new Event('research-evidence-updated'));return success;}};
  const [intent,setIntent]=useResearchDraft(id,'retrieval-intent','combination overlap'),[query,setQuery]=useResearchDraft(id,'retrieval-query',idea),[sourceType,setSourceType]=useResearchDraft(id,'retrieval-sourceType','all'),[afterYear,setAfterYear]=useResearchDraft(id,'retrieval-afterYear',''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const abort=useRef<AbortController|null>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  async function search(){setBusy(true);setError('');const controller=new AbortController();abort.current=controller;try{
    if(query.trim().length<3||query.length>400)throw new Error('Enter a query between 3 and 400 characters.');
    if(afterYear&&(!/^\d{4}$/.test(afterYear)||Number(afterYear)<1800||Number(afterYear)>2099))throw new Error('Enter a year from 1800 through 2099.');
    const params=new URLSearchParams({query:query.trim(),source_type:sourceType});if(afterYear)params.set('after_year',afterYear);
    const base=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
    const response=await fetch(base+'/api/research-integrity/discovery?'+params,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])});
    const value=await response.json();if(!response.ok)throw new Error(value.error?.message||'Research retrieval failed.');
    const items=z.array(work).parse(value.items);
    records.save([...records.items,{id:crypto.randomUUID(),query,intent,sourceType,afterYear,at:value.checked_at,coverage:value.coverage,items,selected:[]}]);
  }catch(e){setError(controller.signal.aborted?'Search cancelled.':e instanceof Error?e.message:'Search failed.');}finally{setBusy(false);abort.current=null;}}
  function suggest(value:string){setIntent(value);setQuery(value==='benchmark disclosures'?idea+' training data model card benchmark contamination':value==='newer baseline'?idea+' benchmark comparison':idea);}
  return <section className="report-section"><h2>Retrieve additional research evidence</h2><p>Run a focused Crossref search for combinations, newer methods, disclosures, or overlooked publication types. Selected records become available throughout the research tools, with their retrieval provenance. They do not change the original report score.</p>
    <div className="tool-input-grid"><label>Research purpose<select value={intent} onChange={e=>suggest(e.target.value)}>{['combination overlap','newer baseline','benchmark disclosures','hidden prior work'].map(x=><option key={x}>{x}</option>)}</select></label><label>Source type<select value={sourceType} onChange={e=>setSourceType(e.target.value)}>{['all','journal-article','dissertation','posted-content','report','standard'].map(x=><option key={x}>{x}</option>)}</select></label><label>Published after year<input type="number" min={1800} max={2099} value={afterYear} onChange={e=>setAfterYear(e.target.value)}/></label></div>
    <label>Focused query<input maxLength={400} value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="quiet-button" disabled={busy} onClick={search}>{busy?'Retrieving…':'Retrieve candidates'}</button>{busy&&<button className="quiet-button" onClick={()=>abort.current?.abort()}>Cancel retrieval</button>}
    {error&&<p role="alert" className="error">{error}</p>}
    {records.items.map(round=><details className="tool-panel" key={round.id}><summary>{round.intent} · {round.query} · {round.items.length} records</summary><p>{round.at} · {round.sourceType} · {round.coverage}</p>{round.items.map(item=><article className="integrity-card" key={item.doi}><h4><SourceLink url={item.url}>{item.title}</SourceLink></h4><p>{item.date||'Date unknown'} · {item.type} · {item.authors.join(', ')}</p><blockquote>{item.abstract||'No abstract returned'}</blockquote><label><input type="checkbox" checked={round.selected.includes(item.doi)} onChange={e=>records.save(records.items.map(x=>x.id===round.id?{...x,selected:e.target.checked?[...x.selected,item.doi]:x.selected.filter(doi=>doi!==item.doi)}:x))}/>Add to the research evidence collection</label></article>)}<button className="quiet-button" onClick={()=>records.save(records.items.filter(x=>x.id!==round.id))}>Remove retrieval round</button></details>)}
    <button className="quiet-button" onClick={records.download}>Export retrieval provenance</button><p role="status">{records.message}</p><small>Crossref does not comprehensively index theses, posters, standards, or model cards. Failed providers differ from empty results. Selected candidate metadata still needs original-source review.</small>
  </section>;
}
