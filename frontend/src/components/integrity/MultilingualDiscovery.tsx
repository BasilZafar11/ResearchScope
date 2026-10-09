import {parseStoredRecord} from '../../lib/projectRecords';
import {useResearchDraft} from '../../lib/researchDraft';
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {integrityApi} from '../../api/integrity';
import {useLocalRecords} from '../../lib/useLocalRecords';
import type {Evidence} from '../../types/novelty';
import {Field,Select,Notice,SourceLink,text,stamp,recordBase} from './Shared';

const languages=['Spanish','French','German','Portuguese','Chinese','Japanese','Hindi','Arabic','Other'] as const;
const work=z.object({doi:text,title:text,url:text,date:text,language:text,type:text,abstract:text,authors:z.array(text)});
const schema=z.object({...recordBase,originalQuery:text,language:text,translatedQuery:text,translationSource:text,translationReviewed:z.boolean(),checkedAt:text,coverage:text,items:z.array(work),selected:z.array(text),translations:z.record(z.string(),z.object({text:text,source:text,reviewed:z.boolean()}))});
export function selectedDiscoveryEvidence(id:string):Evidence[] {
  try {
    const rounds=z.array(schema).parse(parseStoredRecord('research-integrity-'+id+'-multilingual','[]'));
    const unique=new Map<string,Evidence>();
    for(const round of rounds)for(const item of round.items)if(round.selected.includes(item.doi))unique.set(item.doi,{id:'doi:'+item.doi.toLowerCase(),source_type:'scholar',title:item.title,source_url:item.url,summary_text:item.abstract,publication_date:item.date,authors:item.authors,similarity_score:0,details:{doi:item.doi,language:item.language||'unknown',provider:'Crossref',retrievedAt:round.checkedAt,query:round.translatedQuery,discoveryStatus:'researcher selected; not scored'}});
    return [...unique.values()];
  }catch{return [];}
}
export function MultilingualDiscovery({id,idea}:{id:string;idea:string}) {
  const localRecords=useLocalRecords('research-integrity-'+id+'-multilingual',schema);
  const records={...localRecords,save:(next:z.infer<typeof schema>[])=>{const success=localRecords.save(next);if(success)window.dispatchEvent(new Event('research-integrity-evidence-update'));return success;}};
  const [original,setOriginal]=useResearchDraft(id,'integrity-MultilingualDiscovery-original',idea),[language,setLanguage]=useResearchDraft(id,'integrity-MultilingualDiscovery-language','Spanish'),[translated,setTranslated]=useResearchDraft(id,'integrity-MultilingualDiscovery-translated',''),[translationSource,setTranslationSource]=useResearchDraft(id,'integrity-MultilingualDiscovery-translationSource',''),[reviewed,setReviewed]=useResearchDraft(id,'integrity-MultilingualDiscovery-reviewed',false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function search(){if(!original.trim()||translated.trim().length<3||!translationSource.trim()){setError('Enter the original query, translated query, and who or what supplied the translation.');return;}setBusy(true);setError('');const abort=new AbortController();controller.current=abort;
    try{const result=await integrityApi.discover(translated.trim(),AbortSignal.any([abort.signal,AbortSignal.timeout(30000)]));
      records.save([...records.items,{...stamp(),originalQuery:original,language,translatedQuery:translated,translationSource,translationReviewed:reviewed,checkedAt:result.checked_at,coverage:result.coverage,items:result.items,selected:[],translations:{}}]);
    }catch(e){setError(abort.signal.aborted?'Search cancelled.':e instanceof Error?e.message:'Discovery failed.');}finally{setBusy(false);controller.current=null;}}
  return <>
    <p>Search Crossref using a translated query and preserve the original wording. Results can include other languages; unknown language metadata stays unknown.</p>
    <Field label="Original research query" value={original} onChange={value=>{setOriginal(value);setReviewed(false);}}/>
    <Select label="Target language" value={language} options={languages} onChange={value=>{setLanguage(value);setTranslated('');setReviewed(false);}}/>
    <Field label="Translated search query" value={translated} onChange={value=>{setTranslated(value);setReviewed(false);}}/>
    <Field label="Translation source / translator" value={translationSource} onChange={setTranslationSource}/>
    <label className="integrity-check"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>A fluent reviewer checked this query</label>
    <div className="tool-link-row"><a href={'https://translate.google.com/?sl=auto&tl=auto&text='+encodeURIComponent(original)+'&op=translate'} target="_blank" rel="noreferrer">Open translation helper ↗</a><a href={'https://scholar.google.com/scholar?q='+encodeURIComponent(translated||original)} target="_blank" rel="noreferrer">Search Scholar ↗</a></div>
    <button className="quiet-button" disabled={busy} onClick={search}>{busy?'Searching…':'Retrieve multilingual candidates'}</button>{busy&&<button className="quiet-button" onClick={()=>controller.current?.abort()}>Cancel search</button>}<Notice message={error}/>
    {records.items.map(round=><article className="integrity-card" key={round.id}><h4>{round.language} · {round.translatedQuery}</h4><p>Original: {round.originalQuery} · Translation: {round.translationReviewed?'reviewer checked':'unverified'} ({round.translationSource})</p><small>{round.checkedAt} · {round.coverage}</small>
      {!round.items.length&&<p>No records returned for this query. Other indexes may contain relevant work.</p>}
      {round.items.map(item=>{const translation=round.translations[item.doi]||{text:'',source:'',reviewed:false};return <details className="integrity-subrecord" key={item.doi}><summary>{item.title||item.doi} · {item.language||'language unknown'}</summary><SourceLink url={item.url}>Original record</SourceLink><p>{item.date||'Date unknown'} · {item.authors.join(', ')}</p><blockquote>{item.abstract||'No abstract supplied'}</blockquote><label className="integrity-check"><input type="checkbox" checked={round.selected.includes(item.doi)} onChange={e=>records.save(records.items.map(x=>x.id===round.id?{...x,selected:e.target.checked?[...x.selected,item.doi]:x.selected.filter(doi=>doi!==item.doi)}:x))}/>Include in this discovery evidence collection</label>
        <Field label="Translation of relevant passage" area value={translation.text} onChange={value=>records.save(records.items.map(x=>x.id===round.id?{...x,translations:{...x.translations,[item.doi]:{...translation,text:value,reviewed:false}}}:x))}/><Field label="Passage translation source" value={translation.source} onChange={value=>records.save(records.items.map(x=>x.id===round.id?{...x,translations:{...x.translations,[item.doi]:{...translation,source:value,reviewed:false}}}:x))}/><label className="integrity-check"><input type="checkbox" disabled={!translation.text||!translation.source} checked={translation.reviewed} onChange={e=>records.save(records.items.map(x=>x.id===round.id?{...x,translations:{...x.translations,[item.doi]:{...translation,reviewed:e.target.checked}}}:x))}/>Fluent reviewer checked this passage translation</label>
      </details>;})}
      <p>{round.selected.length} selected sources</p><button className="quiet-button" onClick={()=>records.save(records.items.filter(x=>x.id!==round.id))}>Remove search round</button>
    </article>)}
    <button className="quiet-button" onClick={records.download}>Export queries, original text, and translations</button><p role="status">{records.message}</p>
    <small>Translation is supplied by the researcher or an external helper. No automatic translation service is connected.</small>
  </>;
}
