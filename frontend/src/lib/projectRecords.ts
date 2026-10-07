export type ProjectRecords=Record<string,unknown>;
const groups=['defense','integrity','tools'] as const;
function prefix(id:string,group:string){return group==='defense'?`novelty-defense-${id}-`:group==='integrity'?`research-integrity-${id}-`:`novelty-tools-${id}-`;}
export function collectProjectRecords(id:string,includeNotebook=false):ProjectRecords {
  const records:ProjectRecords={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key)continue;
    for(const group of groups){const start=prefix(id,group);if(key.startsWith(start)){
      const suffix=key.slice(start.length);if(!/^[a-z0-9-]{1,80}$/.test(suffix))continue;
      const raw=localStorage.getItem(key);if(raw!==null)records[group+':'+suffix]=JSON.parse(raw);
    }}
  }
  if(includeNotebook){const raw=localStorage.getItem('novelty-shared-failures');if(raw)records['tools:failure-notebook']=JSON.parse(raw);}
  return records;
}
export function validateProjectRecords(value:unknown):ProjectRecords {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Project records must be an object.');
  const entries=Object.entries(value);if(entries.length>100)throw new Error('Project has more than 100 record groups.');
  for(const [key] of entries)if(!/^(defense|integrity|tools):[a-z0-9-]{1,80}$/.test(key))throw new Error('Project contains an unsupported record key. Tokens and account details cannot be imported.');
  function inspect(item:unknown,depth=0){
    if(depth>32)throw new Error('Project records are nested too deeply.');
    if(typeof item==='number'&&!Number.isFinite(item))throw new Error('Project contains an invalid numeric value.');
    if(item&&typeof item==='object')for(const [key,child] of Object.entries(item)){
      if(['__proto__','prototype','constructor'].includes(key))throw new Error('Project contains unsafe object keys.');
      if(/url$/i.test(key)&&typeof child==='string'&&child&&/^[a-z]+:/i.test(child)&&!/^https?:\/\//i.test(child))throw new Error('Source URLs must use HTTP or HTTPS.');
      inspect(child,depth+1);
    }
  }
  inspect(value);
  if(JSON.stringify(value).length>1_500_000)throw new Error('Project data exceeds 1.5 MB.');
  return value as ProjectRecords;
}
export function applyProjectRecords(id:string,value:unknown,includeNotebook=false) {
  const records=validateProjectRecords(value);
  const changes=Object.entries(records).filter(([key])=>includeNotebook||key!=='tools:failure-notebook').map(([namespace,data])=>{
    const [group,suffix]=namespace.split(':');return [namespace==='tools:failure-notebook'?'novelty-shared-failures':prefix(id,group)+suffix,JSON.stringify(data)] as const;
  });
  const original=changes.map(([key])=>[key,localStorage.getItem(key)] as const);
  try{for(const [key,raw] of changes)localStorage.setItem(key,raw);}
  catch(e){for(const [key,raw] of original){try{if(raw===null)localStorage.removeItem(key);else localStorage.setItem(key,raw);}catch{/* Preserve whatever remains if the browser has disabled storage. */}}throw e;}
  window.dispatchEvent(new Event('research-workspace-applied'));
  window.dispatchEvent(new Event('research-integrity-evidence-update'));
}
export function recordDifferences(local:ProjectRecords,remote:ProjectRecords){return [...new Set([...Object.keys(local),...Object.keys(remote)])].filter(key=>JSON.stringify(local[key])!==JSON.stringify(remote[key]));}
