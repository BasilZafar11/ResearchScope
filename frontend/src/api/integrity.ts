export type CrossrefWork = {doi:string;title:string;url:string;date:string;language:string;type:string;abstract:string;authors:string[]};
export type PublicationCheck = {work:CrossrefWork;notices:{doi:string;title:string;url:string;date:string;kind:string;provenance:string}[];checked_at:string;truncated:boolean;coverage:string};
export type Discovery = {query:string;provider:string;checked_at:string;items:CrossrefWork[];coverage:string};
const base=(import.meta.env.VITE_API_URL||'').replace(/\/$/, '');
async function get<T>(path:string, signal?:AbortSignal):Promise<T> {
  const response=await fetch(base+'/api/research-integrity/'+path, {signal: signal || AbortSignal.timeout(30000)});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error?.message || (typeof data.detail==='string'?data.detail:'Metadata lookup failed.'));
  return data;
}
export const integrityApi={
  updates:(doi:string)=>get<PublicationCheck>('publication-updates?doi='+encodeURIComponent(doi)),
  discover:(query:string,signal?:AbortSignal)=>get<Discovery>('discovery?query='+encodeURIComponent(query),signal),
};
