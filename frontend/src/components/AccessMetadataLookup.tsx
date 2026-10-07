import {useState} from 'react';
import {z} from 'zod';
import {SourceLink,useDraft} from './integrity/Shared';

const candidate=z.object({url:z.string(),provider:z.string(),format:z.string(),version:z.string(),license:z.string(),availability:z.string()});
type Candidate=z.infer<typeof candidate>;
const resultSchema=z.object({doi:z.string(),work:z.object({title:z.string()}).nullable(),candidates:z.array(candidate),failures:z.array(z.string()),checked_at:z.string(),coverage:z.string()});
export function AccessMetadataLookup({id,paperId,doi,onCandidate}:{id:string;paperId:string;doi:string;onCandidate:(value:Candidate)=>void}){
  const saved=useDraft<z.infer<typeof resultSchema>|null>('research-integrity-'+id+'-access-'+paperId.replace(/[^a-z0-9-]/gi,'').slice(0,40),resultSchema.nullable(),null);
  const [identifier,setIdentifier]=useState(doi),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function lookup(){setBusy(true);setError('');try{const base=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');const response=await fetch(base+'/api/research-integrity/access?doi='+encodeURIComponent(identifier),{signal:AbortSignal.timeout(30000)});const value=await response.json();if(!response.ok)throw new Error(value.error?.message||'Access lookup failed.');saved.save(resultSchema.parse(value));}catch(e){setError(e instanceof Error?e.message:'Access lookup failed.');}finally{setBusy(false);}}
  return <div className="integrity-card"><h4>Locate source-attributed full-text candidates</h4><label>Paper DOI<input value={identifier} onChange={e=>setIdentifier(e.target.value)}/></label><button className="quiet-button" disabled={busy||!identifier.trim()} onClick={lookup}>{busy?'Checking metadata…':'Look up access metadata'}</button>
    {saved.value&&<><p>{saved.value.work?.title||'Crossref title unavailable'} · {saved.value.doi} · {saved.value.checked_at}</p>{saved.value.failures.map(x=><p className="warning-line" key={x}>{x}</p>)}{!saved.value.candidates.length&&<p>No matching access candidates returned. This is not proof that no repository copy exists.</p>}{saved.value.candidates.map(item=><article key={item.url}><SourceLink url={item.url}>{item.provider} · {item.format}</SourceLink><p>{item.availability} · {item.version} · License: {item.license}</p><button className="quiet-button" onClick={()=>onCandidate(item)}>Record this candidate for review</button></article>)}<small>{saved.value.coverage}</small></>}
    {(error||saved.error)&&<p role="alert" className="error">{error||saved.error}</p>}
  </div>;
}
